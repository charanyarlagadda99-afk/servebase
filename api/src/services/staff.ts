import { query, withTransaction } from '../db/pool.js';
import { corePool } from './core-pool.js';
import { recordAudit } from './audit.js';

export interface CreateEmployeeInput {
  outlet_id: string;
  user_id?: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  role: 'manager' | 'cashier' | 'head_chef' | 'line_cook' | 'waiter' | 'busser' | 'bartender';
  phone?: string;
  email?: string;
  salary_type?: 'monthly' | 'hourly';
  base_rate_paise: number;
}

export async function createEmployee(input: CreateEmployeeInput) {
  const res = await query(
    `INSERT INTO employees (
      outlet_id, user_id, employee_code, first_name, last_name,
      role, phone, email, salary_type, base_rate_paise
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      input.outlet_id,
      input.user_id || null,
      input.employee_code,
      input.first_name,
      input.last_name,
      input.role,
      input.phone || null,
      input.email || null,
      input.salary_type || 'monthly',
      input.base_rate_paise,
    ]
  );
  return {
    ...res.rows[0],
    base_rate_paise: Number(res.rows[0].base_rate_paise),
  };
}

export async function getEmployees(outletId: string) {
  let res = await query(
    `SELECT * FROM employees WHERE outlet_id = $1 AND deleted_at IS NULL ORDER BY first_name ASC`,
    [outletId]
  );
  if (res.rows.length === 0) {
    res = await query(
      `SELECT * FROM employees WHERE deleted_at IS NULL ORDER BY first_name ASC`
    );
  }
  return res.rows.map((r) => ({
    ...r,
    full_name: `${r.first_name} ${r.last_name || ''}`.trim(),
    role_name: r.role,
    base_salary_paise: Number(r.base_rate_paise),
    base_rate_paise: Number(r.base_rate_paise),
  }));
}

export async function createStaffShift(
  outletId: string,
  name: string,
  startTime: string, // e.g. "08:00:00"
  endTime: string   // e.g. "16:30:00"
) {
  const res = await query(
    `INSERT INTO staff_shifts (outlet_id, name, start_time, end_time)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [outletId, name, startTime, endTime]
  );
  return res.rows[0];
}

export async function assignRoster(
  outletId: string,
  employeeId: string,
  shiftId: string,
  workDate: string
) {
  const res = await query(
    `INSERT INTO staff_roster (outlet_id, employee_id, shift_id, work_date, status)
     VALUES ($1, $2, $3, $4, 'scheduled')
     ON CONFLICT (employee_id, work_date)
     DO UPDATE SET shift_id = EXCLUDED.shift_id, status = 'scheduled'
     RETURNING *`,
    [outletId, employeeId, shiftId, workDate]
  );
  return res.rows[0];
}

export async function clockIn(
  outletId: string,
  employeeId: string,
  workDate: string,
  clockInTime: Date = new Date()
) {
  return withTransaction(async (client) => {
    // Check if shift scheduled to check late flag
    const rosterRes = await client.query(
      `SELECT r.*, s.start_time 
       FROM staff_roster r
       JOIN staff_shifts s ON s.id = r.shift_id
       WHERE r.employee_id = $1 AND r.work_date = $2`,
      [employeeId, workDate]
    );

    let isLate = false;
    if (rosterRes.rows.length > 0) {
      const scheduledStartStr = rosterRes.rows[0].start_time; // e.g. "08:00:00"
      const [shHour, shMin] = scheduledStartStr.split(':').map(Number);
      const scheduledDate = new Date(clockInTime);
      scheduledDate.setHours(shHour, shMin, 0, 0);

      // Grace period of 15 minutes
      const graceThreshold = new Date(scheduledDate.getTime() + 15 * 60 * 1000);
      if (clockInTime.getTime() > graceThreshold.getTime()) {
        isLate = true;
      }
    }

    const res = await client.query(
      `INSERT INTO attendance (
        outlet_id, employee_id, work_date, clock_in, is_late, status
      ) VALUES ($1, $2, $3, $4, $5, 'present')
      ON CONFLICT (employee_id, work_date)
      DO UPDATE SET clock_in = EXCLUDED.clock_in, is_late = EXCLUDED.is_late
      RETURNING *`,
      [outletId, employeeId, workDate, clockInTime, isLate]
    );

    return res.rows[0];
  });
}

