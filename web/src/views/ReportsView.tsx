import React, { useState } from 'react';
import { SystemAlert, ZReportSummary } from '../types';
import { formatRupees } from '../utils/currency';
import { 
  FileSpreadsheet, ShieldAlert, CheckCircle2, TrendingUp, 
  Calendar, Lock, AlertTriangle, ArrowRight, ShieldCheck, 
  DollarSign, PieChart, Landmark
} from 'lucide-react';

interface ReportsViewProps {
  alerts: SystemAlert[];
  onResolveAlert: (alertId: string) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  alerts,
  onResolveAlert
}) => {
  const [activeTab, setActiveTab] = useState<'zreport' | 'pnl' | 'audit' | 'alerts'>('zreport');
  const [dayCloseDone, setDayCloseDone] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Sample Z-report numbers
  const zReportData: ZReportSummary = {
    business_date: '2026-10-02',
    outlet_name: 'ServeBase Flagship Bistro & Bar',
    closed_at: '23:45:00 IST',
    gross_sales: 34850000, // ₹3,48,500.00
    discounts: 1742500,    // ₹17,425.00
    net_sales: 33107500,    // ₹3,31,075.00
    taxes: {
      cgst: 827687,         // ₹8,276.87
      sgst: 827687,         // ₹8,276.87
      igst: 0,
      vat: 0,
    },
    settlements: {
      cash: 6540000,
      card: 14200000,
      upi: 12150000,
      room_folio: 1960000,
    },
    total_bills: 142,
    total_covers: 388,
    average_bill_value: 245400,
    void_amount: 320000,
  };

  // Double-entry Flash P&L data
  const pnlData = {
    revenue: {
      food_sales: 245000000,
      beverage_sales: 98000000,
      room_service: 22000000,
      total_revenue: 365000000, // ₹36,50,000
    },
    cogs: {
      meat_poultry: 42000000,
      dairy_produce: 31000000,
      dry_groceries: 24000000,
      beverages_cost: 18000000,
      total_cogs: 115000000, // 31.5% food cost ratio
    },
    gross_profit: 250000000,
    operating_expenses: {
      staff_payroll: 85000000,
      utilities_power: 18000000,
      maintenance: 9500000,
      packaging_supplies: 6500000,
      total_opex: 119000000,
    },
    net_ebitda: 131000000, // 35.8% EBITDA
  };

  const handleRunDayClose = () => {
    setDayCloseDone(true);
    setToastMsg('Day close Z-Report generated and locked! General Ledger journals posted, business date advanced to 2026-10-03.');
    setTimeout(() => setToastMsg(null), 4500);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FBF9F6] overflow-hidden">
      {/* TOAST MESSAGE */}
      {toastMsg && (
        <div className="bg-[#2D5A27] text-white px-6 py-2.5 flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{toastMsg}</span>
          </div>
          <button onClick={() => setToastMsg(null)}>✕</button>
        </div>
      )}

      {/* HEADER BAR */}
      <div className="bg-white border-b border-[#E7E2DC] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-serif text-[#1C1917]">Back-Office Analytics & Financials</h1>
          <p className="text-xs text-[#8C827A]">Z-Report Day Close, Flash P&L, Audit Hash-Chain & Alerts</p>
        </div>

        {/* SUB-TABS */}
        <div className="flex bg-[#FAF8F5] border border-[#E7E2DC] rounded-lg p-1">
          {[
            { id: 'zreport', label: 'Z-Report Day Close' },
            { id: 'pnl', label: 'Flash P&L & Ledger' },
            { id: 'audit', label: 'SHA-256 Audit Log' },
            { id: 'alerts', label: `System Alerts (${alerts.filter(a => !a.resolved).length})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeTab === tab.id
                  ? 'bg-white shadow-xs text-[#1C1917]'
                  : 'text-[#8C827A] hover:text-[#1C1917]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: Z-REPORT DAY CLOSE */}
      {activeTab === 'zreport' && (
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white border border-[#E7E2DC] rounded-xl p-6 shadow-xs">
              <div className="flex items-start justify-between border-b border-[#E7E2DC] pb-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#D9531E]">Daily Business Close</span>
                    <span className="text-xs bg-[#2D5A27]/10 text-[#2D5A27] px-2 py-0.5 rounded font-mono font-bold">
                      GST Section 31 Consecutive Invoice Series
                    </span>
                  </div>
                  <h2 className="text-lg font-bold font-serif text-[#1C1917] mt-1">{zReportData.outlet_name}</h2>
                  <p className="text-xs text-[#8C827A]">Business Date: {zReportData.business_date} • Session: Lunch & Dinner</p>
                </div>

                <div className="text-right">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full uppercase ${
                    dayCloseDone ? 'bg-[#2D5A27] text-white' : 'bg-amber-100 text-amber-800'
                  }`}>
                    <Lock className="w-3.5 h-3.5" />
                    {dayCloseDone ? 'DAY SEALED (Z-REPORT LOCKED)' : 'SHIFT ACTIVE (PENDING Z-CLOSE)'}
                  </span>
                </div>
              </div>

              {/* SALES SUMMARY METRICS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#E7E2DC]">
                  <span className="text-[10px] font-bold uppercase text-[#8C827A] block">Gross Revenue</span>
                  <span className="text-lg font-bold font-serif text-[#1C1917]">{formatRupees(zReportData.gross_sales)}</span>
                </div>
                <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#E7E2DC]">
                  <span className="text-[10px] font-bold uppercase text-[#8C827A] block">Discounts Given</span>
                  <span className="text-lg font-bold font-serif text-red-700">-{formatRupees(zReportData.discounts)}</span>
                </div>
                <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#E7E2DC]">
                  <span className="text-[10px] font-bold uppercase text-[#8C827A] block">Net Revenue</span>
                  <span className="text-lg font-bold font-serif text-[#2D5A27]">{formatRupees(zReportData.net_sales)}</span>
                </div>
                <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#E7E2DC]">
                  <span className="text-[10px] font-bold uppercase text-[#8C827A] block">Tax Collected (5% GST)</span>
                  <span className="text-lg font-bold font-serif text-[#D9531E]">
                    {formatRupees(zReportData.taxes.cgst + zReportData.taxes.sgst)}
                  </span>
                </div>
              </div>

              {/* SETTLEMENT TENDERS */}
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#8C827A] mb-3">Tender Reconciliation</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="border border-[#E7E2DC] p-3 rounded-xl">
                  <span className="text-xs text-[#8C827A] block">UPI / QR Codes</span>
                  <span className="text-sm font-bold font-mono text-[#1C1917]">{formatRupees(zReportData.settlements.upi)}</span>
                </div>
                <div className="border border-[#E7E2DC] p-3 rounded-xl">
                  <span className="text-xs text-[#8C827A] block">Credit / Debit Cards</span>
                  <span className="text-sm font-bold font-mono text-[#1C1917]">{formatRupees(zReportData.settlements.card)}</span>
                </div>
                <div className="border border-[#E7E2DC] p-3 rounded-xl">
                  <span className="text-xs text-[#8C827A] block">Cash Tally in Drawer</span>
                  <span className="text-sm font-bold font-mono text-[#1C1917]">{formatRupees(zReportData.settlements.cash)}</span>
                </div>
                <div className="border border-[#E7E2DC] p-3 rounded-xl">
                  <span className="text-xs text-[#8C827A] block">Hotel Folio Postings</span>
                  <span className="text-sm font-bold font-mono text-[#1C1917]">{formatRupees(zReportData.settlements.room_folio)}</span>
                </div>
              </div>

              {/* ACTION BUTTON */}
              <div className="pt-4 border-t border-[#E7E2DC] flex items-center justify-between">
                <div className="text-xs text-[#8C827A]">
                  Pre-requisites: 0 open tables, 0 in-flight KOTs, denomination physically counted.
                </div>
                <button
                  disabled={dayCloseDone}
                  onClick={handleRunDayClose}
                  className="bg-[#1C1917] hover:bg-black text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Lock className="w-4 h-4 text-[#D9531E]" />
                  {dayCloseDone ? 'Day Closed & Archived' : 'Execute Day Close & Print Z-Report'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FLASH P&L & GENERAL LEDGER */}
      {activeTab === 'pnl' && (
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white border border-[#E7E2DC] rounded-xl p-6 shadow-xs">
              <div className="flex items-center justify-between border-b border-[#E7E2DC] pb-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-[#2D5A27]" />
                    <h2 className="text-lg font-bold font-serif text-[#1C1917]">Double-Entry General Ledger Flash P&L</h2>
                  </div>
                  <p className="text-xs text-[#8C827A]">Strict Invariant: Debits = Credits verified across all automated journals</p>
                </div>
                <span className="text-xs bg-[#2D5A27]/10 text-[#2D5A27] font-bold px-3 py-1 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Trial Balance: Balanced (₹0.00 Diff)
                </span>
              </div>

              {/* REVENUE SECTION */}
              <div className="space-y-2 mb-6">
                <div className="flex justify-between font-bold text-sm text-[#1C1917] border-b border-[#E7E2DC] pb-1">
                  <span>Operating Revenue</span>
                  <span>{formatRupees(pnlData.revenue.total_revenue)}</span>
                </div>
                <div className="flex justify-between text-xs text-[#8C827A] pl-4">
                  <span>Food Sales (Dine-In + Takeaway)</span>
                  <span>{formatRupees(pnlData.revenue.food_sales)}</span>
                </div>
                <div className="flex justify-between text-xs text-[#8C827A] pl-4">
                  <span>Bar & Beverage Sales</span>
                  <span>{formatRupees(pnlData.revenue.beverage_sales)}</span>
                </div>
                <div className="flex justify-between text-xs text-[#8C827A] pl-4">
                  <span>In-Room Dining (Hotel PMS)</span>
                  <span>{formatRupees(pnlData.revenue.room_service)}</span>
                </div>
              </div>

              {/* COGS SECTION */}
              <div className="space-y-2 mb-6">
                <div className="flex justify-between font-bold text-sm text-red-900 border-b border-[#E7E2DC] pb-1">
                  <span>Cost of Goods Sold (COGS - 31.5%)</span>
                  <span>-{formatRupees(pnlData.cogs.total_cogs)}</span>
                </div>
                <div className="flex justify-between text-xs text-[#8C827A] pl-4">
                  <span>Meat & Poultry Usage</span>
                  <span>-{formatRupees(pnlData.cogs.meat_poultry)}</span>
                </div>
                <div className="flex justify-between text-xs text-[#8C827A] pl-4">
                  <span>Dairy, Paneer & Fresh Produce</span>
                  <span>-{formatRupees(pnlData.cogs.dairy_produce)}</span>
                </div>
                <div className="flex justify-between text-xs text-[#8C827A] pl-4">
                  <span>Dry Groceries & Spices</span>
                  <span>-{formatRupees(pnlData.cogs.dry_groceries)}</span>
                </div>
              </div>

              {/* GROSS PROFIT */}
              <div className="bg-[#FAF8F5] p-3 rounded-xl flex justify-between font-bold text-sm text-[#1C1917] mb-6">
                <span>Gross Operating Profit (68.5% margin)</span>
                <span className="font-serif text-[#2D5A27]">{formatRupees(pnlData.gross_profit)}</span>
              </div>

              {/* OPERATING EXPENSES */}
              <div className="space-y-2 mb-6">
                <div className="flex justify-between font-bold text-sm text-red-900 border-b border-[#E7E2DC] pb-1">
                  <span>Operating Expenses (OPEX)</span>
                  <span>-{formatRupees(pnlData.operating_expenses.total_opex)}</span>
                </div>
                <div className="flex justify-between text-xs text-[#8C827A] pl-4">
                  <span>Staff Salaries & Statutory Payroll (PF/ESI/PT)</span>
                  <span>-{formatRupees(pnlData.operating_expenses.staff_payroll)}</span>
                </div>
                <div className="flex justify-between text-xs text-[#8C827A] pl-4">
                  <span>Utilities, Power & Commercial Gas</span>
                  <span>-{formatRupees(pnlData.operating_expenses.utilities_power)}</span>
                </div>
                <div className="flex justify-between text-xs text-[#8C827A] pl-4">
                  <span>Repairs & Kitchen Maintenance</span>
                  <span>-{formatRupees(pnlData.operating_expenses.maintenance)}</span>
                </div>
              </div>

              {/* NET EBITDA */}
              <div className="bg-[#1C1917] text-white p-4 rounded-xl flex justify-between items-center">
                <div>
                  <span className="text-xs uppercase font-bold tracking-wider text-[#D9531E] block">Net Operating EBITDA</span>
                  <span className="text-xs text-white/70">After inventory variance and statutory deductions</span>
                </div>
                <span className="text-xl font-bold font-serif text-white">{formatRupees(pnlData.net_ebitda)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SHA-256 AUDIT LOG */}
      {activeTab === 'audit' && (
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="bg-white border border-[#E7E2DC] rounded-xl p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E7E2DC]">
                <div>
                  <h3 className="text-sm font-bold text-[#1C1917]">Tamper-Evident SHA-256 Audit Trail</h3>
                  <p className="text-xs text-[#8C827A]">Linear cryptographic hash-chain tracking every invoice, void, and price modification</p>
                </div>
                <span className="text-xs bg-[#2D5A27]/10 text-[#2D5A27] font-bold px-3 py-1 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Chain Integrity Verified (No Gaps)
                </span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                {[
                  {
                    seq: 4289,
                    event: 'INVOICE_GENERATED',
                    doc: 'INV-20261002-0142',
                    amount: '₹2,850.00',
                    hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
                    prevHash: '8fabb4386927a4d5e9b8f2d5914652c502b48995a9e048756c66d2139e8020aa',
                    user: 'Priya Patel (Cashier)'
                  },
                  {
                    seq: 4288,
                    event: 'FOLIO_CHARGE_POSTED',
                    doc: 'FOL-801 (Room 101)',
                    amount: '₹1,450.00',
                    hash: '8fabb4386927a4d5e9b8f2d5914652c502b48995a9e048756c66d2139e8020aa',
                    prevHash: 'c841bcc812034981792873491823791283719283719283719283719283719283',
                    user: 'Rahul Sharma (Captain)'
                  },
                  {
                    seq: 4287,
                    event: 'STOCK_VARIANCE_RECORDED',
                    doc: 'RAW-MEAT-01 (Cycle Count)',
                    amount: '-₹3,200.00',
                    hash: 'c841bcc812034981792873491823791283719283719283719283719283719283',
                    prevHash: 'd5f9dac485918273948192837192837192837192837192837192837192837192',
                    user: 'Chef Harinder Singh'
                  }
                ].map(entry => (
                  <div key={entry.seq} className="border border-[#E7E2DC] rounded-lg p-3 bg-[#FAF8F5]">
                    <div className="flex justify-between items-center text-[11px] mb-1">
                      <span className="font-bold text-[#1C1917]">Sequence #{entry.seq} • {entry.event}</span>
                      <span className="text-[#8C827A]">{entry.user}</span>
                    </div>
                    <div className="text-[10px] text-[#8C827A] space-y-0.5">
                      <div>Document: <strong>{entry.doc}</strong> ({entry.amount})</div>
                      <div className="truncate">Hash: <span className="text-[#2D5A27]">{entry.hash}</span></div>
                      <div className="truncate">PrevHash: <span className="text-[#8C827A]">{entry.prevHash}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SYSTEM ALERTS */}
      {activeTab === 'alerts' && (
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-3">
            {alerts.map(alert => (
              <div
                key={alert.id}
                className={`p-4 rounded-xl border flex items-start justify-between transition-all ${
                  alert.resolved ? 'bg-white border-[#E7E2DC] opacity-60' :
                  alert.severity === 'critical' ? 'bg-red-50 border-red-200' :
                  alert.severity === 'warning' ? 'bg-amber-50 border-amber-200' :
                  'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`w-4 h-4 mt-0.5 ${
                    alert.severity === 'critical' ? 'text-red-600' :
                    alert.severity === 'warning' ? 'text-amber-600' : 'text-blue-600'
                  }`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-[#1C1917]">{alert.title}</h4>
                      <span className="text-[10px] font-mono text-[#8C827A]">{alert.timestamp}</span>
                    </div>
                    <p className="text-xs text-[#8C827A] mt-1">{alert.message}</p>
                  </div>
                </div>

                {!alert.resolved && (
                  <button
                    onClick={() => onResolveAlert(alert.id)}
                    className="text-xs bg-white border border-[#E7E2DC] hover:border-gray-400 px-3 py-1.5 rounded-lg font-semibold text-[#1C1917]"
                  >
                    Acknowledge
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
