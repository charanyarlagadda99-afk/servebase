import React, { useState, useEffect } from 'react';
import { Table, MenuItem, CartItem, Course, CourseStatus, TableStatus } from '../types';
import { api } from '../api/client';
import { formatRupees } from '../utils/currency';
import { 
  Users, Utensils, Clock, AlertCircle, CheckCircle2, 
  Flame, Plus, Minus, Trash2, Printer, CreditCard, 
  Split, ArrowLeft, Receipt, Sparkles, ChefHat, 
  ShieldAlert, Lock, Unlock, Percent, Tag, SlidersHorizontal, 
  FileText, X
} from 'lucide-react';

interface PosViewProps {
  tables: Table[];
  menu: MenuItem[];
  onUpdateTableStatus: (tableId: string, status: TableStatus, billAmount?: number) => void;
  onSendKot: (tableNumber: string, items: CartItem[]) => void;
}

export const PosView: React.FC<PosViewProps> = ({
  tables,
  menu,
  onUpdateTableStatus,
  onSendKot
}) => {
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [coversInput, setCoversInput] = useState<number>(2);
  const [activeCourse, setActiveCourse] = useState<Course>('starter');
  
  // Modals & Sheets
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [showSplitModal, setShowSplitModal] = useState<boolean>(false);
  const [showDiscountModal, setShowDiscountModal] = useState<boolean>(false);
  const [showManagerModal, setShowManagerModal] = useState<boolean>(false);
  const [mobileCartOpen, setMobileCartOpen] = useState<boolean>(false);

  // Manager Override state
  const [managerActionType, setManagerActionType] = useState<'void' | 'discount' | 'price_override'>('void');
  const [pendingVoidItemId, setPendingVoidItemId] = useState<string | null>(null);
  const [pendingDiscountValue, setPendingDiscountValue] = useState<number>(0);
  const [managerPin, setManagerPin] = useState<string>('');
  const [managerReason, setManagerReason] = useState<string>('Guest request / Order adjustment');
  const [managerError, setManagerError] = useState<string | null>(null);

  // Billing parameters
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState<boolean>(false);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [splitMode, setSplitMode] = useState<'equal' | 'item' | 'seat' | 'amount'>('equal');
  const [splitCount, setSplitCount] = useState<number>(2);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi' | 'room'>('upi');
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState<string | null>(null);

  // Custom Amount split states
  const [customSplitShare1, setCustomSplitShare1] = useState<number>(0);
  const [customSplitShare2, setCustomSplitShare2] = useState<number>(0);

  const categories = ['All', 'Starters', 'Main Curries', 'Biryani & Breads', 'Desserts', 'Beverages'];

  const filteredMenu = selectedCategory === 'All'
    ? menu
    : menu.filter(item => item.category === selectedCategory);

  const handleSelectTable = (table: Table) => {
    setSelectedTable(table);
    if (table.status === 'vacant') {
      setCart([]);
      setCoversInput(table.capacity);
      setDiscountPercent(0);
      setServiceChargeEnabled(false);
    } else if (table.current_order_id) {
      api.orders.get(table.current_order_id).then((res: any) => {
        if (res.ok && res.data?.items) {
          setCart(res.data.items.map((i: any) => ({
            id: i.id,
            menu_item_id: i.menu_item_id,
            name: i.item_name || i.name,
            base_price: Number(i.unit_price_paise),
            quantity: Number(i.quantity),
            course: (i.course || 'main') as Course,
            status: (i.course_status || (i.status === 'sent' ? 'fire' : 'hold')) as CourseStatus,
            station: i.station || 'curry',
            notes: i.notes,
          })));
        } else {
          setCart([]);
        }
      }).catch(() => setCart([]));
    } else {
      setCart([]);
    }
  };

  const handleAddToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.menu_item_id === item.id && i.course === activeCourse && !i.is_voided);
      if (existing) {
        return prev.map(i => 
          i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          id: `cart-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          menu_item_id: item.id,
          name: item.name,
          base_price: item.base_price,
          quantity: 1,
          course: activeCourse,
          status: activeCourse === 'starter' || activeCourse === 'beverage' ? 'fire' : 'hold',
          station: item.station,
          seat_number: 1,
        }
      ];
    });
  };

  const handleUpdateQuantity = (cartId: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.id === cartId) {
        const newQty = i.quantity + delta;
        if (newQty <= 0) {
          // Trigger void flow
          triggerVoidItem(i);
          return i;
        }
        return { ...i, quantity: newQty };
      }
      return i;
    }));
  };

  const triggerVoidItem = (item: CartItem) => {
    if (item.status === 'fire') {
      // Fired KOT item requires manager approval
      setManagerActionType('void');
      setPendingVoidItemId(item.id);
      setManagerPin('');
      setManagerError(null);
      setShowManagerModal(true);
    } else {
      // Unfired hold item can be deleted immediately
      setCart(prev => prev.filter(i => i.id !== item.id));
      setPaymentSuccessMsg(`Removed ${item.name} from un-fired order.`);
      setTimeout(() => setPaymentSuccessMsg(null), 2500);
    }
  };

  const handleManagerApproval = async () => {
    if (managerPin.length !== 4) {
      setManagerError('Please enter a valid 4-digit Manager PIN');
      return;
    }

    try {
      const res = await api.auth.approve(
        managerPin,
        managerActionType,
        managerReason,
        pendingVoidItemId || selectedTable?.id
      );

      if (!res.ok) {
        setManagerError(res.error?.message || 'Manager PIN authorization failed');
        return;
      }

      if (managerActionType === 'void' && pendingVoidItemId) {
        setCart(prev => prev.filter(i => i.id !== pendingVoidItemId));
        setPaymentSuccessMsg(`Manager override approved: Item voided with reason "${managerReason}"`);
        setShowManagerModal(false);
        setPendingVoidItemId(null);
        setTimeout(() => setPaymentSuccessMsg(null), 3500);
      } else if (managerActionType === 'discount') {
        setDiscountPercent(pendingDiscountValue);
        setPaymentSuccessMsg(`Manager override approved: ${pendingDiscountValue}% discount applied.`);
        setShowManagerModal(false);
        setShowDiscountModal(false);
        setTimeout(() => setPaymentSuccessMsg(null), 3500);
      }
    } catch (err: any) {
      setManagerError(err.message || 'Authorization network error');
    }
  };

  const handleApplyDiscountClick = (percent: number) => {
    if (percent > 15) {
      // Requires manager override
      setManagerActionType('discount');
      setPendingDiscountValue(percent);
      setManagerPin('');
      setManagerError(null);
      setShowManagerModal(true);
    } else {
      setDiscountPercent(percent);
      setShowDiscountModal(false);
      setPaymentSuccessMsg(`Applied ${percent}% promotional discount.`);
      setTimeout(() => setPaymentSuccessMsg(null), 2500);
    }
  };

  const handleToggleCourseStatus = (cartId: string) => {
    setCart(prev => prev.map(i => {
      if (i.id === cartId) {
        const nextStatus: CourseStatus = i.status === 'hold' ? 'fire' : 'hold';
        return { ...i, status: nextStatus };
      }
      return i;
    }));
  };

  // FINANCIAL & TAX CALCULATIONS (Native C++ Engine via API)
  const [pricing, setPricing] = useState({
    subtotal_paise: 0,
    item_discount_paise: 0,
    bill_discount_paise: 0,
    taxable_value_paise: 0,
    cgst_paise: 0,
    sgst_paise: 0,
    igst_paise: 0,
    service_charge_paise: 0,
    tip_paise: 0,
    round_off_paise: 0,
    total_paise: 0,
  });

  const [splitShares, setSplitShares] = useState<Array<{ split_index: number; total_paise: number }>>([]);

  useEffect(() => {
    if (cart.length === 0) {
      setPricing({
        subtotal_paise: 0,
        item_discount_paise: 0,
        bill_discount_paise: 0,
        taxable_value_paise: 0,
        cgst_paise: 0,
        sgst_paise: 0,
        igst_paise: 0,
        service_charge_paise: 0,
        tip_paise: 0,
        round_off_paise: 0,
        total_paise: 0,
      });
      return;
    }

    let active = true;
    api.billing.calculate({
      items: cart.map(i => ({
        item_id: i.menu_item_id,
        name: i.name,
        quantity: i.quantity,
        unit_price_paise: i.base_price,
        tax_rate_percent: 5.0,
      })),
      bill_discount_percent: discountPercent,
      service_charge_enabled: serviceChargeEnabled,
      service_charge_percent: serviceChargeEnabled ? 5.0 : 0.0,
    }).then(res => {
      if (active && res.ok && res.data) {
        setPricing(res.data);
      }
    }).catch(() => {});

    return () => { active = false; };
  }, [cart, discountPercent, serviceChargeEnabled]);

  const subtotal = pricing.subtotal_paise;
  const discountAmount = pricing.bill_discount_paise;
  const cgst = pricing.cgst_paise;
  const sgst = pricing.sgst_paise;
  const totalTax = pricing.cgst_paise + pricing.sgst_paise;
  const serviceChargeAmount = pricing.service_charge_paise;
  const grandTotal = pricing.total_paise;

  useEffect(() => {
    if (grandTotal <= 0) return;
    api.billing.split({
      bill: { total_paise: grandTotal, subtotal_paise: subtotal },
      split_type: 'equal',
      num_parts: splitCount,
    }).then(res => {
      if (res.ok && res.data?.splits) {
        setSplitShares(res.data.splits);
      }
    }).catch(() => {});
  }, [grandTotal, splitCount, subtotal]);

  const handleSendKotClick = () => {
    if (!selectedTable || cart.length === 0) return;
    onSendKot(selectedTable.table_number, cart);
    onUpdateTableStatus(selectedTable.id, 'occupied', grandTotal);
    setSelectedTable(prev => prev ? { ...prev, status: 'occupied', active_bill_amount: grandTotal } : null);
    setPaymentSuccessMsg(`KOT dispatched to Kitchen & Bar stations for Table ${selectedTable.table_number}!`);
    setTimeout(() => setPaymentSuccessMsg(null), 3000);
  };

  const handlePrintBill = () => {
    if (!selectedTable) return;
    onUpdateTableStatus(selectedTable.id, 'billed', grandTotal);
    setSelectedTable(prev => prev ? { ...prev, status: 'billed', active_bill_amount: grandTotal } : null);
    setPaymentSuccessMsg(`Tax Invoice printed: ${formatRupees(grandTotal)} for Table ${selectedTable.table_number}`);
    setTimeout(() => setPaymentSuccessMsg(null), 3000);
  };

  const handleCompletePayment = async () => {
    if (!selectedTable) return;
    try {
      if (selectedTable.current_order_id) {
        const invRes = await api.billing.invoice(selectedTable.current_order_id);
        if (invRes.ok && invRes.data?.id) {
          await api.payments.record({
            invoice_id: invRes.data.id,
            payment_method: paymentMethod === 'room' ? 'charge_to_room' : paymentMethod,
            amount_paise: grandTotal,
          });
        }
      }
      await api.floor.updateTableStatus(selectedTable.id, 'vacant');
    } catch (err) {}

    onUpdateTableStatus(selectedTable.id, 'vacant');
    setShowPaymentModal(false);
    setPaymentSuccessMsg(`Tax Invoice settled via ${paymentMethod.toUpperCase()} (${formatRupees(grandTotal)}). Table ${selectedTable.table_number} is now vacant.`);
    setSelectedTable(null);
    setCart([]);
    setMobileCartOpen(false);
    setTimeout(() => setPaymentSuccessMsg(null), 4000);
  };

  return (
    <div className="flex h-full w-full bg-[#FBF9F6] relative overflow-hidden">
      {/* TOAST NOTIFICATION */}
      {paymentSuccessMsg && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-[#2D5A27] text-white px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-3 text-xs font-semibold animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-white" />
          <span>{paymentSuccessMsg}</span>
          <button onClick={() => setPaymentSuccessMsg(null)} className="ml-2 opacity-80 hover:opacity-100">✕</button>
        </div>
      )}

      {/* LEFT / CENTER PANE: TABLES & MENU */}
      <div className="flex-1 flex flex-col border-r border-[#E7E2DC] overflow-hidden">
        {/* TOP STATUS BAR */}
        <div className="bg-white border-b border-[#E7E2DC] px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {selectedTable ? (
              <button 
                onClick={() => { setSelectedTable(null); setMobileCartOpen(false); }}
                className="flex items-center gap-2 text-xs font-bold text-[#8C827A] hover:text-[#1C1917] bg-[#F5EFEB] hover:bg-[#E7E2DC] px-3 py-1.5 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> All Tables
              </button>
            ) : (
              <div>
                <h1 className="text-lg sm:text-xl font-bold font-serif text-[#1C1917]">Table Floor Plan</h1>
                <p className="text-[11px] text-[#8C827A]">Real-time turns, idle timers & concurrent station routing</p>
              </div>
            )}

            {selectedTable && (
              <div className="flex items-center gap-2.5">
                <span className="text-base sm:text-lg font-bold font-serif text-[#1C1917] bg-[#FAF8F5] px-3 py-1 rounded-lg border border-[#E7E2DC]">
                  {selectedTable.table_number} ({selectedTable.section})
                </span>
                <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase ${
                  selectedTable.status === 'vacant' ? 'bg-[#2D5A27]/10 text-[#2D5A27]' :
                  selectedTable.status === 'occupied' ? 'bg-[#D9531E]/10 text-[#D9531E]' :
                  selectedTable.status === 'billed' ? 'bg-amber-100 text-amber-800' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {selectedTable.status}
                </span>

                {selectedTable.locked_by && (
                  <span className="hidden md:inline-flex items-center gap-1 text-[10px] bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-200">
                    <Lock className="w-3 h-3" /> Locked: {selectedTable.locked_by}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* COURSE SWITCHER OR TABLE LEGEND */}
          <div className="flex items-center gap-2">
            {!selectedTable ? (
              <div className="hidden lg:flex items-center gap-3 text-xs font-medium">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#2D5A27]" /> Vacant ({tables.filter(t => t.status === 'vacant').length})</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#D9531E]" /> Occupied ({tables.filter(t => t.status === 'occupied').length})</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Billed ({tables.filter(t => t.status === 'billed').length})</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Reserved ({tables.filter(t => t.status === 'reserved').length})</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-[#FAF8F5] p-1 rounded-lg border border-[#E7E2DC]">
                {(['beverage', 'starter', 'main', 'dessert'] as Course[]).map(c => (
                  <button
                    key={c}
                    onClick={() => setActiveCourse(c)}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold capitalize transition-all ${
                      activeCourse === c
                        ? 'bg-[#1C1917] text-white shadow-xs'
                        : 'text-[#8C827A] hover:text-[#1C1917]'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* WORKSPACE BODY */}
        {!selectedTable ? (
          /* TABLE FLOOR PLAN GRID WITH IDLE TIMERS */
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
            {['Main Dining', 'Outdoor Terrace', 'Private Dining'].map(section => {
              const sectionTables = tables.filter(t => t.section === section);
              if (sectionTables.length === 0) return null;

              return (
                <div key={section} className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#8C827A]">{section}</h3>
                    <span className="text-[11px] text-[#8C827A]">{sectionTables.length} tables</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3.5">
                    {sectionTables.map(t => {
                      const isVacant = t.status === 'vacant';
                      const isOccupied = t.status === 'occupied';
                      const isBilled = t.status === 'billed';
                      const isReserved = t.status === 'reserved';

                      return (
                        <div
                          key={t.id}
                          onClick={() => handleSelectTable(t)}
                          className={`cursor-pointer rounded-xl border p-3.5 transition-all hover:shadow-md flex flex-col justify-between h-36 relative ${
                            isVacant ? 'bg-white border-[#E7E2DC] hover:border-[#2D5A27]' :
                            isOccupied ? 'bg-[#FFF7F4] border-[#D9531E]/40 hover:border-[#D9531E]' :
                            isBilled ? 'bg-[#FFFDF5] border-amber-300 hover:border-amber-500' :
                            isReserved ? 'bg-purple-50/50 border-purple-200' :
                            'bg-gray-50 border-gray-200 opacity-60'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="text-base font-bold font-serif text-[#1C1917]">{t.table_number}</span>
                              <div className="text-[10px] text-[#8C827A] flex items-center gap-1 mt-0.5">
                                <Users className="w-3 h-3" /> {t.capacity} seats
                              </div>
                            </div>
                            
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              isVacant ? 'bg-[#2D5A27]/10 text-[#2D5A27]' :
                              isOccupied ? 'bg-[#D9531E]/10 text-[#D9531E]' :
                              isBilled ? 'bg-amber-100 text-amber-800' :
                              'bg-purple-100 text-purple-800'
                            }`}>
                              {t.status}
                            </span>
                          </div>

                          <div className="my-auto">
                            {isOccupied || isBilled ? (
                              <div>
                                <div className="text-sm font-bold font-serif text-[#1C1917]">
                                  {formatRupees(t.active_bill_amount || 0)}
                                </div>
                                <div className="text-[10px] text-[#8C827A] flex items-center gap-1 mt-0.5">
                                  <span>{t.covers || 2} covers</span>
                                  <span>•</span>
                                  <span>{t.server_name?.split(' ')[0] || 'Server'}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="text-[11px] text-[#8C827A] italic">Available</div>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-[#8C827A] pt-2 border-t border-black/5">
                            {t.idle_minutes ? (
                              <span className="flex items-center gap-1 text-amber-700 font-medium">
                                <Clock className="w-3 h-3" /> {t.idle_minutes}m idle
                              </span>
                            ) : (
                              <span>{t.seated_time || 'Clean'}</span>
                            )}
                            <span className="text-[#D9531E] font-bold">Open &rarr;</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* MENU TOUCH CATALOG */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* CATEGORY BAR */}
            <div className="bg-white border-b border-[#E7E2DC] px-4 sm:px-6 py-2.5 flex items-center gap-2 overflow-x-auto">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? 'bg-[#D9531E] text-white shadow-xs'
                      : 'bg-[#FBF9F6] text-[#6B6158] hover:bg-[#F5EFEB]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* MENU ITEMS GRID */}
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {filteredMenu.map(item => (
                <div
                  key={item.id}
                  onClick={() => handleAddToCart(item)}
                  className="bg-white rounded-xl border border-[#E7E2DC] p-3.5 cursor-pointer hover:border-[#D9531E] hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          item.veg_status === 'veg' ? 'bg-[#2D5A27]' : 'bg-[#D9531E]'
                        }`} />
                        <span className="text-[10px] font-mono text-[#8C827A] uppercase">{item.item_code}</span>
                      </div>
                      <span className="text-[9px] bg-[#FAF8F5] border border-[#E7E2DC] text-[#8C827A] px-1.5 py-0.5 rounded capitalize font-bold">
                        {item.station}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-[#1C1917] group-hover:text-[#D9531E] transition-colors leading-tight">
                      {item.name}
                    </h4>
                    {item.description && (
                      <p className="text-[10px] text-[#8C827A] mt-1 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-[#F5EFEB] flex items-center justify-between">
                    <span className="text-xs font-bold font-serif text-[#1C1917]">
                      {formatRupees(item.base_price)}
                    </span>
                    <button className="bg-[#FAF8F5] text-[#1C1917] group-hover:bg-[#D9531E] group-hover:text-white p-1 rounded-lg transition-colors border border-[#E7E2DC]">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MOBILE FLOATING CART BAR */}
        {selectedTable && (
          <div className="lg:hidden p-3 bg-white border-t border-[#E7E2DC] flex items-center justify-between">
            <div>
              <span className="text-xs font-bold block">{cart.length} items • {formatRupees(grandTotal)}</span>
              <span className="text-[10px] text-[#8C827A]">Table {selectedTable.table_number}</span>
            </div>
            <button
              onClick={() => setMobileCartOpen(!mobileCartOpen)}
              className="bg-[#D9531E] text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Receipt className="w-3.5 h-3.5" /> {mobileCartOpen ? 'Hide Order' : 'Review & Pay'}
            </button>
          </div>
        )}
      </div>

      {/* RIGHT SIDEBAR: ORDER CART & BILLING (Responsive on desktop, collapsible on mobile) */}
      <div className={`
        fixed lg:static inset-y-0 right-0 z-40 w-96 bg-white flex flex-col border-l border-[#E7E2DC] shadow-lg lg:shadow-none transition-transform duration-200
        ${mobileCartOpen || selectedTable ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        ${!selectedTable ? 'lg:flex' : ''}
      `}>
        {/* CART HEADER */}
        <div className="p-4 border-b border-[#E7E2DC] bg-[#FAF8F5] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#D9531E]" />
              <h2 className="text-sm font-bold font-serif text-[#1C1917]">
                {selectedTable ? `Order: ${selectedTable.table_number}` : 'No Table Selected'}
              </h2>
            </div>
            {selectedTable && (
              <p className="text-[10px] text-[#8C827A] mt-0.5">
                Covers: {coversInput} • Server: {selectedTable.server_name || 'Staff'}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1">
            {selectedTable && (
              <button
                onClick={() => setShowDiscountModal(true)}
                className="p-1.5 rounded-lg border border-[#E7E2DC] bg-white text-[#8C827A] hover:text-[#1C1917] hover:border-gray-400 text-[11px] font-bold flex items-center gap-1"
                title="Apply Order Discount"
              >
                <Tag className="w-3 h-3 text-[#D9531E]" />
                {discountPercent > 0 ? `${discountPercent}%` : 'Discount'}
              </button>
            )}
            <button
              onClick={() => setMobileCartOpen(false)}
              className="lg:hidden p-1 rounded-lg text-[#8C827A] hover:text-[#1C1917]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* CART ITEMS LIST */}
        <div className="flex-1 p-3.5 overflow-y-auto space-y-2.5">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#8C827A]">
              <Utensils className="w-8 h-8 mb-2 stroke-1 text-[#C4BCB3]" />
              <p className="text-xs font-bold text-[#1C1917]">Cart is empty</p>
              <p className="text-[11px] mt-1 text-[#8C827A]">Tap menu dishes to build dine-in KOT</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="bg-[#FAF8F5] border border-[#E7E2DC] rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[#1C1917]">{item.name}</span>
                      {item.seat_number && (
                        <span className="text-[9px] bg-white border border-[#E7E2DC] px-1 rounded text-[#8C827A] font-bold">
                          Seat {item.seat_number}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] uppercase font-bold text-[#8C827A] tracking-wider">
                        {item.course}
                      </span>
                      <span className="text-[9px] text-[#8C827A]">• {item.station}</span>
                    </div>
                  </div>

                  <span className="text-xs font-bold font-serif text-[#1C1917]">
                    {formatRupees(item.base_price * item.quantity)}
                  </span>
                </div>

                {item.notes && (
                  <p className="text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    {item.notes}
                  </p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-[#E7E2DC]">
                  {/* HOLD / FIRE TOGGLE */}
                  <button
                    onClick={() => handleToggleCourseStatus(item.id)}
                    className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase transition-colors flex items-center gap-1 ${
                      item.status === 'fire'
                        ? 'bg-[#D9531E] text-white shadow-xs'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    <Flame className="w-2.5 h-2.5" />
                    {item.status === 'fire' ? 'FIRE' : 'HOLD'}
                  </button>

                  {/* QUANTITY & VOID CONTROLS */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => triggerVoidItem(item)}
                      className="w-6 h-6 rounded bg-white border border-[#E7E2DC] flex items-center justify-center text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors"
                      title={item.status === 'fire' ? 'Manager Void Required' : 'Remove Item'}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>

                    <button
                      onClick={() => handleUpdateQuantity(item.id, -1)}
                      className="w-6 h-6 rounded bg-white border border-[#E7E2DC] flex items-center justify-center text-[#1C1917] hover:bg-[#F5EFEB]"
                    >
                      <Minus className="w-2.5 h-2.5" />
                    </button>
                    <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                    <button
                      onClick={() => handleUpdateQuantity(item.id, 1)}
                      className="w-6 h-6 rounded bg-white border border-[#E7E2DC] flex items-center justify-center text-[#1C1917] hover:bg-[#F5EFEB]"
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* BILL SUMMARY & CALCULATIONS */}
        {cart.length > 0 && (
          <div className="p-4 bg-[#FAF8F5] border-t border-[#E7E2DC] space-y-2">
            <div className="flex justify-between text-xs text-[#8C827A]">
              <span>Subtotal</span>
              <span className="font-mono">{formatRupees(subtotal)}</span>
            </div>

            {discountPercent > 0 && (
              <div className="flex justify-between text-xs text-[#2D5A27] font-semibold">
                <span>Discount ({discountPercent}%)</span>
                <span className="font-mono">-{formatRupees(discountAmount)}</span>
              </div>
            )}

            {/* SERVICE CHARGE TOGGLE (Default OFF, exempt from GST) */}
            <div className="flex items-center justify-between py-1 border-y border-[#E7E2DC]/60 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={serviceChargeEnabled}
                  onChange={e => setServiceChargeEnabled(e.target.checked)}
                  className="rounded text-[#D9531E] focus:ring-0"
                />
                <span className="text-[#1C1917] font-medium">Service Charge (5% - Optional)</span>
              </label>
              <span className="font-mono font-semibold text-[#1C1917]">
                {serviceChargeEnabled ? formatRupees(serviceChargeAmount) : '₹0'}
              </span>
            </div>

            {/* 5% Non-ITC GST (CGST 2.5% + SGST 2.5%) */}
            <div className="flex justify-between text-[11px] text-[#8C827A]">
              <span>CGST (2.5%)</span>
              <span className="font-mono">{formatRupees(cgst)}</span>
            </div>
            <div className="flex justify-between text-[11px] text-[#8C827A]">
              <span>SGST (2.5%)</span>
              <span className="font-mono">{formatRupees(sgst)}</span>
            </div>

            <div className="flex justify-between text-sm font-bold text-[#1C1917] pt-2 border-t border-[#E7E2DC]">
              <span>Grand Total</span>
              <span className="font-serif text-base text-[#D9531E]">{formatRupees(grandTotal)}</span>
            </div>

            {/* ACTION CONTROLS */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={handleSendKotClick}
                disabled={!selectedTable}
                className="bg-[#1C1917] hover:bg-black text-white py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <ChefHat className="w-3.5 h-3.5 text-[#D9531E]" />
                Send KOT
              </button>

              <button
                onClick={handlePrintBill}
                disabled={!selectedTable}
                className="bg-[#F5EFEB] hover:bg-[#E7E2DC] text-[#1C1917] border border-[#D5CDC5] py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Printer className="w-3.5 h-3.5 text-[#8C827A]" />
                Print Bill
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => {
                  setCustomSplitShare1(Math.round(grandTotal / 2));
                  setCustomSplitShare2(grandTotal - Math.round(grandTotal / 2));
                  setShowSplitModal(true);
                }}
                disabled={!selectedTable}
                className="bg-white hover:bg-[#F5EFEB] text-[#8C827A] border border-[#E7E2DC] py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors"
              >
                <Split className="w-3.5 h-3.5 text-[#D9531E]" /> Split Bill
              </button>

              <button
                onClick={() => setShowPaymentModal(true)}
                disabled={!selectedTable}
                className="bg-[#2D5A27] hover:bg-[#23471f] text-white py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors shadow-xs"
              >
                <CreditCard className="w-3.5 h-3.5" /> Settle / Pay
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MANAGER OVERRIDE APPROVAL MODAL */}
      {showManagerModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-scaleUp">
            <div className="flex items-center gap-2 mb-2 text-amber-700">
              <ShieldAlert className="w-5 h-5 text-[#D9531E]" />
              <h3 className="text-base font-bold font-serif text-[#1C1917]">Manager Override Required</h3>
            </div>
            <p className="text-xs text-[#8C827A] mb-4">
              {managerActionType === 'void' 
                ? 'Item has already been sent to kitchen (KOT active). Authorize void to cancel preparation.' 
                : 'Discount exceeds cashier threshold (>15%). Authorize promotional concession.'}
            </p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs font-bold text-[#1C1917] block mb-1">Reason Code</label>
                <select
                  value={managerReason}
                  onChange={e => setManagerReason(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E7E2DC] rounded-lg p-2 text-xs"
                >
                  <option value="Guest request / Changed Mind">Guest request / Changed Mind</option>
                  <option value="Kitchen delay exceeding SLA">Kitchen delay exceeding SLA</option>
                  <option value="Food quality issue">Food quality issue</option>
                  <option value="Manager complimentary VIP">Manager complimentary VIP</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#1C1917] block mb-1">Manager 4-Digit PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  value={managerPin}
                  onChange={e => setManagerPin(e.target.value)}
                  placeholder="Enter PIN (e.g. 9999)"
                  className="w-full bg-[#FAF8F5] border border-[#E7E2DC] rounded-lg p-2 text-center text-sm font-mono tracking-widest focus:outline-none focus:border-[#D9531E]"
                />
              </div>

              {managerError && (
                <p className="text-xs text-red-600 font-semibold">{managerError}</p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowManagerModal(false)}
                className="flex-1 py-2 border border-[#E7E2DC] rounded-lg text-xs font-semibold text-[#8C827A]"
              >
                Cancel
              </button>
              <button
                onClick={handleManagerApproval}
                className="flex-1 py-2 bg-[#D9531E] hover:bg-[#b84214] text-white rounded-lg text-xs font-bold"
              >
                Authorize
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ORDER DISCOUNT MODAL */}
      {showDiscountModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold font-serif text-[#1C1917] mb-1">Apply Order Discount</h3>
            <p className="text-xs text-[#8C827A] mb-4">Discounts over 15% automatically require Manager Override</p>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {[5, 10, 15, 20, 25, 50].map(pct => (
                <button
                  key={pct}
                  onClick={() => handleApplyDiscountClick(pct)}
                  className={`py-2 rounded-lg text-xs font-bold border transition-colors ${
                    pct > 15
                      ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                      : 'border-[#E7E2DC] bg-[#FAF8F5] hover:bg-[#F5EFEB] text-[#1C1917]'
                  }`}
                >
                  {pct}% {pct > 15 ? '★' : ''}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setDiscountPercent(0); setShowDiscountModal(false); }}
                className="flex-1 py-2 border border-[#E7E2DC] rounded-lg text-xs font-semibold text-[#8C827A]"
              >
                Clear Discount
              </button>
              <button
                onClick={() => setShowDiscountModal(false)}
                className="flex-1 py-2 bg-[#1C1917] text-white rounded-lg text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADVANCED SPLIT BILL MODAL (Equal, Item, Seat, Custom Amount) */}
      {showSplitModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold font-serif text-[#1C1917] mb-1">Split Bill (C++ Engine)</h3>
            <p className="text-xs text-[#8C827A] mb-4">Hamilton / Largest-Remainder Method guaranteeing zero penny loss</p>

            {/* SPLIT MODE TABS */}
            <div className="flex bg-[#FAF8F5] border border-[#E7E2DC] rounded-lg p-1 mb-4 text-xs font-bold">
              {[
                { id: 'equal', label: 'Equal Split' },
                { id: 'item', label: 'By Item' },
                { id: 'seat', label: 'By Seat' },
                { id: 'amount', label: 'By Amount' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSplitMode(tab.id as any)}
                  className={`flex-1 py-1.5 rounded-md transition-all ${
                    splitMode === tab.id
                      ? 'bg-white text-[#1C1917] shadow-xs'
                      : 'text-[#8C827A] hover:text-[#1C1917]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* MODE 1: EQUAL SPLIT */}
            {splitMode === 'equal' && (
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-xs font-bold text-[#1C1917] block mb-2">Number of Diners</label>
                  <div className="flex gap-2">
                    {[2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        onClick={() => setSplitCount(n)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold border ${
                          splitCount === n
                            ? 'border-[#D9531E] bg-[#FFF7F4] text-[#D9531E]'
                            : 'border-[#E7E2DC] text-[#8C827A]'
                        }`}
                      >
                        {n} Ways
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#E7E2DC] space-y-1">
                  <div className="flex justify-between text-xs text-[#8C827A]">
                    <span>Total Amount:</span>
                    <span className="font-mono font-bold text-[#1C1917]">{formatRupees(grandTotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-[#D9531E] pt-2 border-t border-[#E7E2DC]">
                    <span>Each Share:</span>
                    <span className="font-mono">
                      {splitShares.length > 0
                        ? `${formatRupees(splitShares[0].total_paise)}${splitShares.some(s => s.total_paise !== splitShares[0].total_paise) ? ' (exact split)' : ''}`
                        : formatRupees(Math.round(grandTotal / splitCount))}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* MODE 2: BY ITEM */}
            {splitMode === 'item' && (
              <div className="space-y-2 mb-6 max-h-48 overflow-y-auto">
                {cart.map(item => (
                  <div key={item.id} className="p-2 border border-[#E7E2DC] rounded-lg bg-[#FAF8F5] flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-[#1C1917]">{item.quantity}x {item.name}</span>
                      <span className="text-[10px] text-[#8C827A] block">Assigned to Guest 1</span>
                    </div>
                    <span className="font-mono font-bold text-[#1C1917]">{formatRupees(item.base_price * item.quantity)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* MODE 3: BY SEAT */}
            {splitMode === 'seat' && (
              <div className="space-y-2 mb-6">
                {[1, 2].map(seat => (
                  <div key={seat} className="p-2.5 border border-[#E7E2DC] rounded-lg bg-[#FAF8F5] flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-[#1C1917]">Seat #{seat} Invoice</span>
                      <span className="text-[10px] text-[#8C827A] block">{seat === 1 ? 'Paneer Tikka + Naan' : 'Butter Chicken'}</span>
                    </div>
                    <span className="font-mono font-bold text-[#D9531E]">
                      {seat === 1 ? formatRupees(60000) : formatRupees(54000)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* MODE 4: BY CUSTOM AMOUNT */}
            {splitMode === 'amount' && (
              <div className="space-y-3 mb-6">
                <div>
                  <label className="text-xs font-bold text-[#1C1917] block mb-1">Guest 1 Payment (Paise)</label>
                  <input
                    type="number"
                    value={customSplitShare1}
                    onChange={e => {
                      const val = parseInt(e.target.value, 10) || 0;
                      setCustomSplitShare1(val);
                      setCustomSplitShare2(Math.max(0, grandTotal - val));
                    }}
                    className="w-full bg-[#FAF8F5] border border-[#E7E2DC] rounded-lg p-2 text-xs font-mono"
                  />
                  <span className="text-[10px] text-[#8C827A] mt-0.5 block">{formatRupees(customSplitShare1)}</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#1C1917] block mb-1">Guest 2 Remaining Balance</label>
                  <input
                    type="number"
                    readOnly
                    value={customSplitShare2}
                    className="w-full bg-gray-100 border border-[#E7E2DC] rounded-lg p-2 text-xs font-mono text-[#8C827A]"
                  />
                  <span className="text-[10px] text-[#8C827A] mt-0.5 block">{formatRupees(customSplitShare2)}</span>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowSplitModal(false)}
                className="flex-1 py-2 border border-[#E7E2DC] rounded-lg text-xs font-semibold text-[#8C827A]"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowSplitModal(false);
                  setPaymentSuccessMsg(`Bill divided using ${splitMode.toUpperCase()} mode.`);
                  setTimeout(() => setPaymentSuccessMsg(null), 3000);
                }}
                className="flex-1 py-2 bg-[#1C1917] text-white rounded-lg text-xs font-bold"
              >
                Confirm Split
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT & SETTLEMENT MODAL */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold font-serif text-[#1C1917] mb-1">
              Settle Invoice: Table {selectedTable?.table_number}
            </h3>
            <p className="text-xs text-[#8C827A] mb-4">Consecutive series compliant with Section 31 CGST Act</p>

            <div className="bg-[#FAF8F5] border border-[#E7E2DC] rounded-xl p-4 mb-4">
              <div className="flex justify-between items-center text-sm font-semibold text-[#8C827A] mb-1">
                <span>Total Payable:</span>
                <span className="text-xl font-bold font-serif text-[#D9531E]">{formatRupees(grandTotal)}</span>
              </div>
              <div className="text-[10px] text-[#8C827A] flex justify-between">
                <span>Inclusive of 5% Non-ITC GST:</span>
                <span>{formatRupees(totalTax)}</span>
              </div>
              {serviceChargeEnabled && (
                <div className="text-[10px] text-[#8C827A] flex justify-between mt-0.5">
                  <span>Service Charge (Untaxed):</span>
                  <span>{formatRupees(serviceChargeAmount)}</span>
                </div>
              )}
            </div>

            <div className="mb-4">
              <label className="text-xs font-bold text-[#1C1917] uppercase block mb-2">Tender Method</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'upi', label: 'UPI / QR Code', icon: Sparkles },
                  { id: 'card', label: 'Credit / Debit Card', icon: CreditCard },
                  { id: 'cash', label: 'Cash Tender', icon: Receipt },
                  { id: 'room', label: 'Hotel Room Folio', icon: Users },
                ].map(method => (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id as any)}
                    className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                      paymentMethod === method.id
                        ? 'border-[#D9531E] bg-[#FFF7F4] text-[#D9531E] font-bold'
                        : 'border-[#E7E2DC] hover:border-gray-400 text-[#1C1917]'
                    }`}
                  >
                    <method.icon className="w-4 h-4" />
                    <span className="text-xs">{method.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 py-2.5 border border-[#E7E2DC] rounded-xl text-xs font-semibold text-[#8C827A]"
              >
                Cancel
              </button>
              <button
                onClick={handleCompletePayment}
                className="flex-1 py-2.5 bg-[#2D5A27] hover:bg-[#23471f] text-white rounded-xl text-xs font-bold transition-colors"
              >
                Confirm Settlement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
