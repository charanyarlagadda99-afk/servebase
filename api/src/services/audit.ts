import crypto from 'crypto';
import { pool, query } from '../db/pool.js';

export interface AuditEntryInput {
  outlet_id?: string;
  user_id?: string;
  terminal_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  before_state?: any;
  after_state?: any;
}

export const GENESIS_HASH = '0'.repeat(64);

function stableStringify(obj: any): string {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

export function computeAuditHash(
  prevHash: string,
  outletId: string | null,
  userId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  beforeState: any,
  afterState: any,
  timestampIso: string
): string {
  // Normalize timestamp to UTC milliseconds precision
  const normTime = new Date(timestampIso).toISOString();
  const beforeJson = stableStringify(beforeState ?? null);
  const afterJson = stableStringify(afterState ?? null);

  const content = [
    prevHash,
    outletId || 'system',
    userId || 'system',
    action,
    entityType,
    entityId || 'none',
    beforeJson,
    afterJson,
    normTime,
  ].join('|');

  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

export async function recordAudit(entry: AuditEntryInput): Promise<{ id: string; entry_hash: string }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the most recent audit entry row for this outlet to guarantee linear serial chain
    const lastRes = await client.query(
      `SELECT entry_hash FROM audit_logs 
       WHERE outlet_id IS NOT DISTINCT FROM $1 
       ORDER BY seq DESC LIMIT 1 FOR UPDATE`,
      [entry.outlet_id || null]
    );

    const prevHash = lastRes.rows.length > 0 ? lastRes.rows[0].entry_hash : GENESIS_HASH;
    const nowIso = new Date().toISOString();

    const cleanBefore = entry.before_state !== undefined && entry.before_state !== null
      ? JSON.parse(JSON.stringify(entry.before_state))
      : null;
    const cleanAfter = entry.after_state !== undefined && entry.after_state !== null
      ? JSON.parse(JSON.stringify(entry.after_state))
      : null;

    const entryHash = computeAuditHash(
      prevHash,
      entry.outlet_id || null,
      entry.user_id || null,
      entry.action,
      entry.entity_type,
      entry.entity_id || null,
      cleanBefore,
      cleanAfter,
      nowIso
    );

    const insertRes = await client.query(
      `INSERT INTO audit_logs (
        outlet_id, user_id, terminal_id, action, entity_type, entity_id,
        before_state, after_state, prev_hash, entry_hash, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, entry_hash`,
      [
        entry.outlet_id || null,
        entry.user_id || null,
        entry.terminal_id || null,
        entry.action,
        entry.entity_type,
        entry.entity_id || null,
        cleanBefore ? JSON.stringify(cleanBefore) : null,
        cleanAfter ? JSON.stringify(cleanAfter) : null,
        prevHash,
        entryHash,
        nowIso,
      ]
    );

    await client.query('COMMIT');
    return insertRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function verifyAuditChain(outletId: string): Promise<{ valid: boolean; inspected: number; failureReason?: string }> {
  const res = await query(
    `SELECT * FROM audit_logs WHERE outlet_id = $1 ORDER BY seq ASC`,
    [outletId]
  );

  let currentExpectedPrev = GENESIS_HASH;
  for (let i = 0; i < res.rows.length; i++) {
    const row = res.rows[i];
    if (row.prev_hash !== currentExpectedPrev) {
      return {
        valid: false,
        inspected: i,
        failureReason: `Broken link at index ${i}: expected prev_hash ${currentExpectedPrev}, found ${row.prev_hash}`,
      };
    }

    const recomputed = computeAuditHash(
      row.prev_hash,
      row.outlet_id,
      row.user_id,
      row.action,
      row.entity_type,
      row.entity_id,
      row.before_state,
      row.after_state,
      new Date(row.created_at).toISOString()
    );

    if (recomputed !== row.entry_hash) {
      return {
        valid: false,
        inspected: i,
        failureReason: `Hash mismatch at index ${i}: entry has ${row.entry_hash}, computed ${recomputed}`,
      };
    }

    currentExpectedPrev = row.entry_hash;
  }

  return { valid: true, inspected: res.rows.length };
}
