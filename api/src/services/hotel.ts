import type pg from 'pg';
import { query, withTransaction } from '../db/pool.js';
import { recordAudit } from './audit.js';

export interface CreateRoomInput {
  outlet_id: string;
  room_number: string;
  room_type: string;
  base_tariff_paise: number;
}

export async function createRoom(input: CreateRoomInput) {
  const res = await query(
    `INSERT INTO rooms (outlet_id, room_number, room_type, base_tariff_paise, status)
     VALUES ($1, $2, $3, $4, 'clean')
     RETURNING *`,
    [input.outlet_id, input.room_number, input.room_type, input.base_tariff_paise]
  );
  return {
    ...res.rows[0],
    base_tariff_paise: Number(res.rows[0].base_tariff_paise),
  };
}

export async function getRooms(outletId: string) {
  const res = await query(
    `SELECT r.*, f.id as active_folio_id, g.name as guest_name
     FROM rooms r
     LEFT JOIN hotel_folios f ON f.room_id = r.id AND f.status = 'active'
     LEFT JOIN guests g ON g.id = f.guest_id
     WHERE r.outlet_id = $1
     ORDER BY r.room_number ASC`,
    [outletId]
  );
  return res.rows.map((r) => ({
    ...r,
    base_tariff_paise: Number(r.base_tariff_paise),
  }));
}

export async function updateRoomStatus(
  roomId: string,
  status: 'clean' | 'occupied' | 'dirty' | 'maintenance'
) {
  const res = await query(
    `UPDATE rooms SET status = $1 WHERE id = $2 RETURNING *`,
    [status, roomId]
  );
  if (res.rows.length === 0) throw new Error('Room not found');
  return {
    ...res.rows[0],
    base_tariff_paise: Number(res.rows[0].base_tariff_paise),
  };
}

export interface CreateGuestInput {
  name: string;
  phone: string;
  email?: string;
  id_type?: string;
  id_number?: string;
}

export async function createGuest(input: CreateGuestInput) {
  const res = await query(
    `INSERT INTO guests (name, phone, email, id_type, id_number)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [input.name, input.phone, input.email || null, input.id_type || 'passport', input.id_number || null]
  );
  return res.rows[0];
}

export async function checkInGuest(
  outletId: string,
  roomId: string,
  guestId: string,
  creditLimitPaise = 5000000 // Rs 50,000 credit limit
) {
  return withTransaction(async (client) => {
    // 1. Verify room is available / clean
    const roomRes = await client.query(`SELECT * FROM rooms WHERE id = $1 FOR UPDATE`, [roomId]);
    if (roomRes.rows.length === 0) throw new Error('Room not found');
    const room = roomRes.rows[0];

    if (room.status === 'occupied') {
      throw new Error(`Room ${room.room_number} is already occupied`);
    }

    // 2. Update room status to occupied
    await client.query(`UPDATE rooms SET status = 'occupied' WHERE id = $1`, [roomId]);

    // 3. Create active folio
    const folioRes = await client.query(
      `INSERT INTO hotel_folios (
        room_id, guest_id, check_in_date, credit_limit_paise, total_posted_paise, status
      ) VALUES ($1, $2, NOW(), $3, 0, 'active')
      RETURNING *`,
      [roomId, guestId, creditLimitPaise]
    );
    const folio = folioRes.rows[0];

    return {
      ...folio,
      credit_limit_paise: Number(folio.credit_limit_paise),
      total_posted_paise: Number(folio.total_posted_paise),
      room_number: room.room_number,
    };
  });
}

export async function postChargeToRoom(
  outletId: string,
  roomNumber: string,
  amountPaise: number,
  description: string,
  chargeType: 'restaurant_charge' | 'room_service' | 'tax' | 'room_charge' = 'restaurant_charge',
  referenceInvoiceId?: string,
  existingClient?: pg.PoolClient
) {
  const execute = async (client: pg.PoolClient) => {
    // 1. Find room and active folio
    const roomRes = await client.query(
      `SELECT r.id as room_id, r.room_number, r.status as room_status, f.id as folio_id, f.credit_limit_paise, f.total_posted_paise
       FROM rooms r
       JOIN hotel_folios f ON f.room_id = r.id AND f.status = 'active'
       WHERE r.outlet_id = $1 AND r.room_number = $2
       FOR UPDATE OF f`,
      [outletId, roomNumber]
    );

    if (roomRes.rows.length === 0) {
      throw new Error(`No active checked-in guest folio found for room '${roomNumber}'`);
    }

    const info = roomRes.rows[0];
    const currentTotal = Number(info.total_posted_paise);
    const creditLimit = Number(info.credit_limit_paise);

    // 2. Validate credit limit
    if (currentTotal + amountPaise > creditLimit) {
      throw new Error(
        `Charge exceeds room credit limit: Current posted Rs ${currentTotal / 100} + New charge Rs ${amountPaise / 100} exceeds credit limit Rs ${creditLimit / 100}`
      );
    }

    // 3. Insert folio charge
    const chargeRes = await client.query(
      `INSERT INTO folio_charges (
        folio_id, outlet_id, charge_type, description, amount_paise, reference_invoice_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [info.folio_id, outletId, chargeType, description, amountPaise, referenceInvoiceId || null]
    );

    // 4. Update folio total
    await client.query(
      `UPDATE hotel_folios 
       SET total_posted_paise = total_posted_paise + $1 
       WHERE id = $2`,
      [amountPaise, info.folio_id]
    );

    const charge = chargeRes.rows[0];
    return {
      ...charge,
      amount_paise: Number(charge.amount_paise),
      folio_balance_paise: currentTotal + amountPaise,
    };
  };

  if (existingClient) {
    return execute(existingClient);
  }
  return withTransaction(execute);
}

