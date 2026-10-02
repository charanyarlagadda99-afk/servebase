import React, { useState } from 'react';
import { StaffMember } from '../types';
import { formatRupees } from '../utils/currency';
import { 
  Users, Clock, DollarSign, CheckCircle2, ShieldCheck, 
  UserCheck, AlertCircle, FileText, KeyRound
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
  const [pin, setPin] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [showPayrollModal, setShowPayrollModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'roster' | 'payroll'>('roster');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

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
    // Any 4 digit PIN accepted in demo mode
    if (selectedStaff) {
      onClockToggle(selectedStaff.id);
      const action = selectedStaff.status === 'clocked_in' ? 'Clocked Out' : 'Clocked In';
      setToastMsg(`${selectedStaff.name} successfully ${action} at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      setShowPinModal(false);
      setTimeout(() => setToastMsg(null), 3500);
    }
  };

  // Compute Indian Statutory Payroll: PF (12%), ESI (0.75%), PT (flat ₹200), TDS (approx 5%)
  const payrollData = staff.map(m => {
    const gross = m.base_monthly_salary;
    const basic = Math.round(gross * 0.50); // 50% basic
    const pf = Math.round(Math.min(basic, 1500000) * 0.12); // PF 12% capped at 15k
    const esi = gross <= 2100000 ? Math.round(gross * 0.0075) : 0; // ESI 0.75% if gross <= 21k
    const pt = 20000; // Flat ₹200
    const tds = Math.round(gross * 0.05); // 5% TDS
    const totalDeductions = pf + esi + pt + tds;
    const net = gross - totalDeductions;

    return {
      id: m.id,
      name: m.name,
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
      <div className="bg-white border-b border-[#E7E2DC] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-serif text-[#1C1917]">Staff Attendance & Payroll Engine</h1>
          <p className="text-xs text-[#8C827A]">Biometric/PIN Time Clock & Indian Statutory Payroll (PF, ESI, PT, TDS)</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-[#FAF8F5] border border-[#E7E2DC] rounded-lg p-1">
            <button
              onClick={() => setActiveTab('roster')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeTab === 'roster'
                  ? 'bg-white shadow-xs text-[#1C1917]'
                  : 'text-[#8C827A] hover:text-[#1C1917]'
              }`}
            >
              Time Clock Roster
            </button>
            <button
              onClick={() => setActiveTab('payroll')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeTab === 'payroll'
                  ? 'bg-white shadow-xs text-[#1C1917]'
                  : 'text-[#8C827A] hover:text-[#1C1917]'
              }`}
            >
              Monthly Statutory Payroll
            </button>
          </div>
        </div>
      </div>

      {/* TAB CONTENT */}
      {activeTab === 'roster' ? (
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="bg-white border border-[#E7E2DC] rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-[#E7E2DC] text-[10px] font-bold uppercase tracking-wider text-[#8C827A]">
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Role & Department</th>
                  <th className="py-3 px-4">Contact Phone</th>
                  <th className="py-3 px-4">Clock-in Status</th>
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
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                          isClockedIn
                            ? 'bg-[#2D5A27]/10 text-[#2D5A27]'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${isClockedIn ? 'bg-[#2D5A27]' : 'bg-gray-400'}`} />
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
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
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
        /* STATUTORY PAYROLL BREAKDOWN */
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="bg-white border border-[#E7E2DC] rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 bg-[#FAF8F5] border-b border-[#E7E2DC] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#1C1917]">Current Month Payroll Computation (C++ Engine)</h3>
                <p className="text-[11px] text-[#8C827A]">EPF Act 1952, ESI Act 1948, State Professional Tax & TDS</p>
              </div>
              <span className="text-xs bg-[#2D5A27]/10 text-[#2D5A27] font-bold px-3 py-1 rounded-full">
                All Statutory Ceilings Applied
              </span>
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#FBF9F6] border-b border-[#E7E2DC] text-[10px] font-bold uppercase tracking-wider text-[#8C827A]">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4 text-right">Gross Salary</th>
                  <th className="py-3 px-4 text-right">Basic (50%)</th>
                  <th className="py-3 px-4 text-right">PF (12%)</th>
                  <th className="py-3 px-4 text-right">ESI (0.75%)</th>
                  <th className="py-3 px-4 text-right">PT</th>
                  <th className="py-3 px-4 text-right">TDS (5%)</th>
                  <th className="py-3 px-4 text-right">Total Ded.</th>
                  <th className="py-3 px-4 text-right">Net Payable</th>
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
                    <td className="py-3 px-4 text-right font-mono font-bold text-red-800">-{formatRupees(p.totalDeductions)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold font-serif text-[#2D5A27] text-sm">
                      {formatRupees(p.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PIN ENTRY MODAL */}
      {showPinModal && selectedStaff && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
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