export async function clockOut(
  outletId: string,
  employeeId: string,
  workDate: string,
  clockOutTime: Date = new Date(),
  breakMinutes = 0
) {
  return withTransaction(async (client) => {
    const attRes = await client.query(
      `SELECT * FROM attendance WHERE employee_id = $1 AND work_date = $2 FOR UPDATE`,
      [employeeId, workDate]
    );
    if (attRes.rows.length === 0) throw new Error('No clock-in record found for this work date');

    const rosterRes = await client.query(
      `SELECT r.*, s.end_time 
       FROM staff_roster r
       JOIN staff_shifts s ON s.id = r.shift_id
       WHERE r.employee_id = $1 AND r.work_date = $2`,
      [employeeId, workDate]
    );

    let isEarly = false;
    if (rosterRes.rows.length > 0) {
      const scheduledEndStr = rosterRes.rows[0].end_time; // e.g. "16:30:00"
      const [endHour, endMin] = scheduledEndStr.split(':').map(Number);
      const scheduledEndDate = new Date(clockOutTime);
      scheduledEndDate.setHours(endHour, endMin, 0, 0);

      // Early departure threshold of 15 minutes before shift end
      const earlyThreshold = new Date(scheduledEndDate.getTime() - 15 * 60 * 1000);
      if (clockOutTime.getTime() < earlyThreshold.getTime()) {
        isEarly = true;
      }
    }

    const res = await client.query(
      `UPDATE attendance 
       SET clock_out = $1, break_minutes = $2, is_early_departure = $3
       WHERE employee_id = $4 AND work_date = $5
       RETURNING *`,
      [clockOutTime, breakMinutes, isEarly, employeeId, workDate]
    );

    return res.rows[0];
  });
}

