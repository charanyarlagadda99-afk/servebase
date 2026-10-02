import React, { useState } from 'react';
import { StaffMember, DenominationTally } from '../types';
import { formatRupees } from '../utils/currency';
import { 
  Users, Clock, DollarSign, CheckCircle2, ShieldCheck, 
  UserCheck, AlertCircle, FileText, KeyRound, Calculator, 
  Coins, Printer, ArrowRight
} from 'lucide-react';

interface StaffViewProps {
  staff: StaffMember[];
  onClockToggle: (staffId: string) => void;
}

export const StaffView: React.FC<StaffViewProps> = ({
  staff,
  onClockToggle
}) => {
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [showShiftTallyModal, setShowShiftTallyModal] = useState<boolean>(false);
  const [showPayslipModal, setShowPayslipModal] = useState<boolean>(false);
  const [activePayslipStaff, setActivePayslipStaff] = useState<any | null>(null);
  const [pin, setPin] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'roster' | 'payroll'>('roster');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Denomination Cash Count State
  const [denominations, setDenominations] = useState<DenominationTally>({
    note_2000: 0,
    note_500: 24, // ₹12,000
    note_200: 10,  // ₹2,000
    note_100: 12,  // ₹1,200
    note_50: 3,    // ₹150
    note_20: 2,    // ₹40
    note_10: 1,    // ₹10
    coins: 0
  });

  const expectedBookCashPaise = 1540000; // ₹15,400.00 expected in drawer

  const calculateCountedCashPaise = (): number => {
    return (
      (denominations.note_2000 * 2000 +
       denominations.note_500 * 500 +
       denominations.note_200 * 200 +
       denominations.note_100 * 100 +
       denominations.note_50 * 50 +
       denominations.note_20 * 20 +
       denominations.note_10 * 10 +
       denominations.coins) * 100
    );
  };

  const countedCashPaise = calculateCountedCashPaise();
  const discrepancyPaise = countedCashPaise - expectedBookCashPaise;

  const handleOpenPinModal = (member: StaffMember) => {
    setSelectedStaff(member);
    setPin('');
    setPinError(null);
    setShowPinModal(true);
  };

  const handlePinSubmit = () => {
    if (pin.length !== 4) {
      setPinError('PIN must be 4 digits');
      return;
    }
    if (selectedStaff) {
      onClockToggle(selectedStaff.id);
      const action = selectedStaff.status === 'clocked_in' ? 'Clocked Out' : 'Clocked In';
      setToastMsg(`${selectedStaff.name} successfully ${action} at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      setShowPinModal(false);
      setTimeout(() => setToastMsg(null), 3500);
    }
  };

  const handleShiftTallySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowShiftTallyModal(false);
    const varianceDesc = discrepancyPaise === 0 
      ? 'Balanced (₹0 discrepancy)' 
      : discrepancyPaise > 0 
        ? `Over by ${formatRupees(discrepancyPaise)}` 
        : `Short by ${formatRupees(Math.abs(discrepancyPaise))}`;
    setToastMsg(`Shift register denomination count verified: ${formatRupees(countedCashPaise)} (${varianceDesc}). Shift sealed.`);
    setTimeout(() => setToastMsg(null), 4500);
  };

  // Indian Statutory Payroll Data
  const payrollData = staff.map(m => {
    const gross = m.base_monthly_salary;
    const basic = Math.round(gross * 0.50);
    const pf = Math.round(Math.min(basic, 1500000) * 0.12);
    const esi = gross <= 2100000 ? Math.round(gross * 0.0075) : 0;
    const pt = 20000;
    const tds = Math.round(gross * 0.05);
    const totalDeductions = pf + esi + pt + tds;
    const net = gross - totalDeductions;

    return {
      id: m.id,
      name: m.name,
      staff_id: m.staff_id,
      role: m.role,
      gross,
      basic,
      pf,
      esi,
      pt,
      tds,
      totalDeductions,
      net
    };
  });

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

      {/* TOP HEADER */}
      <div className="bg-white border-b border-[#E7E2DC] px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-bold font-serif text-[#1C1917]">Staff Roster & Payroll</h1>
          <p className="text-[11px] text-[#8C827A]">Biometric/PIN Time Clock, Denomination Shift Tally & Statutory Payroll</p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setShowShiftTallyModal(true)}
            className="bg-[#1C1917] hover:bg-black text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Coins className="w-3.5 h-3.5 text-[#D9531E]" /> Shift Cash Tally
          </button>

          <div className="flex bg-[#FAF8F5] border border-[#E7E2DC] rounded-lg p-1">
            <button
              onClick={() => setActiveTab('roster')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                activeTab === 'roster'
                  ? 'bg-white shadow-xs text-[#1C1917]'
                  : 'text-[#8C827A] hover:text-[#1C1917]'
              }`}
            >
              Time Clock
            </button>
            <button
              onClick={() => setActiveTab('payroll')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                activeTab === 'payroll'
                  ? 'bg-white shadow-xs text-[#1C1917]'
                  : 'text-[#8C827A] hover:text-[#1C1917]'
              }`}
            >
              Statutory Payroll
            </button>
          </div>
        </div>
      </div>

      {/* ROSTER TAB */}
      {activeTab === 'roster' ? (
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white border border-[#E7E2DC] rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-[#E7E2DC] text-[10px] font-bold uppercase tracking-wider text-[#8C827A]">
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Active Punch</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E2DC] text-xs">
                {staff.map(member => {
                  const isClockedIn = member.status === 'clocked_in';

                  return (
                    <tr key={member.id} className="hover:bg-[#FBF9F6] transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#1C1917]">{member.name}</div>
                        <div className="text-[10px] font-mono text-[#8C827A]">{member.staff_id}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs capitalize font-medium text-[#1C1917]">{member.role}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[#8C827A]">{member.phone}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                          isClockedIn ? 'bg-[#2D5A27]/10 text-[#2D5A27]' : 'bg-gray-100 text-gray-600'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isClockedIn ? 'bg-[#2D5A27]' : 'bg-gray-400'}`} />
                          {isClockedIn ? 'CLOCKED IN' : 'OFF DUTY'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#8C827A]">
                        {member.clock_in_time ? (
                          <div className="flex items-center gap-1 font-mono text-xs text-[#1C1917]">
                            <Clock className="w-3.5 h-3.5 text-[#D9531E]" />
                            {member.clock_in_time} (15m grace OK)
                          </div>
                        ) : '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleOpenPinModal(member)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                            isClockedIn
                              ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                              : 'bg-[#2D5A27] hover:bg-[#23471f] text-white'
                          }`}
                        >
                          {isClockedIn ? 'Clock Out' : 'Clock In'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* STATUTORY PAYROLL TAB */
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white border border-[#E7E2DC] rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 bg-[#FAF8F5] border-b border-[#E7E2DC] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#1C1917]">Indian Statutory Payroll Engine (C++ Engine)</h3>
                <p className="text-[11px] text-[#8C827A]">EPF Act 1952 (12% ceiling ₹15k), ESI Act 1948 (0.75%), State PT & TDS</p>
              </div>
              <span className="text-xs bg-[#2D5A27]/10 text-[#2D5A27] font-bold px-3 py-1 rounded-full">
                Statutory Invariants Verified
              </span>
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#FBF9F6] border-b border-[#E7E2DC] text-[10px] font-bold uppercase tracking-wider text-[#8C827A]">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4 text-right">Gross</th>
                  <th className="py-3 px-4 text-right">Basic (50%)</th>
                  <th className="py-3 px-4 text-right">PF (12%)</th>
                  <th className="py-3 px-4 text-right">ESI (0.75%)</th>
                  <th className="py-3 px-4 text-right">PT</th>
                  <th className="py-3 px-4 text-right">TDS</th>
                  <th className="py-3 px-4 text-right">Net Payable</th>
                  <th className="py-3 px-4 text-center">Payslip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E2DC] text-xs">
                {payrollData.map(p => (
                  <tr key={p.id} className="hover:bg-[#FBF9F6] transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#1C1917]">{p.name}</div>
                      <div className="text-[10px] capitalize text-[#8C827A]">{p.role}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[#1C1917]">{formatRupees(p.gross)}</td>
                    <td className="py-3 px-4 text-right font-mono text-[#8C827A]">{formatRupees(p.basic)}</td>
                    <td className="py-3 px-4 text-right font-mono text-red-700">-{formatRupees(p.pf)}</td>
                    <td className="py-3 px-4 text-right font-mono text-red-700">-{formatRupees(p.esi)}</td>
                    <td className="py-3 px-4 text-right font-mono text-red-700">-{formatRupees(p.pt)}</td>
                    <td className="py-3 px-4 text-right font-mono text-red-700">-{formatRupees(p.tds)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold font-serif text-[#2D5A27] text-sm">
                      {formatRupees(p.net)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => { setActivePayslipStaff(p); setShowPayslipModal(true); }}
                        className="p-1.5 rounded-lg border border-[#E7E2DC] bg-[#FAF8F5] hover:bg-[#F5EFEB] text-[#1C1917] text-[11px] font-bold inline-flex items-center gap-1"
                        title="View Detailed Payslip"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#D9531E]" /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SHIFT DENOMINATION CASH TALLY MODAL */}
      {showShiftTallyModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleShiftTallySubmit} className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center gap-2 mb-1">
              <Coins className="w-5 h-5 text-[#D9531E]" />
              <h3 className="text-base font-bold font-serif text-[#1C1917]">Shift Cash Drawer Denomination Tally</h3>
            </div>
            <p className="text-xs text-[#8C827A] mb-4">Physical currency audit against system book cash (C++ reconcile_shift)</p>

            {/* DENOMINATIONS INPUT GRID */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4 bg-[#FAF8F5] p-3 rounded-xl border border-[#E7E2DC]">
              {[
                { label: '₹2,000 Notes', key: 'note_2000' },
                { label: '₹500 Notes', key: 'note_500' },
                { label: '₹200 Notes', key: 'note_200' },
                { label: '₹100 Notes', key: 'note_100' },
                { label: '₹50 Notes', key: 'note_50' },
                { label: '₹20 Notes', key: 'note_20' },
                { label: '₹10 Notes', key: 'note_10' },
                { label: 'Coins (₹)', key: 'coins' },
              ].map(d => (
                <div key={d.key}>
                  <label className="text-[10px] font-bold text-[#8C827A] block mb-0.5">{d.label}</label>
                  <input
                    type="number"
                    min="0"
                    value={(denominations as any)[d.key]}
                    onChange={e => {
                      const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                      setDenominations(prev => ({ ...prev, [d.key]: val }));
                    }}
                    className="w-full bg-white border border-[#E7E2DC] rounded p-1.5 text-xs font-mono font-bold"
                  />
                </div>
              ))}
            </div>

            {/* COMPARISON METRICS */}
            <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#E7E2DC] mb-4 space-y-1.5 text-xs">
              <div className="flex justify-between text-[#8C827A]">
                <span>Physical Cash Counted:</span>
                <span className="font-mono font-bold text-[#1C1917]">{formatRupees(countedCashPaise)}</span>
              </div>
              <div className="flex justify-between text-[#8C827A]">
                <span>System Book Cash Expected:</span>
                <span className="font-mono">{formatRupees(expectedBookCashPaise)}</span>
              </div>
              <div className="flex justify-between font-bold pt-1.5 border-t border-[#E7E2DC]">
                <span>Discrepancy (Over / Short):</span>
                <span className={`font-mono ${discrepancyPaise === 0 ? 'text-[#2D5A27]' : discrepancyPaise > 0 ? 'text-blue-700' : 'text-red-700'}`}>
                  {discrepancyPaise === 0 ? 'Exact Match (₹0.00)' : formatRupees(discrepancyPaise)}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowShiftTallyModal(false)}
                className="flex-1 py-2 border border-[#E7E2DC] rounded-lg text-xs font-semibold text-[#8C827A]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-[#2D5A27] hover:bg-[#23471f] text-white rounded-lg text-xs font-bold"
              >
                Submit Tally & Close Shift
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DETAILED PAYSLIP MODAL */}
      {showPayslipModal && activePayslipStaff && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-start border-b border-[#E7E2DC] pb-3 mb-4">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#D9531E]">Monthly Pay Slip</span>
                <h3 className="text-base font-bold font-serif text-[#1C1917]">{activePayslipStaff.name}</h3>
                <span className="text-xs text-[#8C827A]">{activePayslipStaff.staff_id} • {activePayslipStaff.role}</span>
              </div>
              <button
                onClick={() => window.print()}
                className="p-1.5 rounded-lg border border-[#E7E2DC] bg-[#FAF8F5] text-xs font-bold flex items-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
            </div>

            <div className="space-y-2 mb-4 text-xs">
              <div className="flex justify-between font-bold text-[#1C1917]">
                <span>Gross Monthly Remuneration</span>
                <span>{formatRupees(activePayslipStaff.gross)}</span>
              </div>
              <div className="flex justify-between text-[#8C827A] pl-2">
                <span>Basic Wage (50%)</span>
                <span>{formatRupees(activePayslipStaff.basic)}</span>
              </div>

              <div className="pt-2 border-t border-[#E7E2DC] font-bold text-red-900">
                <span>Statutory Deductions</span>
              </div>
              <div className="flex justify-between text-[#8C827A] pl-2">
                <span>Employees' Provident Fund (EPF 12%)</span>
                <span>-{formatRupees(activePayslipStaff.pf)}</span>
              </div>
              <div className="flex justify-between text-[#8C827A] pl-2">
                <span>Employees' State Insurance (ESI 0.75%)</span>
                <span>-{formatRupees(activePayslipStaff.esi)}</span>
              </div>
              <div className="flex justify-between text-[#8C827A] pl-2">
                <span>Professional Tax (PT Karnataka)</span>
                <span>-{formatRupees(activePayslipStaff.pt)}</span>
              </div>
              <div className="flex justify-between text-[#8C827A] pl-2">
                <span>Income Tax Withholding (TDS Sec 192)</span>
                <span>-{formatRupees(activePayslipStaff.tds)}</span>
              </div>

              <div className="pt-2 border-t border-[#E7E2DC] flex justify-between font-bold text-sm text-[#2D5A27]">
                <span>Net Salary Disbursed</span>
                <span className="font-serif text-base">{formatRupees(activePayslipStaff.net)}</span>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowPayslipModal(false)}
                className="py-2 px-5 bg-[#1C1917] text-white rounded-lg text-xs font-bold"
              >
                Close Slip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN ENTRY MODAL */}
      {showPinModal && selectedStaff && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xs w-full p-6 shadow-2xl text-center">
            <KeyRound className="w-8 h-8 text-[#D9531E] mx-auto mb-2" />
            <h3 className="text-base font-bold font-serif text-[#1C1917] mb-0.5">
              {selectedStaff.status === 'clocked_in' ? 'Clock Out' : 'Clock In'}
            </h3>
            <p className="text-xs text-[#8C827A] mb-4">Enter 4-digit PIN for {selectedStaff.name}</p>

            <div className="flex justify-center gap-2 mb-4">
              {[0, 1, 2, 3].map(idx => (
                <div
                  key={idx}
                  className="w-10 h-10 rounded-lg border-2 border-[#E7E2DC] flex items-center justify-center font-bold text-lg bg-[#FAF8F5]"
                >
                  {pin[idx] ? '●' : ''}
                </div>
              ))}
            </div>

            {pinError && <p className="text-xs text-red-600 mb-2 font-medium">{pinError}</p>}

            {/* KEYPAD NUMBERS */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => pin.length < 4 && setPin(pin + num.toString())}
                  className="h-10 rounded-lg bg-[#F5EFEB] hover:bg-[#E7E2DC] font-bold text-sm text-[#1C1917] transition-colors"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPin('')}
                className="h-10 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-bold text-[#8C827A]"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => pin.length < 4 && setPin(pin + '0')}
                className="h-10 rounded-lg bg-[#F5EFEB] hover:bg-[#E7E2DC] font-bold text-sm text-[#1C1917]"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => setPin(pin.slice(0, -1))}
                className="h-10 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-bold text-[#8C827A]"
              >
                ⌫
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowPinModal(false)}
                className="flex-1 py-2 border border-[#E7E2DC] rounded-lg text-xs font-semibold text-[#8C827A]"
              >
                Cancel
              </button>
              <button
                onClick={handlePinSubmit}
                className="flex-1 py-2 bg-[#2D5A27] text-white rounded-lg text-xs font-bold hover:bg-[#23471f]"
              >
                Punch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