export async function runNightAudit(outletId: string, businessDate: string, userId: string) {
  return withTransaction(async (client) => {
    // 1. Fetch total rooms
    const totalRoomsRes = await client.query(
      `SELECT COUNT(id) as total_rooms FROM rooms WHERE outlet_id = $1`,
      [outletId]
    );
    const totalRooms = Number(totalRoomsRes.rows[0].total_rooms);

    // 2. Fetch all active folios
    const activeFoliosRes = await client.query(
      `SELECT f.id as folio_id, f.room_id, r.room_number, r.base_tariff_paise
       FROM hotel_folios f
       JOIN rooms r ON r.id = f.room_id
       WHERE f.status = 'active' AND r.outlet_id = $1`,
      [outletId]
    );

    const occupiedRooms = activeFoliosRes.rows.length;
    let totalRoomRevenuePaise = 0;

    // 3. Post daily room tariff charge to each active folio
    for (const fol of activeFoliosRes.rows) {
      const tariff = Number(fol.base_tariff_paise);
      totalRoomRevenuePaise += tariff;

      // Post room tariff charge
      await client.query(
        `INSERT INTO folio_charges (
          folio_id, outlet_id, charge_type, description, amount_paise
        ) VALUES ($1, $2, 'room_charge', $3, $4)`,
        [
          fol.folio_id,
          outletId,
          `Daily room charge for ${businessDate} - Room ${fol.room_number}`,
          tariff,
        ]
      );

      // Increment folio balance
      await client.query(
        `UPDATE hotel_folios 
         SET total_posted_paise = total_posted_paise + $1 
         WHERE id = $2`,
        [tariff, fol.folio_id]
      );
    }

    // 4. Fetch total F&B charges posted to rooms during this date
    const fbChargesRes = await client.query(
      `SELECT COALESCE(SUM(amount_paise), 0) as total_fb_paise
       FROM folio_charges
       WHERE outlet_id = $1 AND charge_type IN ('restaurant_charge', 'room_service') 
         AND is_reversed = FALSE AND created_at::date = $2::date`,
      [outletId, businessDate]
    );
    const totalFbPaise = Number(fbChargesRes.rows[0].total_fb_paise);

    // 5. Hospitality Performance Metrics: Occupancy %, ADR, RevPAR
    const occupancyPercent = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;
    const adrPaise = occupiedRooms > 0 ? Math.round(totalRoomRevenuePaise / occupiedRooms) : 0;
    const revparPaise = totalRooms > 0 ? Math.round(totalRoomRevenuePaise / totalRooms) : 0;

    const summary = {
      business_date: businessDate,
      total_rooms: totalRooms,
      occupied_rooms: occupiedRooms,
      occupancy_percent: Math.round(occupancyPercent * 100) / 100,
      total_room_revenue_paise: totalRoomRevenuePaise,
      total_fb_charges_paise: totalFbPaise,
      average_daily_rate_paise: adrPaise,
      revpar_paise: revparPaise,
    };

    await recordAudit({
      outlet_id: outletId,
      user_id: userId,
      action: 'HOTEL_NIGHT_AUDIT',
      entity_type: 'NIGHT_AUDIT',
      after_state: summary,
    }, client);

    return summary;
  });
}

export async function settleAndCheckOut(
  folioId: string,
  paymentMethod: string,
  userId: string
) {
  return withTransaction(async (client) => {
    const folioRes = await client.query(
      `SELECT f.*, r.room_number 
       FROM hotel_folios f 
       JOIN rooms r ON r.id = f.room_id 
       WHERE f.id = $1 FOR UPDATE`,
      [folioId]
    );
    if (folioRes.rows.length === 0) throw new Error('Folio not found');
    const folio = folioRes.rows[0];

    if (folio.status !== 'active') {
      throw new Error(`Cannot checkout folio with status '${folio.status}'`);
    }

    const balancePaise = Number(folio.total_posted_paise);

    // 1. Mark folio as settled
    await client.query(
      `UPDATE hotel_folios 
       SET status = 'settled', check_out_date = NOW() 
       WHERE id = $1`,
      [folioId]
    );

    // 2. Mark room dirty for housekeeping
    await client.query(
      `UPDATE rooms SET status = 'dirty' WHERE id = $1`,
      [folio.room_id]
    );

    await recordAudit({
      outlet_id: folio.outlet_id || (await client.query(`SELECT outlet_id FROM rooms WHERE id = $1`, [folio.room_id])).rows[0].outlet_id,
      user_id: userId,
      action: 'GUEST_CHECKOUT',
      entity_type: 'HOTEL_FOLIO',
      entity_id: folioId,
      after_state: {
        room_number: folio.room_number,
        total_settled_paise: balancePaise,
        payment_method: paymentMethod,
      },
    }, client);

    return {
      folio_id: folioId,
      room_number: folio.room_number,
      total_settled_paise: balancePaise,
      payment_method: paymentMethod,
      status: 'settled',
    };
  });
}
