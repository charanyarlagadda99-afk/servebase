import type pg from 'pg';
import { query, withTransaction } from '../db/pool.js';
import { recordAudit } from './audit.js';

export interface StandardAccount {
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
}

export const STANDARD_CHART_OF_ACCOUNTS: StandardAccount[] = [
  // 1000s: Assets
  { code: '1010', name: 'Cash on Hand', type: 'asset' },
  { code: '1020', name: 'Bank Clearing Account', type: 'asset' },
  { code: '1030', name: 'Accounts Receivable', type: 'asset' },
  { code: '1040', name: 'Inventory Asset', type: 'asset' },

  // 2000s: Liabilities
  { code: '2010', name: 'Accounts Payable', type: 'liability' },
  { code: '2020', name: 'Output CGST Payable', type: 'liability' },
  { code: '2030', name: 'Output SGST Payable', type: 'liability' },
  { code: '2040', name: 'Tips & Gratuity Payable', type: 'liability' },
  { code: '2050', name: 'Statutory Payroll Liabilities', type: 'liability' },

  // 3000s: Equity
  { code: '3010', name: 'Owners Capital', type: 'equity' },
  { code: '3020', name: 'Retained Earnings', type: 'equity' },

  // 4000s: Revenue
  { code: '4010', name: 'Food Sales Revenue', type: 'revenue' },
  { code: '4020', name: 'Beverage Sales Revenue', type: 'revenue' },
  { code: '4030', name: 'Service Charge Income', type: 'revenue' },
  { code: '4040', name: 'Round-off Gain/Loss', type: 'revenue' },

  // 5000s: Cost of Goods Sold
  { code: '5010', name: 'Food Cost of Goods Sold', type: 'expense' },
  { code: '5020', name: 'Beverage Cost of Goods Sold', type: 'expense' },

  // 6000s: Operating Expenses
  { code: '6010', name: 'Salaries & Wages Expense', type: 'expense' },
  { code: '6020', name: 'Spoilage & Wastage Expense', type: 'expense' },
  { code: '6030', name: 'Rent & Utilities Expense', type: 'expense' },
];

export async function initStandardChartOfAccounts(organizationId: string) {
  return withTransaction(async (client) => {
    for (const acc of STANDARD_CHART_OF_ACCOUNTS) {
      await client.query(
        `INSERT INTO chart_of_accounts (organization_id, account_code, account_name, account_type)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (account_code) DO NOTHING`,
        [organizationId, acc.code, acc.name, acc.type]
      );
    }
    const res = await client.query(
      `SELECT * FROM chart_of_accounts WHERE organization_id = $1 ORDER BY account_code ASC`,
      [organizationId]
    );
    return res.rows;
  });
}

export interface JournalLineInput {
  account_code: string;
  debit_paise: number;
  credit_paise: number;
}

export interface CreateJournalEntryInput {
  outlet_id: string;
  business_date: string;
  entry_type: 'sale' | 'consumption' | 'purchase' | 'payroll' | 'expense' | 'manual';
  narration: string;
  reference_id?: string;
  lines: JournalLineInput[];
}

export async function createJournalEntry(input: CreateJournalEntryInput, existingClient?: pg.PoolClient) {
  const execute = async (client: pg.PoolClient) => {
    // 1. Invariant Validation: Total Debits MUST Equal Total Credits exactly!
    let totalDebits = 0;
    let totalCredits = 0;

    for (const line of input.lines) {
      if (line.debit_paise < 0 || line.credit_paise < 0) {
        throw new Error('Debit and credit amounts cannot be negative');
      }
      totalDebits += line.debit_paise;
      totalCredits += line.credit_paise;
    }

    if (totalDebits !== totalCredits) {
      throw new Error(
        `Unbalanced journal entry: Total debits (${totalDebits} paise) != Total credits (${totalCredits} paise)`
      );
    }

    if (totalDebits === 0) {
      throw new Error('Journal entry cannot be zero');
    }

    // 2. Resolve account IDs from account codes
    const codes = input.lines.map((l) => l.account_code);
    const accRes = await client.query(
      `SELECT id, account_code FROM chart_of_accounts WHERE account_code = ANY($1)`,
      [codes]
    );
    const accMap = new Map(accRes.rows.map((r) => [r.account_code, r.id]));

    for (const code of codes) {
      if (!accMap.has(code)) {
        throw new Error(`Account code '${code}' not found in chart of accounts`);
      }
    }

    // 3. Generate sequential entry number
    const countRes = await client.query(
      `SELECT COUNT(id) as count FROM journal_entries WHERE outlet_id = $1`,
      [input.outlet_id]
    );
    const seq = Number(countRes.rows[0].count) + 1;
    const entryNumber = `JE-${String(seq).padStart(6, '0')}`;

    // 4. Insert header
    const jeRes = await client.query(
      `INSERT INTO journal_entries (
        outlet_id, business_date, entry_number, entry_type, reference_id, narration
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        input.outlet_id,
        input.business_date,
        entryNumber,
        input.entry_type,
        input.reference_id || null,
        input.narration,
      ]
    );
    const entry = jeRes.rows[0];

    // 5. Insert lines
    const insertedLines = [];
    for (const line of input.lines) {
      const lineRes = await client.query(
        `INSERT INTO journal_lines (journal_entry_id, account_id, debit_paise, credit_paise)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [entry.id, accMap.get(line.account_code), line.debit_paise, line.credit_paise]
      );
      insertedLines.push({
        ...lineRes.rows[0],
        account_code: line.account_code,
        debit_paise: Number(lineRes.rows[0].debit_paise),
        credit_paise: Number(lineRes.rows[0].credit_paise),
      });
    }

    return {
      ...entry,
      total_paise: totalDebits,
      lines: insertedLines,
    };
  };

  if (existingClient) {
    return execute(existingClient);
  }
  return withTransaction(execute);
}

