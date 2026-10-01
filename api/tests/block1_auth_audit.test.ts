import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool, query } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import {
  hashSecret,
  loginWithPassword,
  loginWithTerminalPin,
  authorizeApproval,
  verifyToken,
} from '../src/services/auth.js';
import { recordAudit, verifyAuditChain, computeAuditHash } from '../src/services/audit.js';

import { truncateAll } from '../src/db/clean.js';

describe('Block 1: Database, Auth, Permissions & Tamper-Evident Audit Log', () => {
  let orgId: string;
  let brandId: string;
  let outletId: string;
  let managerRoleId: string;
  let cashierRoleId: string;
  let managerUserId: string;
  let cashierUserId: string;

  beforeAll(async () => {
    await runMigrations();
    await truncateAll();

    // Setup hierarchy
    const orgRes = await query(`INSERT INTO organizations (name) VALUES ('Acme Dining Group') RETURNING id`);
    orgId = orgRes.rows[0].id;

    const brandRes = await query(`INSERT INTO brands (organization_id, name) VALUES ($1, 'Bake & Brew') RETURNING id`, [orgId]);
    brandId = brandRes.rows[0].id;

    const outletRes = await query(
      `INSERT INTO outlets (
        brand_id, name, code, gstin, address, state_code, state_name,
        tax_mode, rounding_rule, target_food_cost_min, target_food_cost_max,
        target_labor_cost_min, target_labor_cost_max, target_prime_cost_max
      ) VALUES ($1, 'Connaught Place Flagship', 'OUT-CP01', '07AAAAA0000A1Z5', 'B-Block CP, New Delhi', '07', 'Delhi', 'no_itc_5', 'nearest_rupee', 28.0, 35.0, 25.0, 35.0, 60.0)
      RETURNING id`,
      [brandId]
    );
    outletId = outletRes.rows[0].id;

    // Roles
    const mgrRoleRes = await query(
      `INSERT INTO roles (name, description, discount_cap_percent, can_void_after_kot, can_approve_refund, permissions)
       VALUES ('Outlet Manager', 'Floor manager', 50.0, true, true, '["orders:write", "bills:discount", "void:approve", "shifts:close"]')
       RETURNING id`
    );
    managerRoleId = mgrRoleRes.rows[0].id;

    const cshRoleRes = await query(
      `INSERT INTO roles (name, description, discount_cap_percent, permissions)
       VALUES ('Cashier', 'Billing cashier', 10.0, '["orders:write", "bills:create", "payments:collect"]')
       RETURNING id`
    );
    cashierRoleId = cshRoleRes.rows[0].id;

    // Users with hashed password and PIN
    const passHash = await hashSecret('Manager@123');
    const pinHash = await hashSecret('1234');

    const mgrUserRes = await query(
      `INSERT INTO users (email, password_hash, pin_hash, full_name, phone)
       VALUES ('manager@bakebrew.in', $1, $2, 'Rajesh Kumar', '+919876543210')
       RETURNING id`,
      [passHash, pinHash]
    );
    managerUserId = mgrUserRes.rows[0].id;

    const cshPinHash = await hashSecret('4321');
    const cshUserRes = await query(
      `INSERT INTO users (email, password_hash, pin_hash, full_name, phone)
       VALUES ('cashier@bakebrew.in', NULL, $1, 'Sunita Sharma', '+919876543211')
       RETURNING id`,
      [cshPinHash]
    );
    cashierUserId = cshUserRes.rows[0].id;

    // Bind roles
    await query(`INSERT INTO user_outlet_roles (user_id, outlet_id, role_id) VALUES ($1, $2, $3)`, [
      managerUserId,
      outletId,
      managerRoleId,
    ]);
    await query(`INSERT INTO user_outlet_roles (user_id, outlet_id, role_id) VALUES ($1, $2, $3)`, [
      cashierUserId,
      outletId,
      cashierRoleId,
    ]);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('authenticates back-office user with password and produces verified JWT', async () => {
    const login = await loginWithPassword('manager@bakebrew.in', 'Manager@123');
    expect(login.token).toBeDefined();
    expect(login.user.fullName).toBe('Rajesh Kumar');

    const decoded = verifyToken(login.token);
    expect(decoded.userId).toBe(managerUserId);
    expect(decoded.roles[0].roleName).toBe('Outlet Manager');
  });

  it('rejects incorrect password', async () => {
    await expect(loginWithPassword('manager@bakebrew.in', 'WrongPass')).rejects.toThrow('Invalid email or password');
  });

  it('authenticates terminal user with PIN', async () => {
    const login = await loginWithTerminalPin('4321', outletId);
    expect(login.token).toBeDefined();
    expect(login.user.fullName).toBe('Sunita Sharma');
    expect(login.user.roleName).toBe('Cashier');
    expect(login.user.discountCapPercent).toBe(10);
  });

  it('rejects invalid terminal PIN', async () => {
    await expect(loginWithTerminalPin('9999', outletId)).rejects.toThrow('Invalid terminal PIN or account locked');
  });

  it('authorizes sensitive operation via manager PIN approval workflow', async () => {
    const approval = await authorizeApproval(
      '1234', // Manager PIN
      outletId,
      'ITEM_VOID_AFTER_KOT',
      null,
      'Customer changed order to gluten-free alternative'
    );

    expect(approval.approved).toBe(true);
    expect(approval.approverId).toBe(managerUserId);
    expect(approval.approvalId).toBeDefined();

    // Verify approval record in DB
    const appRec = await query(`SELECT * FROM approvals WHERE id = $1`, [approval.approvalId]);
    expect(appRec.rows.length).toBe(1);
    expect(appRec.rows[0].reason).toContain('gluten-free');
  });

  it('maintains tamper-evident SHA-256 audit log hash chain', async () => {
    // Record multiple audit entries
    const e1 = await recordAudit({
      outlet_id: outletId,
      user_id: managerUserId,
      action: 'PRICE_OVERRIDE',
      entity_type: 'ORDER_ITEM',
      before_state: { price_paise: 25000 },
      after_state: { price_paise: 20000, reason: 'VIP Guest' },
    });

    const e2 = await recordAudit({
      outlet_id: outletId,
      user_id: cashierUserId,
      action: 'DRAWER_NO_SALE_OPEN',
      entity_type: 'TERMINAL',
      before_state: null,
      after_state: { reason: 'Exchange 500 note for change' },
    });

    expect(e1.entry_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(e2.entry_hash).toMatch(/^[a-f0-9]{64}$/);

    // Verify the chain
    const verifyResult = await verifyAuditChain(outletId);
    if (!verifyResult.valid) {
      console.error('Audit verification failed:', verifyResult);
    }
    expect(verifyResult.valid).toBe(true);
    expect(verifyResult.inspected).toBeGreaterThanOrEqual(2);
  });

  it('detects tampering when an audit log row is maliciously altered', async () => {
    // Tamper with an existing audit log entry using valid subquery
    await query(`UPDATE audit_logs SET action = 'MALICIOUS_ALTERATION' WHERE id = (SELECT id FROM audit_logs WHERE outlet_id = $1 LIMIT 1)`, [outletId]);

    const verifyResult = await verifyAuditChain(outletId);
    expect(verifyResult.valid).toBe(false);
    expect(verifyResult.failureReason).toContain('mismatch');
  });
});