export async function configureStatutoryDeductions(
  outletId: string,
  components: Array<{
    component_name: 'PF' | 'ESI' | 'PT' | 'TDS';
    percentage?: number;
    flat_amount_paise?: number;
    is_active?: boolean;
  }>
) {
  return withTransaction(async (client) => {
    const results = [];
    for (const c of components) {
      const res = await client.query(
        `INSERT INTO statutory_deduction_rates (
          outlet_id, component_name, percentage, flat_amount_paise, is_active
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
        [
          outletId,
          c.component_name,
          c.percentage || 0.0,
          c.flat_amount_paise || 0,
          c.is_active ?? true,
        ]
      );
      results.push({
        ...res.rows[0],
        percentage: Number(res.rows[0].percentage),
        flat_amount_paise: Number(res.rows[0].flat_amount_paise),
      });
    }
    return results;
  });
}

export async function runPayroll(
  outletId: string,
  month: number,
  year: number,
  userId: string
) {
  return withTransaction(async (client) => {
    // 1. Check if already processed
    const existRes = await client.query(
      `SELECT * FROM payroll_runs WHERE outlet_id = $1 AND month = $2 AND year = $3`,
      [outletId, month, year]
    );
    if (existRes.rows.length > 0) {
      throw new Error(`Payroll for ${month}/${year} has already been run`);
    }

    // 2. Fetch active employees
    const empRes = await client.query(
      `SELECT * FROM employees WHERE outlet_id = $1 AND is_active = TRUE`,
      [outletId]
    );
    if (empRes.rows.length === 0) throw new Error('No active employees found in outlet');

    // 3. Fetch statutory deduction settings
    const statRes = await client.query(
      `SELECT * FROM statutory_deduction_rates WHERE outlet_id = $1 AND is_active = TRUE`,
      [outletId]
    );

    let pfRate = 0.0;
    let esiRate = 0.0;
    let ptFlat = 0;
    let tdsRate = 0.0;

    for (const s of statRes.rows) {
      if (s.component_name === 'PF') pfRate = Number(s.percentage);
      if (s.component_name === 'ESI') esiRate = Number(s.percentage);
      if (s.component_name === 'PT') ptFlat = Number(s.flat_amount_paise);
      if (s.component_name === 'TDS') tdsRate = Number(s.percentage);
    }

    // 4. Compute worked hours, overtime, and late occurrences for each employee
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const coreEmployees = [];
    for (const emp of empRes.rows) {
      const attRes = await client.query(
        `SELECT 
          COUNT(id) as present_days,
          COUNT(CASE WHEN is_late = TRUE THEN 1 END) as late_days,
          COALESCE(SUM(EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600.0 - (break_minutes / 60.0)), 0) as total_worked_hours
         FROM attendance
         WHERE employee_id = $1 AND work_date >= $2 AND work_date <= $3 AND clock_out IS NOT NULL`,
        [emp.id, startDate, endDate]
      );

      const stats = attRes.rows[0];
      const workedHours = Number(stats.total_worked_hours);
      const scheduledHours = 200.0; // standard 25 days * 8h

      let overtimeHours = 0.0;
      if (workedHours > scheduledHours) {
        overtimeHours = workedHours - scheduledHours;
      }

      // Late penalty: Rs 100 per late arrival beyond 2 grace occurrences
      const lateDays = Number(stats.late_days);
      const lateDeductionPaise = lateDays > 2 ? (lateDays - 2) * 10000 : 0;

      const effectiveWorkedHours = emp.salary_type === 'monthly' ? scheduledHours : workedHours;

      coreEmployees.push({
        employee_id: emp.id,
        salary_type: emp.salary_type,
        base_rate_paise: Number(emp.base_rate_paise),
        scheduled_hours: scheduledHours,
        worked_hours: effectiveWorkedHours,
        overtime_hours: overtimeHours,
        late_deduction_paise: lateDeductionPaise,
        advances_recovery_paise: 0,
      });
    }

    // 5. Call C++ compute_payroll engine
    const payrollPayload = {
      pf_rate_percent: pfRate,
      esi_rate_percent: esiRate,
      pt_flat_paise: ptFlat,
      tds_rate_percent: tdsRate,
      employees: coreEmployees,
    };

    const coreResult = await corePool.execute('compute_payroll', payrollPayload);

    // 6. Record payroll run
    const runRes = await client.query(
      `INSERT INTO payroll_runs (
        outlet_id, month, year, status, total_gross_paise,
        total_deductions_paise, total_net_paise
      ) VALUES ($1, $2, $3, 'draft', $4, $5, $6)
      RETURNING *`,
      [
        outletId,
        month,
        year,
        coreResult.total_gross_paise,
        coreResult.total_deductions_paise,
        coreResult.total_net_paise,
      ]
    );
    const run = runRes.rows[0];

    // 7. Insert payslips
    const payslipRecords = [];
    for (const p of coreResult.payslips) {
      const psRes = await client.query(
        `INSERT INTO payslips (
          payroll_run_id, employee_id, gross_salary_paise, pf_deduction_paise,
          esi_deduction_paise, pt_deduction_paise, tds_deduction_paise, net_salary_paise
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          run.id,
          p.employee_id,
          p.gross_paise,
          p.pf_deduction_paise,
          p.esi_deduction_paise,
          p.pt_deduction_paise,
          p.tds_deduction_paise,
          p.net_paise,
        ]
      );
      payslipRecords.push({
        ...psRes.rows[0],
        gross_salary_paise: Number(psRes.rows[0].gross_salary_paise),
        pf_deduction_paise: Number(psRes.rows[0].pf_deduction_paise),
        esi_deduction_paise: Number(psRes.rows[0].esi_deduction_paise),
        pt_deduction_paise: Number(psRes.rows[0].pt_deduction_paise),
        tds_deduction_paise: Number(psRes.rows[0].tds_deduction_paise),
        net_salary_paise: Number(psRes.rows[0].net_salary_paise),
      });
    }

    await recordAudit({
      outlet_id: outletId,
      user_id: userId,
      action: 'PAYROLL_RUN_GENERATE',
      entity_type: 'PAYROLL_RUN',
      entity_id: run.id,
      after_state: {
        month,
        year,
        total_gross_paise: coreResult.total_gross_paise,
        total_net_paise: coreResult.total_net_paise,
      },
    }, client);

    return {
      ...run,
      total_gross_paise: Number(run.total_gross_paise),
      total_deductions_paise: Number(run.total_deductions_paise),
      total_net_paise: Number(run.total_net_paise),
      payslips: payslipRecords,
    };
  });
}

export async function approvePayrollRun(payrollRunId: string, userId: string) {
  const res = await query(
    `UPDATE payroll_runs SET status = 'approved' WHERE id = $1 RETURNING *`,
    [payrollRunId]
  );
  if (res.rows.length === 0) throw new Error('Payroll run not found');
  return {
    ...res.rows[0],
    total_gross_paise: Number(res.rows[0].total_gross_paise),
    total_deductions_paise: Number(res.rows[0].total_deductions_paise),
    total_net_paise: Number(res.rows[0].total_net_paise),
  };
}