export async function postDayCloseSalesJournal(outletId: string, dayCloseId: string) {
  return withTransaction(async (client) => {
    const dcRes = await client.query(`SELECT * FROM day_closes WHERE id = $1`, [dayCloseId]);
    if (dcRes.rows.length === 0) throw new Error('Day close record not found');
    const dc = dcRes.rows[0];
    const report = dc.summary_data;

    // Determine collections by payment mode
    let cashPaid = 0;
    let bankPaid = 0;

    for (const pmt of report.sales_by_payment_mode || []) {
      const amt = Number(pmt.total_paise);
      if (pmt.payment_method === 'cash') {
        cashPaid += amt;
      } else {
        bankPaid += amt;
      }
    }

    // Output GST
    let totalCgst = 0;
    let totalSgst = 0;
    for (const slab of report.tax_by_slab || []) {
      totalCgst += Number(slab.cgst_paise);
      totalSgst += Number(slab.sgst_paise);
    }

    const netTaxableSales = Number(report.taxable_sales_paise || report.net_sales_paise || 0);
    const serviceCharge = Number(report.total_service_charge_paise || 0);
    const tips = Number(report.total_tips_paise || 0);
    const roundOff = Number(report.total_round_off_paise || 0);

    const lines: JournalLineInput[] = [];

    // DEBITS: Assets received
    if (cashPaid > 0) {
      lines.push({ account_code: '1010', debit_paise: cashPaid, credit_paise: 0 });
    }
    if (bankPaid > 0) {
      lines.push({ account_code: '1020', debit_paise: bankPaid, credit_paise: 0 });
    }

    // CREDITS: Revenue & Liabilities
    if (netTaxableSales > 0) {
      lines.push({ account_code: '4010', debit_paise: 0, credit_paise: netTaxableSales });
    }
    if (totalCgst > 0) {
      lines.push({ account_code: '2020', debit_paise: 0, credit_paise: totalCgst });
    }
    if (totalSgst > 0) {
      lines.push({ account_code: '2030', debit_paise: 0, credit_paise: totalSgst });
    }
    if (serviceCharge > 0) {
      lines.push({ account_code: '4030', debit_paise: 0, credit_paise: serviceCharge });
    }
    if (tips > 0) {
      lines.push({ account_code: '2040', debit_paise: 0, credit_paise: tips });
    }

    // Reconcile debits and credits with round off
    const dSum = lines.reduce((s, l) => s + l.debit_paise, 0);
    const cSum = lines.reduce((s, l) => s + l.credit_paise, 0);
    const diff = dSum - cSum;

    if (diff > 0) {
      lines.push({ account_code: '4040', debit_paise: 0, credit_paise: diff });
    } else if (diff < 0) {
      lines.push({ account_code: '4040', debit_paise: Math.abs(diff), credit_paise: 0 });
    }

    return createJournalEntry(
      {
        outlet_id: outletId,
        business_date: dc.business_date,
        entry_type: 'sale',
        reference_id: dayCloseId,
        narration: `Automated sales journal posting for Day Close on ${dc.business_date}`,
        lines,
      },
      client
    );
  });
}

export async function postInventoryConsumptionJournal(outletId: string, businessDate: string) {
  return withTransaction(async (client) => {
    const costRes = await client.query(
      `SELECT COALESCE(SUM(total_value_paise), 0) as total_cogs_paise 
       FROM stock_ledger 
       WHERE outlet_id = $1 AND business_date = $2 AND movement_type = 'sale_consumption'`,
      [outletId, businessDate]
    );

    const cogsPaise = Math.abs(Number(costRes.rows[0].total_cogs_paise));
    if (cogsPaise === 0) return null;

    const lines: JournalLineInput[] = [
      { account_code: '5010', debit_paise: cogsPaise, credit_paise: 0 }, // DR Food COGS
      { account_code: '1040', debit_paise: 0, credit_paise: cogsPaise }, // CR Inventory Asset
    ];

    return createJournalEntry(
      {
        outlet_id: outletId,
        business_date: businessDate,
        entry_type: 'consumption',
        narration: `Daily inventory food consumption COGS posting for ${businessDate}`,
        lines,
      },
      client
    );
  });
}

