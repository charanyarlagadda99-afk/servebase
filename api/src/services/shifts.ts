import { query, withTransaction } from '../db/pool.js';
import { corePool } from './core-pool.js';
import { recordAudit } from './audit.js';

export async function openShift(
  outletId: string,
  terminalId: string,
  userId: string,
  openingFloatPaise: number,
  businessDate: string
) {
  // Check if active open shift already exists for this user/terminal
  const existingRes = await query(
    `SELECT * FROM shifts WHERE terminal_id = $1 AND status = 'open'`,
    [terminalId]
  );
  if (existingRes.rows.length > 0) {
    throw new Error('A shift is already open on this terminal');
  }

  const res = await query(
    `INSERT INTO shifts (
      outlet_id, terminal_id, user_id, business_date, opening_float_paise, status
    ) VALUES ($1, $2, $3, $4, $5, 'open')
    RETURNING *`,
    [outletId, terminalId, userId, businessDate, openingFloatPaise]
  );

  const shift = res.rows[0];

  await recordAudit({
    outlet_id: outletId,
    user_id: userId,
    terminal_id: terminalId,
    action: 'SHIFT_OPEN',
    entity_type: 'SHIFT',
    entity_id: shift.id,
    after_state: { opening_float_paise: openingFloatPaise, business_date: businessDate },
  });

  return shift;
}

export async function recordCashMovement(
  shiftId: string,
  movementType: 'paid_in' | 'paid_out' | 'drop' | 'no_sale_open',
  amountPaise: number,
  reason: string,
  authorizedByUserId: string,
  userId: string
) {
  const shiftRes = await query(`SELECT * FROM shifts WHERE id = $1`, [shiftId]);
  if (shiftRes.rows.length === 0) throw new Error('Shift not found');
  const shift = shiftRes.rows[0];
  if (shift.status !== 'open') throw new Error('Cannot add cash movement to closed shift');

  const res = await query(
    `INSERT INTO shift_cash_movements (shift_id, movement_type, amount_paise, reason, authorized_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [shiftId, movementType, amountPaise, reason, authorizedByUserId]
  );

  await recordAudit({
    outlet_id: shift.outlet_id,
    user_id: userId,
    terminal_id: shift.terminal_id,
    action: `SHIFT_${movementType.toUpperCase()}`,
    entity_type: 'SHIFT_MOVEMENT',
    entity_id: res.rows[0].id,
    after_state: { amount_paise: amountPaise, reason, authorized_by: authorizedByUserId },
  });

  return res.rows[0];
}

export async function closeShift(
  shiftId: string,
  actualCashPaise: number,
  denominations: Record<string, number> = {},
  isBlindClose = false,
  notes = '',
  userId: string
) {
  return withTransaction(async (client) => {
    const shiftRes = await client.query(`SELECT * FROM shifts WHERE id = $1 FOR UPDATE`, [shiftId]);
    if (shiftRes.rows.length === 0) throw new Error('Shift not found');
    const shift = shiftRes.rows[0];
    if (shift.status !== 'open') throw new Error('Shift is already closed');

    // 1. Calculate cash sales during shift window
    const cashSalesRes = await client.query(
      `SELECT COALESCE(SUM(amount_paise), 0) as cash_sales
       FROM payments
       WHERE outlet_id = $1 AND payment_method = 'cash' AND status = 'completed'
         AND created_at >= $2 AND created_at <= NOW()`,
      [shift.outlet_id, shift.opened_at]
    );
    const cashSalesPaise = Number(cashSalesRes.rows[0].cash_sales);

    // 2. Calculate paid-ins, paid-outs, cash drops
    const movementsRes = await client.query(
      `SELECT movement_type, COALESCE(SUM(amount_paise), 0) as total
       FROM shift_cash_movements
       WHERE shift_id = $1
       GROUP BY movement_type`,
      [shiftId]
    );

    let paidIns = 0;
    let paidOuts = 0;
    let drops = 0;
    for (const row of movementsRes.rows) {
      const amt = Number(row.total);
      if (row.movement_type === 'paid_in') paidIns += amt;
      else if (row.movement_type === 'paid_out') paidOuts += amt;
      else if (row.movement_type === 'drop') drops += amt;
    }

    // 3. Call C++ Core Engine to reconcile shift
    const recon = await corePool.execute('reconcile_shift', {
      opening_float_paise: Number(shift.opening_float_paise),
      cash_sales_paise: cashSalesPaise,
      paid_ins_paise: paidIns,
      paid_outs_paise: paidOuts,
      cash_drops_paise: drops,
      actual_cash_counted_paise: actualCashPaise,
      denominations,
    });

    // 4. Update shift record
    const updatedRes = await client.query(
      `UPDATE shifts
       SET status = 'closed',
           closed_at = NOW(),
           closing_cash_actual_paise = $1,
           closing_cash_expected_paise = $2,
           over_short_paise = $3,
           is_blind_closed = $4,
           denomination_breakdown = $5,
           notes = $6
       WHERE id = $7
       RETURNING *`,
      [
        recon.actual_cash_paise,
        recon.expected_cash_paise,
        recon.over_short_paise,
        isBlindClose,
        JSON.stringify(denominations),
        notes,
        shiftId,
      ]
    );

    await recordAudit({
      outlet_id: shift.outlet_id,
      user_id: userId,
      terminal_id: shift.terminal_id,
      action: 'SHIFT_CLOSE',
      entity_type: 'SHIFT',
      entity_id: shiftId,
      after_state: {
        expected_cash_paise: recon.expected_cash_paise,
        actual_cash_paise: recon.actual_cash_paise,
        over_short_paise: recon.over_short_paise,
        is_blind_closed: isBlindClose,
      },
    }, client);

    return updatedRes.rows[0];
  });
}
