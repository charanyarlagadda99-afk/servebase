import React, { useState } from 'react';
import { Room } from '../types';
import { formatRupees } from '../utils/currency';
import { 
  Building2, BedDouble, CheckCircle2, UserPlus, 
  Receipt, Moon, Sparkles, AlertCircle, Wrench, Shield, 
  RotateCcw, History, X
} from 'lucide-react';

interface HotelViewProps {
  rooms: Room[];
  onUpdateRoomStatus: (roomId: string, status: Room['status'], cleanStatus?: Room['clean_status']) => void;
  onPostCharge: (roomId: string, amountPaise: number, description: string) => void;
  onReverseCharge?: (roomId: string, chargeId: string) => void;
  onCheckIn: (roomId: string, guestName: string) => void;
  onCheckOut: (roomId: string) => void;
}

export const HotelView: React.FC<HotelViewProps> = ({
  rooms,
  onUpdateRoomStatus,
  onPostCharge,
  onReverseCharge,
  onCheckIn,
  onCheckOut
}) => {
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showCheckInModal, setShowCheckInModal] = useState<boolean>(false);
  const [showChargeModal, setShowChargeModal] = useState<boolean>(false);
  const [showChargesHistoryModal, setShowChargesHistoryModal] = useState<boolean>(false);
  const [showNightAuditModal, setShowNightAuditModal] = useState<boolean>(false);
  const [guestNameInput, setGuestNameInput] = useState<string>('');
  const [chargeAmountPaise, setChargeAmountPaise] = useState<number>(145000);
  const [chargeDesc, setChargeDesc] = useState<string>('In-Room Dining: Awadhi Dum Biryani');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const totalRooms = rooms.length;
  const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
  const vacantRooms = rooms.filter(r => r.status === 'vacant').length;
  const occupancyPercent = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
  const totalRoomRevenue = rooms
    .filter(r => r.status === 'occupied')
    .reduce((acc, r) => acc + r.rate_per_night, 0);
  const adr = occupiedRooms > 0 ? Math.round(totalRoomRevenue / occupiedRooms) : 0;
  const revpar = totalRooms > 0 ? Math.round(totalRoomRevenue / totalRooms) : 0;

  const handleCheckInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom || !guestNameInput.trim()) return;
    onCheckIn(selectedRoom.id, guestNameInput.trim());
    setShowCheckInModal(false);
    setToastMsg(`Guest ${guestNameInput.trim()} checked in to Room ${selectedRoom.room_number}. Folio created.`);
    setGuestNameInput('');
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleChargeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom || chargeAmountPaise <= 0) return;
    onPostCharge(selectedRoom.id, chargeAmountPaise, chargeDesc);
    setShowChargeModal(false);
    setToastMsg(`Charge of ${formatRupees(chargeAmountPaise)} posted to Room ${selectedRoom.room_number} folio.`);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleReverseCharge = (chargeId: string, amount: number) => {
    if (!selectedRoom) return;
    if (onReverseCharge) {
      onReverseCharge(selectedRoom.id, chargeId);
    }
    setToastMsg(`Room charge of ${formatRupees(amount)} reversed and credited back to guest folio.`);
    setShowChargesHistoryModal(false);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleCheckOutSubmit = () => {
    if (!selectedRoom) return;
    onCheckOut(selectedRoom.id);
    setToastMsg(`Room ${selectedRoom.room_number} checked out. Folio settled to zero.`);
    setSelectedRoom(null);
    setTimeout(() => setToastMsg(null), 3500);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FBF9F6] overflow-hidden">
      {/* TOAST NOTIFICATION */}
      {toastMsg && (
        <div className="bg-[#2D5A27] text-white px-6 py-2.5 flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{toastMsg}</span>
          </div>
          <button onClick={() => setToastMsg(null)}>✕</button>
        </div>
      )}

      {/* TOP STATS & ACTIONS BAR */}
      <div className="bg-white border-b border-[#E7E2DC] px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-bold font-serif text-[#1C1917]">Hotel PMS & Guest Ledger</h1>
          <p className="text-[11px] text-[#8C827A]">Folio Management, F&B Room Charges, Void Reversals & Night Audit</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-[#FAF8F5] border border-[#E7E2DC] px-3 py-1.5 rounded-xl text-right hidden sm:block">
            <span className="text-[10px] uppercase font-bold text-[#8C827A] block">Occupancy</span>
            <span className="text-xs font-bold font-serif text-[#1C1917]">{occupancyPercent}% ({occupiedRooms}/{totalRooms})</span>
          </div>

          <div className="bg-[#FAF8F5] border border-[#E7E2DC] px-3 py-1.5 rounded-xl text-right hidden sm:block">
            <span className="text-[10px] uppercase font-bold text-[#8C827A] block">ADR / RevPAR</span>
            <span className="text-xs font-bold font-serif text-[#1C1917]">{formatRupees(adr)} / {formatRupees(revpar)}</span>
          </div>

          <button
            onClick={() => setShowNightAuditModal(true)}
            className="bg-[#1C1917] hover:bg-black text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Moon className="w-3.5 h-3.5 text-amber-400" />
            Night Audit
          </button>
        </div>
      </div>

      {/* ROOMS GRID */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {rooms.map(room => {
            const isOccupied = room.status === 'occupied';
            const isVacant = room.status === 'vacant';

            return (
              <div
                key={room.id}
                className={`bg-white rounded-xl border p-4 flex flex-col justify-between transition-all hover:shadow-md ${
                  isOccupied ? 'border-[#D9531E]/40 bg-[#FFF7F4]/40' :
                  isVacant ? 'border-[#E7E2DC]' :
                  'border-gray-200 bg-gray-50 opacity-70'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-base font-bold font-serif text-[#1C1917]">Room {room.room_number}</span>
                      <span className="text-[10px] uppercase font-bold text-[#8C827A] block tracking-wide">
                        {room.room_type}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full ${
                        isOccupied ? 'bg-[#D9531E]/10 text-[#D9531E]' :
                        isVacant ? 'bg-[#2D5A27]/10 text-[#2D5A27]' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {room.status}
                      </span>
                      <span className={`text-[9px] block mt-1 uppercase font-semibold ${
                        room.clean_status === 'clean' ? 'text-[#2D5A27]' :
                        room.clean_status === 'dirty' ? 'text-red-700' : 'text-blue-700'
                      }`}>
                        ● {room.clean_status}
                      </span>
                    </div>
                  </div>

                  {isOccupied ? (
                    <div className="bg-white/90 border border-[#E7E2DC] rounded-lg p-2.5 my-2">
                      <div className="flex justify-between items-center">
                        <p className="text-xs font-bold text-[#1C1917] truncate">{room.guest_name}</p>
                        <button
                          onClick={() => { setSelectedRoom(room); setShowChargesHistoryModal(true); }}
                          className="text-[10px] text-[#D9531E] font-bold hover:underline flex items-center gap-0.5"
                        >
                          <History className="w-2.5 h-2.5" /> History
                        </button>
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-[#8C827A] mt-1">
                        <span>Folio Balance:</span>
                        <span className="font-bold text-[#1C1917] font-mono">{formatRupees(room.current_folio_balance)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="my-3 text-xs text-[#8C827A]">
                      <span>Rate: </span>
                      <strong className="text-[#1C1917] font-mono">{formatRupees(room.rate_per_night)}/night</strong>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-[#E7E2DC] flex items-center gap-1.5">
                  {isOccupied ? (
                    <>
                      <button
                        onClick={() => { setSelectedRoom(room); setShowChargeModal(true); }}
                        className="flex-1 py-1.5 bg-[#FAF8F5] hover:bg-[#F5EFEB] border border-[#E7E2DC] rounded text-[11px] font-bold text-[#1C1917]"
                      >
                        + Post F&B
                      </button>
                      <button
                        onClick={() => { setSelectedRoom(room); handleCheckOutSubmit(); }}
                        className="py-1.5 px-3 bg-[#1C1917] hover:bg-black text-white rounded text-[11px] font-bold"
                      >
                        Check Out
                      </button>
                    </>
                  ) : isVacant ? (
                    <button
                      onClick={() => { setSelectedRoom(room); setShowCheckInModal(true); }}
                      className="w-full py-1.5 bg-[#2D5A27] hover:bg-[#23471f] text-white rounded text-[11px] font-bold flex items-center justify-center gap-1"
                    >
                      <UserPlus className="w-3 h-3" /> Check In Guest
                    </button>
                  ) : (
                    <button
                      onClick={() => onUpdateRoomStatus(room.id, 'vacant', 'clean')}
                      className="w-full py-1.5 bg-white border border-[#E7E2DC] text-[11px] font-bold text-[#8C827A]"
                    >
                      Mark Available
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CHECK-IN MODAL */}
      {showCheckInModal && selectedRoom && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCheckInSubmit} className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold font-serif text-[#1C1917] mb-1">Check In: Room {selectedRoom.room_number}</h3>
            <p className="text-xs text-[#8C827A] mb-4">Opens billing folio ledger and creates guest folio</p>

            <div className="space-y-3 mb-6">
              <div>
                <label className="text-xs font-bold text-[#1C1917] block mb-1">Guest Full Name</label>
                <input
                  type="text"
                  required
                  value={guestNameInput}
                  onChange={e => setGuestNameInput(e.target.value)}
                  placeholder="e.g. Dr. Raghavendra Rao"
                  className="w-full bg-[#FAF8F5] border border-[#E7E2DC] rounded-lg p-2 text-xs focus:outline-none focus:border-[#D9531E]"
                />
              </div>

              <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#E7E2DC] text-xs">
                <div className="flex justify-between text-[#8C827A] mb-1">
                  <span>Room Type:</span>
                  <span className="font-bold text-[#1C1917] uppercase">{selectedRoom.room_type}</span>
                </div>
                <div className="flex justify-between text-[#8C827A]">
                  <span>Daily Tariff:</span>
                  <span className="font-bold text-[#1C1917]">{formatRupees(selectedRoom.rate_per_night)} + 12% GST</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCheckInModal(false)}
                className="flex-1 py-2 border border-[#E7E2DC] rounded-lg text-xs font-semibold text-[#8C827A]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-[#2D5A27] text-white rounded-lg text-xs font-bold hover:bg-[#23471f]"
              >
                Confirm Check In
              </button>
            </div>
          </form>
        </div>
      )}

      {/* POST F&B CHARGE MODAL */}
      {showChargeModal && selectedRoom && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleChargeSubmit} className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold font-serif text-[#1C1917] mb-1">Post Charge: Room {selectedRoom.room_number}</h3>
            <p className="text-xs text-[#8C827A] mb-4">Guest: {selectedRoom.guest_name}</p>

            <div className="space-y-3 mb-6">
              <div>
                <label className="text-xs font-bold text-[#1C1917] block mb-1">Charge Description</label>
                <input
                  type="text"
                  required
                  value={chargeDesc}
                  onChange={e => setChargeDesc(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E7E2DC] rounded-lg p-2 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#1C1917] block mb-1">Amount (Paise)</label>
                <input
                  type="number"
                  min="100"
                  required
                  value={chargeAmountPaise}
                  onChange={e => setChargeAmountPaise(Math.max(100, parseInt(e.target.value, 10) || 100))}
                  className="w-full bg-[#FAF8F5] border border-[#E7E2DC] rounded-lg p-2 text-xs font-mono"
                />
                <span className="text-[10px] text-[#8C827A] mt-0.5 block">
                  Amount: {formatRupees(chargeAmountPaise)}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowChargeModal(false)}
                className="flex-1 py-2 border border-[#E7E2DC] rounded-lg text-xs font-semibold text-[#8C827A]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-[#D9531E] text-white rounded-lg text-xs font-bold hover:bg-[#b84214]"
              >
                Post to Folio
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CHARGES HISTORY & VOID REVERSAL MODAL */}
      {showChargesHistoryModal && selectedRoom && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#E7E2DC] pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold font-serif text-[#1C1917]">Folio Charges: Room {selectedRoom.room_number}</h3>
                <p className="text-xs text-[#8C827A]">Guest: {selectedRoom.guest_name}</p>
              </div>
              <button onClick={() => setShowChargesHistoryModal(false)} className="text-[#8C827A]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
              {(selectedRoom.charges_history || []).map(chg => (
                <div key={chg.id} className="p-2.5 rounded-lg border border-[#E7E2DC] bg-[#FAF8F5] flex justify-between items-center text-xs">
                  <div>
                    <span className={`font-bold block ${chg.is_reversed ? 'line-through text-[#8C827A]' : 'text-[#1C1917]'}`}>
                      {chg.desc}
                    </span>
                    <span className="text-[10px] text-[#8C827A]">{chg.timestamp}</span>
                  </div>

                  <div className="text-right flex items-center gap-2">
                    <span className={`font-mono font-bold ${chg.is_reversed ? 'line-through text-[#8C827A]' : 'text-[#D9531E]'}`}>
                      {formatRupees(chg.amount)}
                    </span>
                    {!chg.is_reversed && (
                      <button
                        onClick={() => handleReverseCharge(chg.id, chg.amount)}
                        className="p-1 rounded bg-red-50 hover:bg-red-100 text-red-700 text-[10px] font-bold flex items-center gap-0.5 border border-red-200"
                        title="Reverse / Void Charge"
                      >
                        <RotateCcw className="w-2.5 h-2.5" /> Void
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {(!selectedRoom.charges_history || selectedRoom.charges_history.length === 0) && (
                <p className="text-xs text-[#8C827A] text-center py-4">No incidental charges posted yet.</p>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowChargesHistoryModal(false)}
                className="py-1.5 px-4 bg-[#1C1917] text-white rounded-lg text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NIGHT AUDIT WIZARD MODAL */}
      {showNightAuditModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center gap-2 mb-2">
              <Moon className="w-5 h-5 text-amber-500" />
              <h3 className="text-lg font-bold font-serif text-[#1C1917]">Hotel PMS Night Audit</h3>
            </div>
            <p className="text-xs text-[#8C827A] mb-4">
              Close hotel day, post room tariffs, compute ADR & RevPAR, and roll business date
            </p>

            <div className="space-y-2.5 mb-6 bg-[#FAF8F5] p-4 rounded-xl border border-[#E7E2DC]">
              <div className="flex justify-between text-xs">
                <span className="text-[#8C827A]">Total Room Inventory:</span>
                <span className="font-bold text-[#1C1917]">{totalRooms} Rooms</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#8C827A]">Occupied Rooms (Sold):</span>
                <span className="font-bold text-[#1C1917]">{occupiedRooms} Rooms ({occupancyPercent}%)</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#8C827A]">Average Daily Rate (ADR):</span>
                <span className="font-bold text-[#D9531E]">{formatRupees(adr)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#8C827A]">Revenue Per Available Room (RevPAR):</span>
                <span className="font-bold text-[#2D5A27]">{formatRupees(revpar)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold pt-2 border-t border-[#E7E2DC]">
                <span className="text-[#1C1917]">Night Room Charges to Post:</span>
                <span className="font-serif text-[#1C1917]">{formatRupees(totalRoomRevenue)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowNightAuditModal(false)}
                className="flex-1 py-2 border border-[#E7E2DC] rounded-lg text-xs font-semibold text-[#8C827A]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowNightAuditModal(false);
                  setToastMsg(`Night Audit completed successfully! ${formatRupees(totalRoomRevenue)} posted to guest folios.`);
                  setTimeout(() => setToastMsg(null), 4000);
                }}
                className="flex-1 py-2 bg-[#1C1917] text-white rounded-lg text-xs font-bold hover:bg-black"
              >
                Execute Night Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