export async function postPayrollJournal(outletId: string, payrollRunId: string) {
  return withTransaction(async (client) => {
    const prRes = await client.query(`SELECT * FROM payroll_runs WHERE id = $1`, [payrollRunId]);
    if (prRes.rows.length === 0) throw new Error('Payroll run not found');
    const run = prRes.rows[0];

    const gross = Number(run.total_gross_paise);
    const deductions = Number(run.total_deductions_paise);
    const net = Number(run.total_net_paise);

    const lines: JournalLineInput[] = [
      { account_code: '6010', debit_paise: gross, credit_paise: 0 },         // DR Salaries Expense
      { account_code: '1020', debit_paise: 0, credit_paise: net },           // CR Bank Clearing (Net Salary)
      { account_code: '2050', debit_paise: 0, credit_paise: deductions },    // CR Statutory Liabilities (PF/ESI/PT)
    ];

    const dateStr = `${run.year}-${String(run.month).padStart(2, '0')}-01`;

    return createJournalEntry(
      {
        outlet_id: outletId,
        business_date: dateStr,
        entry_type: 'payroll',
        reference_id: payrollRunId,
        narration: `Automated payroll journal entry for month ${run.month}/${run.year}`,
        lines,
      },
      client
    );
  });
}

export async function getTrialBalance(organizationId: string) {
  const sql = `
    SELECT 
      coa.account_code,
      coa.account_name,
      coa.account_type,
      COALESCE(SUM(jl.debit_paise), 0) as total_debit_paise,
      COALESCE(SUM(jl.credit_paise), 0) as total_credit_paise
    FROM chart_of_accounts coa
    LEFT JOIN journal_lines jl ON jl.account_id = coa.id
    WHERE coa.organization_id = $1
    GROUP BY coa.id, coa.account_code, coa.account_name, coa.account_type
    ORDER BY coa.account_code ASC
  `;

  const res = await query(sql, [organizationId]);
  let sumDebits = 0;
  let sumCredits = 0;

  const rows = res.rows.map((r) => {
    const debit = Number(r.total_debit_paise);
    const credit = Number(r.total_credit_paise);
    sumDebits += debit;
    sumCredits += credit;

    return {
      account_code: r.account_code,
      account_name: r.account_name,
      account_type: r.account_type,
      debit_paise: debit,
      credit_paise: credit,
      net_balance_paise: debit - credit,
    };
  });

  return {
    is_balanced: sumDebits === sumCredits,
    total_debits_paise: sumDebits,
    total_credits_paise: sumCredits,
    accounts: rows,
  };
}

export async function getFlashPL(organizationId: string) {
  const sql = `
    SELECT 
      coa.account_code,
      coa.account_name,
      coa.account_type,
      COALESCE(SUM(jl.credit_paise - jl.debit_paise), 0) as revenue_balance_paise,
      COALESCE(SUM(jl.debit_paise - jl.credit_paise), 0) as expense_balance_paise
    FROM chart_of_accounts coa
    LEFT JOIN journal_lines jl ON jl.account_id = coa.id
    WHERE coa.organization_id = $1 AND coa.account_type IN ('revenue', 'expense')
    GROUP BY coa.id, coa.account_code, coa.account_name, coa.account_type
    ORDER BY coa.account_code ASC
  `;

  const res = await query(sql, [organizationId]);

  let totalRevenuePaise = 0;
  let totalCogsPaise = 0;
  let totalOpexPaise = 0;

  const lineItems = [];
  for (const r of res.rows) {
    if (r.account_type === 'revenue') {
      const amt = Number(r.revenue_balance_paise);
      totalRevenuePaise += amt;
      lineItems.push({
        category: 'revenue',
        code: r.account_code,
        name: r.account_name,
        amount_paise: amt,
      });
    } else if (r.account_code.startsWith('50')) {
      // COGS
      const amt = Number(r.expense_balance_paise);
      totalCogsPaise += amt;
      lineItems.push({
        category: 'cogs',
        code: r.account_code,
        name: r.account_name,
        amount_paise: amt,
      });
    } else {
      // Operating Expense
      const amt = Number(r.expense_balance_paise);
      totalOpexPaise += amt;
      lineItems.push({
        category: 'operating_expense',
        code: r.account_code,
        name: r.account_name,
        amount_paise: amt,
      });
    }
  }

  const grossProfitPaise = totalRevenuePaise - totalCogsPaise;
  const netIncomePaise = grossProfitPaise - totalOpexPaise;
  const grossMarginPercent = totalRevenuePaise > 0 ? (grossProfitPaise / totalRevenuePaise) * 100 : 0;
  const netMarginPercent = totalRevenuePaise > 0 ? (netIncomePaise / totalRevenuePaise) * 100 : 0;

  return {
    total_revenue_paise: totalRevenuePaise,
    total_cogs_paise: totalCogsPaise,
    gross_profit_paise: grossProfitPaise,
    gross_margin_percent: Math.round(grossMarginPercent * 100) / 100,
    total_operating_expenses_paise: totalOpexPaise,
    net_operating_income_paise: netIncomePaise,
    net_margin_percent: Math.round(netMarginPercent * 100) / 100,
    lines: lineItems,
  };
}
