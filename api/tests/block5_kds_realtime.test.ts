import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool, query } from '../src/db/pool.js';
import { truncateAll } from '../src/db/clean.js';
import { runMigrations } from '../src/db/migrate.js';
import { createFloorArea, createTable } from '../src/services/floor.js';
import { createCategory, createMenuItem } from '../src/services/menu.js';
import { createOrder, sendKOT } from '../src/services/orders.js';
import {
  getStationQueue,
  bumpKotItem,
  bumpKot,
  recallKot,
  fireCourse,
  getExpediterSummary,
  getKitchenPerformanceMetrics,
} from '../src/services/kds.js';
import { realtimeBus, RealtimeEvent } from '../src/services/realtime.js';

describe('Block 5: Kitchen Display System (KDS), Bump/Recall & Realtime Events', () => {
  let outletId: string;
  let waiterUserId: string;
  let tableId: string;
  let tandoorStationId: string;
  let curryStationId: string;
  let starterItemId: string;
  let curryItemId: string;

  beforeAll(async () => {
    await runMigrations();
    await truncateAll();

    // 1. Create brand & outlet
    const orgRes = await query(`INSERT INTO organizations (name) VALUES ('Peshawri Group') RETURNING id`);
    const brandRes = await query(
      `INSERT INTO brands (organization_id, name) VALUES ($1, 'Peshawri Hospitality') RETURNING id`,
      [orgRes.rows[0].id]
    );
    const outletRes = await query(
      `INSERT INTO outlets (brand_id, name, code, gstin, address, state_code)
       VALUES ($1, 'ITC Maurya Wing', 'DEL-ITC01', '07AAAAA0000A1Z5', 'Diplomatic Enclave', '07')
       RETURNING id`,
      [brandRes.rows[0].id]
    );
    outletId = outletRes.rows[0].id;

    // 2. Create Kitchen Stations: Tandoor and Curry
    const tandoorRes = await query(
      `INSERT INTO kitchen_stations (outlet_id, name, station_code) VALUES ($1, 'Tandoor Grill', 'TAND') RETURNING id`,
      [outletId]
    );
    tandoorStationId = tandoorRes.rows[0].id;

    const curryRes = await query(
      `INSERT INTO kitchen_stations (outlet_id, name, station_code) VALUES ($1, 'Curry & Gravy', 'CURR') RETURNING id`,
      [outletId]
    );
    curryStationId = curryRes.rows[0].id;

    // 3. User (Captain/Waiter)
    const userRes = await query(
      `INSERT INTO users (full_name, pin_hash, email) VALUES ('Sunil Chettri', 'hash', 'sunil@peshawri.in') RETURNING id`
    );
    waiterUserId = userRes.rows[0].id;

    // 4. Floor & Table
    const area = await createFloorArea(outletId, 'Fine Dining Area', 1);
    const table = await createTable({
      outlet_id: outletId,
      area_id: area.id,
      table_number: 'T-101',
      capacity: 4,
    });
    tableId = table.id;

    // 5. Menu Items assigned to stations
    const startersCat = await createCategory(outletId, 'Appetizers', 1);
    const mainsCat = await createCategory(outletId, 'Main Course', 2);

    const starter = await createMenuItem({
      outlet_id: outletId,
      category_id: startersCat.id,
      name: 'Bhatti Da Murgh',
      base_price_paise: 55000,
      station_id: tandoorStationId,
    });
    starterItemId = starter.id;

    const curry = await createMenuItem({
      outlet_id: outletId,
      category_id: mainsCat.id,
      name: 'Dal Bukhara',
      base_price_paise: 65000,
      station_id: curryStationId,
    });
    curryItemId = curry.id;
  });

  afterAll(async () => {
    await pool.end();
  });

  it('routes KOTs to specific kitchen stations and verifies station queue retrieval', async () => {
    // Create an order with starters and mains on hold
    const order = await createOrder({
      outlet_id: outletId,
      table_id: tableId,
      user_id: waiterUserId,
      order_type: 'dine_in',
      business_date: '2026-10-01',
      covers: 2,
      items: [
        {
          menu_item_id: starterItemId,
          item_name: 'Bhatti Da Murgh',
          quantity: 2,
          unit_price_paise: 55000,
          course: 'starters',
          course_status: 'fire',
          notes: 'Extra spicy, well done',
        },
        {
          menu_item_id: curryItemId,
          item_name: 'Dal Bukhara',
          quantity: 1,
          unit_price_paise: 65000,
          course: 'mains',
          course_status: 'hold',
          notes: 'Double butter on top',
        },
      ],
    });

    // Route KOTs using core priority sequence
    const kots = await sendKOT(order.id, waiterUserId);
    expect(kots.length).toBe(2);

    // Retrieve Tandoor station queue
    const tandoorQueue = await getStationQueue(outletId, tandoorStationId);
    expect(tandoorQueue.length).toBe(1);
    expect(tandoorQueue[0].station_code).toBe('TAND');
    expect(tandoorQueue[0].table_number).toBe('T-101');
    expect(tandoorQueue[0].items.length).toBe(1);
    expect(tandoorQueue[0].items[0].item_name).toBe('Bhatti Da Murgh');
    expect(tandoorQueue[0].items[0].quantity).toBe(2);
    expect(tandoorQueue[0].items[0].notes).toBe('Extra spicy, well done');

    // Retrieve Curry station queue
    const curryQueue = await getStationQueue(outletId, curryStationId);
    expect(curryQueue.length).toBe(1);
    expect(curryQueue[0].station_code).toBe('CURR');
    expect(curryQueue[0].items[0].course_status).toBe('hold');
  });

  it('bumps individual KOT item and automatically marks KOT bumped when all items complete', async () => {
    const queue = await getStationQueue(outletId, tandoorStationId);
    expect(queue.length).toBe(1);
    const kotItem = queue[0].items[0];

    // Bump the item
    const bumpResult = await bumpKotItem(kotItem.id, 'bumped', waiterUserId);
    expect(bumpResult.targetStatus).toBe('bumped');
    expect(bumpResult.kotBumped).toBe(true); // Since it was the only item in this KOT

    // Verify Tandoor queue is now empty (active KOTs only)
    const activeQueue = await getStationQueue(outletId, tandoorStationId);
    expect(activeQueue.length).toBe(0);

    // Verify bumped KOT is visible when showBumped: true
    const historyQueue = await getStationQueue(outletId, tandoorStationId, { showBumped: true });
    expect(historyQueue.length).toBe(1);
    expect(historyQueue[0].status).toBe('bumped');
  });

  it('recalls a bumped KOT back to preparing state within recall window', async () => {
    const historyQueue = await getStationQueue(outletId, tandoorStationId, { showBumped: true });
    const bumpedKotId = historyQueue[0].kot_id;

    // Recall ticket
    const recallResult = await recallKot(bumpedKotId, waiterUserId);
    expect(recallResult.status).toBe('preparing');

    // Verify ticket is back in active Tandoor queue
    const activeQueue = await getStationQueue(outletId, tandoorStationId);
    expect(activeQueue.length).toBe(1);
    expect(activeQueue[0].kot_id).toBe(bumpedKotId);
    expect(activeQueue[0].status).toBe('preparing');
  });

  it('bumps entire KOT ticket in a single operation', async () => {
    const activeQueue = await getStationQueue(outletId, tandoorStationId);
    const kotId = activeQueue[0].kot_id;

    const result = await bumpKot(kotId, waiterUserId);
    expect(result.status).toBe('bumped');

    const emptyQueue = await getStationQueue(outletId, tandoorStationId);
    expect(emptyQueue.length).toBe(0);
  });

  it('fires a held course and broadcasts realtime event', async () => {
    // Curry station currently has Dal Bukhara on 'hold'
    const curryQueue = await getStationQueue(outletId, curryStationId);
    expect(curryQueue[0].items[0].course_status).toBe('hold');
    const orderId = curryQueue[0].order_id;

    // Listen for realtime bus event
    let capturedEvent: RealtimeEvent | null = null;
    const unsubscribe = realtimeBus.subscribeOutlet(outletId, (event) => {
      if (event.type === 'COURSE_FIRED') {
        capturedEvent = event;
      }
    });

    const fireResult = await fireCourse(orderId, 'mains', waiterUserId);
    expect(fireResult.course).toBe('mains');
    expect(fireResult.firedCount).toBe(1);

    expect(capturedEvent).not.toBeNull();
    expect(capturedEvent?.data.course).toBe('mains');
    expect(capturedEvent?.data.order_id).toBe(orderId);

    unsubscribe();

    // Verify queue now shows item with course_status: 'fire'
    const updatedCurryQueue = await getStationQueue(outletId, curryStationId);
    expect(updatedCurryQueue[0].items[0].course_status).toBe('fire');
  });

  it('provides expediter summary showing overall ticket completion across stations', async () => {
    const summary = await getExpediterSummary(outletId);
    expect(summary.length).toBe(1);
    const orderSummary = summary[0];

    expect(orderSummary.table_number).toBe('T-101');
    expect(orderSummary.total_kots).toBe(2);
    // Tandoor is bumped (1), Curry is not bumped yet (0)
    expect(orderSummary.bumped_kots).toBe(1);
    expect(orderSummary.is_ready_for_dispatch).toBe(false);

    // Bump Curry KOT to complete the entire order
    const curryQueue = await getStationQueue(outletId, curryStationId);
    await bumpKot(curryQueue[0].kot_id, waiterUserId);

    const readySummary = await getExpediterSummary(outletId);
    expect(readySummary[0].bumped_kots).toBe(2);
    expect(readySummary[0].is_ready_for_dispatch).toBe(true);
  });

  it('calculates kitchen performance metrics including avg prep time and station stats', async () => {
    const metrics = await getKitchenPerformanceMetrics(outletId);
    expect(metrics.total_kots).toBe(2);
    expect(metrics.bumped_kots).toBe(2);
    expect(metrics.station_metrics.length).toBe(2);

    const tandoorMetric = metrics.station_metrics.find((s) => s.station_code === 'TAND');
    expect(tandoorMetric).toBeDefined();
    expect(tandoorMetric?.bumped_kots).toBe(1);
  });
});
