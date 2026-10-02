import { query, withTransaction } from '../db/pool.js';
import { realtimeBus } from './realtime.js';

export interface CreateAlertInput {
  outlet_id: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  metadata?: any;
}

export async function createAlert(input: CreateAlertInput) {
  const res = await query(
    `INSERT INTO system_alerts (outlet_id, alert_type, severity, message, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      input.outlet_id,
      input.alert_type,
      input.severity,
      input.message,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ]
  );
  const alert = res.rows[0];

  realtimeBus.publish({
    outlet_id: input.outlet_id,
    type: 'TABLE_UPDATED', // General system notification event
    data: {
      alert_id: alert.id,
      alert_type: alert.alert_type,
      severity: alert.severity,
      message: alert.message,
    },
  });

  return alert;
}

export async function getAlerts(outletId: string, unreadOnly = false) {
  let sql = `SELECT * FROM system_alerts WHERE outlet_id = $1`;
  if (unreadOnly) {
    sql += ` AND is_read = FALSE`;
  }
  sql += ` ORDER BY created_at DESC LIMIT 50`;

  const res = await query(sql, [outletId]);
  return res.rows;
}

export async function markAlertRead(alertId: string) {
  const res = await query(
    `UPDATE system_alerts SET is_read = TRUE WHERE id = $1 RETURNING *`,
    [alertId]
  );
  if (res.rows.length === 0) throw new Error('Alert not found');
  return res.rows[0];
}

export async function checkInventoryShortages(outletId: string) {
  const sql = `
    SELECT 
      rm.id, rm.name, rm.sku, rm.reorder_point,
      COALESCE(SUM(sl.quantity), 0) as on_hand
    FROM raw_materials rm
    LEFT JOIN stock_ledger sl ON sl.raw_material_id = rm.id
    WHERE rm.outlet_id = $1 AND rm.deleted_at IS NULL
    GROUP BY rm.id, rm.name, rm.sku, rm.reorder_point
    HAVING COALESCE(SUM(sl.quantity), 0) <= rm.reorder_point
  `;

  const lowStockRes = await query(sql, [outletId]);
  const generatedAlerts = [];

  for (const item of lowStockRes.rows) {
    const onHand = Number(item.on_hand);
    const reorder = Number(item.reorder_point);
    const severity: 'warning' | 'critical' = onHand <= 0 ? 'critical' : 'warning';

    const alert = await createAlert({
      outlet_id: outletId,
      alert_type: 'LOW_STOCK',
      severity,
      message: `Low stock alert: ${item.name} (${item.sku}) is at ${onHand}, below reorder point of ${reorder}`,
      metadata: {
        raw_material_id: item.id,
        on_hand: onHand,
        reorder_point: reorder,
      },
    });
    generatedAlerts.push(alert);
  }

  return generatedAlerts;
}

export async function checkCashOverShort(
  outletId: string,
  shiftId: string,
  overShortPaise: number,
  thresholdPaise = 50000 // Rs 500 threshold
) {
  if (Math.abs(overShortPaise) > thresholdPaise) {
    const isShort = overShortPaise < 0;
    const diffRs = Math.abs(overShortPaise) / 100;
    const severity: 'warning' | 'critical' = Math.abs(overShortPaise) >= 200000 ? 'critical' : 'warning';

    return createAlert({
      outlet_id: outletId,
      alert_type: isShort ? 'CASH_SHORTAGE' : 'CASH_SURPLUS',
      severity,
      message: `Cash discrepancy on shift closure: ${isShort ? 'Shortage' : 'Surplus'} of Rs ${diffRs} exceeds tolerance limit of Rs ${thresholdPaise / 100}`,
      metadata: {
        shift_id: shiftId,
        over_short_paise: overShortPaise,
        threshold_paise: thresholdPaise,
      },
    });
  }
  return null;
}
