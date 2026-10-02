import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool, query } from '../src/db/pool.js';
import { truncateAll } from '../src/db/clean.js';
import { runMigrations } from '../src/db/migrate.js';
import { syncOfflineBatch, OfflineSyncItem } from '../src/services/sync.js';
import { allocateNextInvoiceNumber } from '../src/services/billing.js';
import { runSeed } from '../src/db/seed.js';

describe('Block 11: Offline Sync, Concurrency Performance & Seed Generator', () => {
  let outletId: string;
  let terminalId: string;
  let userId: string;
  let menuItemId: string;

  beforeAll(async () => {
    await runMigrations();
    await truncateAll();

    // Base organization & outlet
    const orgRes = await query(`INSERT INTO organizations (name) VALUES ('ITC Hotels Group') RETURNING id`);
    const brandRes = await query(
      `INSERT INTO brands (organization_id, name) VALUES ($1, 'Dakshin Express') RETURNING id`,
      [orgRes.rows[0].id]
    );
    const outletRes = await query(
      `INSERT INTO outlets (brand_id, name, code, gstin, address, state_code)
       VALUES ($1, 'Dakshin Saket', 'DEL-DAK01', '07AAAAA0000A1Z5', 'Select Citywalk Saket', '07')
       RETURNING id`,
      [brandRes.rows[0].id]
    );
    outletId = outletRes.rows[0].id;

    const termRes = await query(
      `INSERT INTO terminals (outlet_id, name, terminal_code, invoice_series_code)
       VALUES ($1, 'Offline POS 1', 'T1', 'T1') RETURNING id`,
      [outletId]
    );
    terminalId = termRes.rows[0].id;

    const userRes = await query(
      `INSERT INTO users (full_name, pin_hash, email) VALUES ('Captain Raman', 'hash', 'raman@dakshin.in') RETURNING id`
    );
    userId = userRes.rows[0].id;

    // Menu Item
    const catRes = await query(`INSERT INTO categories (outlet_id, name) VALUES ($1, 'South Indian') RETURNING id`, [outletId]);
    const dishRes = await query(
      `INSERT INTO menu_items (outlet_id, category_id, name, base_price_paise)
       VALUES ($1, $2, 'Masala Dosa Ghee Roast', 22000) RETURNING id`,
      [outletId, catRes.rows[0].id]
    );
    menuItemId = dishRes.rows[0].id;
  });

  afterAll(async () => {
    await pool.end();
  });

  it('syncs batch of offline orders and handles duplicate replay idempotently', async () => {
    const clientTx1 = `TX-OFFLINE-${Date.now()}-01`;
    const clientTx2 = `TX-OFFLINE-${Date.now()}-02`;

    const batch: OfflineSyncItem[] = [
      {
        client_tx_id: clientTx1,
        operation_type: 'CREATE_ORDER',
        terminal_id: terminalId,
        outlet_id: outletId,
        client_timestamp: new Date().toISOString(),
        payload: {
          order_type: 'takeaway',
          business_date: '2026-10-01',
          items: [{ menu_item_id: menuItemId, item_name: 'Masala Dosa Ghee Roast', quantity: 2, unit_price_paise: 22000 }],
        },
      },
      {
        client_tx_id: clientTx2,
        operation_type: 'CREATE_ORDER',
        terminal_id: terminalId,
        outlet_id: outletId,
        client_timestamp: new Date().toISOString(),
        payload: {
          order_type: 'takeaway',
          business_date: '2026-10-01',
          items: [{ menu_item_id: menuItemId, item_name: 'Masala Dosa Ghee Roast', quantity: 1, unit_price_paise: 22000 }],
        },
      },
    ];

    // 1. Initial Sync
    const res1 = await syncOfflineBatch(terminalId, batch, userId);
    expect(res1.processed_count).toBe(2);
    expect(res1.acknowledged_ids).toContain(clientTx1);
    expect(res1.acknowledged_ids).toContain(clientTx2);
    expect(res1.conflicts.length).toBe(0);

    // Verify orders created in database
    const ordRes = await query(`SELECT COUNT(id) as count FROM orders WHERE outlet_id = $1`, [outletId]);
    expect(Number(ordRes.rows[0].count)).toBe(2);

    // 2. Replay Sync (simulating network retry of same offline queue)
    const res2 = await syncOfflineBatch(terminalId, batch, userId);
    expect(res2.processed_count).toBe(2); // Still acknowledged so terminal can clear queue
    expect(res2.conflicts.length).toBe(2);
    expect(res2.conflicts[0].action_taken).toBe('replayed');

    // Order count must not increase (idempotency preserved)
    const ordRes2 = await query(`SELECT COUNT(id) as count FROM orders WHERE outlet_id = $1`, [outletId]);
    expect(Number(ordRes2.rows[0].count)).toBe(2);
  });

  it('proves zero race conditions under high-throughput concurrent invoice allocations', async () => {
    const concurrentRequests = 30;
    const fyCode = '26-27';
    const seriesCode = 'T1';

    const startTime = Date.now();

    // Execute 30 concurrent allocations simultaneously
    const promises = Array.from({ length: concurrentRequests }).map(async () => {
      return pool.connect().then(async (client) => {
        try {
          await client.query('BEGIN');
          const num = await allocateNextInvoiceNumber(client, outletId, seriesCode, fyCode);
          await client.query('COMMIT');
          return num;
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      });
    });

    const allocatedNumbers = await Promise.all(promises);
    const durationMs = Date.now() - startTime;

    // Verify all 30 allocations succeeded
    expect(allocatedNumbers.length).toBe(concurrentRequests);

    // Verify all numbers are unique (no duplicates!)
    const uniqueSet = new Set(allocatedNumbers);
    expect(uniqueSet.size).toBe(concurrentRequests);

    // Verify strictly consecutive sequence: T1/26-27/00001 to T1/26-27/00030
    for (let i = 1; i <= concurrentRequests; i++) {
      const expected = `T1/${fyCode}/${String(i).padStart(5, '0')}`;
      expect(allocatedNumbers).toContain(expected);
    }

    console.log(`[BENCHMARK] Allocated ${concurrentRequests} consecutive invoices in ${durationMs}ms (${Math.round((concurrentRequests / durationMs) * 1000)} req/s)`);
  });

  it('runs seed generator and verifies multi-outlet and hotel room integrity', async () => {
    // Run a 5-day slice of the seed generator
    await runSeed(5);

    // Verify Organization and Outlets
    const orgs = await query(`SELECT * FROM organizations`);
    expect(orgs.rows.length).toBe(1);

    const outlets = await query(`SELECT * FROM outlets`);
    expect(outlets.rows.length).toBe(3); // Dawat Fine Dine, Brew Table Cafe, Grand Heritage Hotel

    // Verify Hotel Rooms (20 rooms)
    const rooms = await query(`SELECT COUNT(id) as room_count FROM rooms`);
    expect(Number(rooms.rows[0].room_count)).toBe(20);

    // Verify Invoices created by seed
    const invoices = await query(`SELECT COUNT(id) as inv_count FROM invoices`);
    expect(Number(invoices.rows[0].inv_count)).toBeGreaterThan(0);

    // Verify Day Close Z-reports
    const dayCloses = await query(`SELECT COUNT(id) as dc_count FROM day_closes`);
    expect(Number(dayCloses.rows[0].dc_count)).toBe(5);
  });
});
