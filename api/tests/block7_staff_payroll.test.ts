import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool, query } from '../src/db/pool.js';
import { truncateAll } from '../src/db/clean.js';
import { runMigrations } from '../src/db/migrate.js';
import {
  createEmployee,
  getEmployees,
  createStaffShift,
  assignRoster,
  clockIn,
  clockOut,
  configureStatutoryDeductions,
  runPayroll,
  approvePayrollRun,
} from '../src/services/staff.js';

describe('Block 7: Staff, Shifts, Attendance & C++ Payroll Engine', () => {
  let outletId: string;
  let managerUserId: string;
  let chefEmpId: string;
  let cookEmpId: string;
  let waiterEmpId: string;
  let morningShiftId: string;
  let eveningShiftId: string;

  beforeAll(async () => {
    await runMigrations();
    await truncateAll();

    // 1. Organization & Outlet
    const orgRes = await query(`INSERT INTO organizations (name) VALUES ('Bukhara Dining Group') RETURNING id`);
    const brandRes = await query(
      `INSERT INTO brands (organization_id, name) VALUES ($1, 'Bukhara Heritage') RETURNING id`,
      [orgRes.rows[0].id]
    );
    const outletRes = await query(
      `INSERT INTO outlets (brand_id, name, code, gstin, address, state_code)
       VALUES ($1, 'ITC Maurya Bukhara', 'DEL-BUK01', '07AAAAA0000A1Z5', 'Sardar Patel Marg', '07')
       RETURNING id`,
      [brandRes.rows[0].id]
    );
    outletId = outletRes.rows[0].id;

    // 2. Manager User
    const userRes = await query(
      `INSERT INTO users (full_name, pin_hash, email) VALUES ('Sanjeev Kapoor', 'hash', 'sanjeev@bukhara.in') RETURNING id`
    );
    managerUserId = userRes.rows[0].id;

    // 3. Create Employees: Head Chef (Monthly 60k), Line Cook (Monthly 30k), Waiter (Hourly 150/hr)
    const chef = await createEmployee({
      outlet_id: outletId,
      employee_code: 'EMP-001',
      first_name: 'Manjit',
      last_name: 'Gill',
      role: 'head_chef',
      phone: '+919810011223',
      email: 'manjit@bukhara.in',
      salary_type: 'monthly',
      base_rate_paise: 6000000, // Rs 60,000/month
    });
    chefEmpId = chef.id;

    const cook = await createEmployee({
      outlet_id: outletId,
      employee_code: 'EMP-002',
      first_name: 'Harish',
      last_name: 'Rawat',
      role: 'line_cook',
      phone: '+919810022334',
      email: 'harish@bukhara.in',
      salary_type: 'monthly',
      base_rate_paise: 3000000, // Rs 30,000/month
    });
    cookEmpId = cook.id;

    const waiter = await createEmployee({
      outlet_id: outletId,
      employee_code: 'EMP-003',
      first_name: 'Karan',
      last_name: 'Mehra',
      role: 'waiter',
      phone: '+919810033445',
      salary_type: 'hourly',
      base_rate_paise: 15000, // Rs 150/hour
    });
    waiterEmpId = waiter.id;

    // 4. Shifts: Morning (08:00 to 16:30) & Evening (16:00 to 00:30)
    const mShift = await createStaffShift(outletId, 'Morning Shift', '08:00:00', '16:30:00');
    morningShiftId = mShift.id;

    const eShift = await createStaffShift(outletId, 'Evening Shift', '16:00:00', '00:30:00');
    eveningShiftId = eShift.id;
  });

  afterAll(async () => {
    await pool.end();
  });

  it('lists active employees and schedules shifts in the staff roster', async () => {
    const employees = await getEmployees(outletId);
    expect(employees.length).toBe(3);

    // Schedule Chef for Morning shift on 2026-10-01
    const chefRoster = await assignRoster(outletId, chefEmpId, morningShiftId, '2026-10-01');
    expect(chefRoster.status).toBe('scheduled');

    // Schedule Cook for Morning shift on 2026-10-01
    const cookRoster = await assignRoster(outletId, cookEmpId, morningShiftId, '2026-10-01');
    expect(cookRoster.status).toBe('scheduled');

    // Schedule Waiter for Evening shift on 2026-10-01
    const waiterRoster = await assignRoster(outletId, waiterEmpId, eveningShiftId, '2026-10-01');
    expect(waiterRoster.status).toBe('scheduled');
  });

  it('enforces clock-in grace period and flags late arrivals', async () => {
    // 1. Chef clocks in at 08:05 (within 15-min grace for 08:00 shift) -> NOT late
    const onTimeDate = new Date('2026-10-01T08:05:00');
    const chefClockIn = await clockIn(outletId, chefEmpId, '2026-10-01', onTimeDate);
    expect(chefClockIn.is_late).toBe(false);

    // 2. Cook clocks in at 08:45 (exceeds 15-min grace for 08:00 shift) -> LATE
    const lateDate = new Date('2026-10-01T08:45:00');
    const cookClockIn = await clockIn(outletId, cookEmpId, '2026-10-01', lateDate);
    expect(cookClockIn.is_late).toBe(true);
  });

  it('records clock-out with breaks and detects early departures', async () => {
    // 1. Chef clocks out at 16:30 with 30-min break -> Normal shift completion
    const chefClockOutDate = new Date('2026-10-01T16:30:00');
    const chefOut = await clockOut(outletId, chefEmpId, '2026-10-01', chefClockOutDate, 30);
    expect(chefOut.is_early_departure).toBe(false);
    expect(chefOut.break_minutes).toBe(30);

    // 2. Cook departs early at 14:00 (scheduled until 16:30) -> EARLY DEPARTURE
    const cookEarlyDate = new Date('2026-10-01T14:00:00');
    const cookOut = await clockOut(outletId, cookEmpId, '2026-10-01', cookEarlyDate, 15);
    expect(cookOut.is_early_departure).toBe(true);
  });

  it('configures statutory deduction tables with compliance notice', async () => {
    const deductions = await configureStatutoryDeductions(outletId, [
      { component_name: 'PF', percentage: 12.0 },
      { component_name: 'ESI', percentage: 0.75 },
      { component_name: 'PT', flat_amount_paise: 20000 }, // Rs 200 Professional Tax
      { component_name: 'TDS', percentage: 5.0 },
    ]);

    expect(deductions.length).toBe(4);
    const pf = deductions.find((d) => d.component_name === 'PF');
    expect(pf?.percentage).toBe(12.0);
    expect(pf?.notice_text).toContain('Verify with your accountant before activating');
  });

  it('computes monthly payroll using C++ statutory engine and generates locked payslips', async () => {
    const run = await runPayroll(outletId, 10, 2026, managerUserId);

    expect(run.status).toBe('draft');
    expect(run.month).toBe(10);
    expect(run.year).toBe(2026);
    expect(run.total_gross_paise).toBeGreaterThan(0);
    expect(run.total_deductions_paise).toBeGreaterThan(0);
    expect(run.total_net_paise).toBe(run.total_gross_paise - run.total_deductions_paise);

    // Payslips
    expect(run.payslips.length).toBe(3);

    // Head Chef Payslip: Base Rs 60,000
    const chefSlip = run.payslips.find((p) => p.employee_id === chefEmpId);
    expect(chefSlip).toBeDefined();
    expect(chefSlip?.gross_salary_paise).toBe(6000000);
    expect(chefSlip?.pf_deduction_paise).toBe(Math.round(6000000 * 0.12)); // 12% PF = Rs 7,200 (720,000 paise)
    expect(chefSlip?.pt_deduction_paise).toBe(20000);                      // Rs 200 PT
    expect(chefSlip?.net_salary_paise).toBeLessThan(6000000);

    // Approve the payroll run
    const approved = await approvePayrollRun(run.id, managerUserId);
    expect(approved.status).toBe('approved');

    // Attempting to run duplicate payroll for same month/year must be rejected
    await expect(runPayroll(outletId, 10, 2026, managerUserId)).rejects.toThrow('already been run');
  });
});
