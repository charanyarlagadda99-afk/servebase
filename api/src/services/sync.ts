import { query, withTransaction } from '../db/pool.js';
import { createOrder, sendKOT } from './orders.js';
import { finalizeBill } from './billing.js';
import { processPayment } from './payments.js';
import { recordCashMovement } from './shifts.js';

export interface OfflineSyncItem {
  client_tx_id: string;
  operation_type: 'CREATE_ORDER' | 'SEND_KOT' | 'PROCESS_PAYMENT' | 'CASH_MOVEMENT';
  terminal_id: string;
  outlet_id: string;
  client_timestamp: string;
  payload: any;
}

export interface SyncBatchResult {
  terminal_id: string;
  processed_count: number;
  acknowledged_ids: string[];
  conflicts: Array<{
    client_tx_id: string;
    error: string;
    action_taken: 'replayed' | 'skipped' | 'flagged_for_review';
  }>;
}

export async function syncOfflineBatch(
  terminalId: string,
  batch: OfflineSyncItem[],
  userId: string
): Promise<SyncBatchResult> {
  const acknowledgedIds: string[] = [];
  const conflicts: SyncBatchResult['conflicts'] = [];

  for (const item of batch) {
    try {
      if (item.operation_type === 'CREATE_ORDER') {
        // Idempotency check: check if order with this client_tx_id already exists in notes/metadata
        const existRes = await query(
          `SELECT id FROM orders WHERE notes LIKE $1 LIMIT 1`,
          [`%[CLIENT_TX:${item.client_tx_id}]%`]
        );

        if (existRes.rows.length > 0) {
          acknowledgedIds.push(item.client_tx_id);
          conflicts.push({
            client_tx_id: item.client_tx_id,
            error: 'Duplicate offline transaction already synced',
            action_taken: 'replayed',
          });
          continue;
        }

        const notes = `${item.payload.notes || ''} [CLIENT_TX:${item.client_tx_id}] [OFFLINE_SYNC]`;
        await createOrder({
          ...item.payload,
          outlet_id: item.outlet_id,
          terminal_id: item.terminal_id,
          user_id: userId,
          notes,
        });

        acknowledgedIds.push(item.client_tx_id);
      } else if (item.operation_type === 'PROCESS_PAYMENT') {
        const pmtResult = await processPayment({
          ...item.payload,
          outlet_id: item.outlet_id,
          idempotency_key: `OFFLINE-PMT-${item.client_tx_id}`,
          user_id: userId,
        });

        acknowledgedIds.push(item.client_tx_id);
        if (pmtResult.is_idempotent_replay) {
          conflicts.push({
            client_tx_id: item.client_tx_id,
            error: 'Payment was already settled on server',
            action_taken: 'replayed',
          });
        }
      } else if (item.operation_type === 'CASH_MOVEMENT') {
        await recordCashMovement(
          item.payload.shift_id,
          item.payload.movement_type,
          item.payload.amount_paise,
          `${item.payload.reason || ''} [CLIENT_TX:${item.client_tx_id}]`,
          userId,
          userId
        );
        acknowledgedIds.push(item.client_tx_id);
      } else {
        acknowledgedIds.push(item.client_tx_id);
      }
    } catch (err: any) {
      conflicts.push({
        client_tx_id: item.client_tx_id,
        error: err.message || 'Offline sync operation failed',
        action_taken: 'flagged_for_review',
      });
    }
  }

  return {
    terminal_id: terminalId,
    processed_count: acknowledgedIds.length,
    acknowledged_ids: acknowledgedIds,
    conflicts,
  };
}
