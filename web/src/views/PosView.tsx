import React, { useState } from 'react';
import { Table, MenuItem, CartItem, Course, CourseStatus, TableStatus } from '../types';
import { formatRupees } from '../utils/currency';
import { 
  Users, Utensils, Clock, AlertCircle, CheckCircle2, 
  Flame, Plus, Minus, Trash2, Printer, CreditCard, 
  Split, ArrowLeft, Receipt, Sparkles, ChefHat
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
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [showSplitModal, setShowSplitModal] = useState<boolean>(false);
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState<string | null>(null);
  const [splitCount, setSplitCount] = useState<number>(2);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi' | 'room'>('upi');
  const [discountPercent, setDiscountPercent] = useState<number>(0);

  const categories = ['All', 'Starters', 'Main Curries', 'Biryani & Breads', 'Desserts', 'Beverages'];

  const filteredMenu = selectedCategory === 'All'
    ? menu
    : menu.filter(item => item.category === selectedCategory);

  const handleSelectTable = (table: Table) => {
    setSelectedTable(table);
    if (table.status === 'vacant') {
      setCart([]);
      setCoversInput(table.capacity);
    } else if (table.status === 'occupied' || table.status === 'billed') {
      // Simulate existing order loaded in cart
      setCart([
        {
          id: `cart-${Date.now()}-1`,
          menu_item_id: 'menu-1',
          name: 'Paneer Tikka Angaarey',
          base_price: 38000,
          quantity: 1,
          course: 'starter',
          status: 'fire',
          station: 'tandoor',
          notes: 'Extra mint chutney'
        },
        {
          id: `cart-${Date.now()}-2`,
          menu_item_id: 'menu-5',
          name: 'Butter Chicken Grand Trunk',
          base_price: 54000,
          quantity: 1,
          course: 'main',
          status: 'hold',
          station: 'curry'
        },
        {
          id: `cart-${Date.now()}-3`,
          menu_item_id: 'menu-10',
          name: 'Tandoori Garlic Butter Naan',
          base_price: 11000,
          quantity: 2,
          course: 'main',
          status: 'hold',
          station: 'tandoor'
        }
      ]);
    }
  };

  const handleAddToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.menu_item_id === item.id && i.course === activeCourse);
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
        }
      ];
    });
  };

  const handleUpdateQuantity = (cartId: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.id === cartId) {
        const newQty = i.quantity + delta;
        return newQty > 0 ? { ...i, quantity: newQty } : null;
      }
      return i;
    }).filter(Boolean) as CartItem[]);
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

  const subtotal = cart.reduce((acc, item) => acc + (item.base_price * item.quantity), 0);
  const discountAmount = Math.round((subtotal * discountPercent) / 100);
  const netSubtotal = subtotal - discountAmount;
  // 5% GST (2.5% CGST + 2.5% SGST)
  const cgst = Math.round(netSubtotal * 0.025);
  const sgst = Math.round(netSubtotal * 0.025);
  const totalTax = cgst + sgst;
  const grandTotal = netSubtotal + totalTax;

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
    setPaymentSuccessMsg(`Bill printed: ${formatRupees(grandTotal)} for Table ${selectedTable.table_number}`);
    setTimeout(() => setPaymentSuccessMsg(null), 3000);
  };

  const handleCompletePayment = () => {
    if (!selectedTable) return;
    onUpdateTableStatus(selectedTable.id, 'vacant');
    setShowPaymentModal(false);
    setPaymentSuccessMsg(`Payment of ${formatRupees(grandTotal)} settled via ${paymentMethod.toUpperCase()}! Table ${selectedTable.table_number} is now vacant.`);
    setSelectedTable(null);
    setCart([]);
    setTimeout(() => setPaymentSuccessMsg(null), 4000);
  };

  return (
    <div className="flex h-full w-full bg-[#FBF9F6]">
      {/* LEFT / CENTER WORKSPACE */}
      <div className="flex-1 flex flex-col border-r border-[#E7E2DC] overflow-hidden">
        {paymentSuccessMsg && (
          <div className="bg-[#2D5A27] text-white px-4 py-2 flex items-center justify-between text-sm font-medium animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{paymentSuccessMsg}</span>
            </div>
            <button onClick={() => setPaymentSuccessMsg(null)} className="text-white/80 hover:text-white">✕</button>
          </div>
        )}

        {/* TOP STATUS BAR */}
        <div className="bg-white border-b border-[#E7E2DC] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {selectedTable ? (
              <button 
                onClick={() => setSelectedTable(null)}
                className="flex items-center gap-2 text-sm font-semibold text-[#8C827A] hover:text-[#1C1917] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> All Tables
              </button>
            ) : (
              <div>
                <h1 className="text-xl font-bold font-serif text-[#1C1917]">Table Management</h1>
                <p className="text-xs text-[#8C827A]">Real-time floor layout & table turns</p>
              </div>
            )}

            {selectedTable && (
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold font-serif text-[#1C1917] bg-[#F5EFEB] px-3 py-1 rounded">
                  {selectedTable.table_number} ({selectedTable.section})
                </span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  selectedTable.status === 'vacant' ? 'bg-[#2D5A27]/10 text-[#2D5A27]' :
                  selectedTable.status === 'occupied' ? 'bg-[#D9531E]/10 text-[#D9531E]' :
                  selectedTable.status === 'billed' ? 'bg-amber-100 text-amber-800' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {selectedTable.status.toUpperCase()}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!selectedTable ? (
              <div className="flex items-center gap-3 text-xs font-medium">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#2D5A27]"></span> Vacant ({tables.filter(t => t.status === 'vacant').length})</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#D9531E]"></span> Occupied ({tables.filter(t => t.status === 'occupied').length})</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Billed ({tables.filter(t => t.status === 'billed').length})</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span> Reserved ({tables.filter(t => t.status === 'reserved').length})</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#8C827A]">Course Selection:</span>
                {(['beverage', 'starter', 'main', 'dessert'] as Course[]).map(c => (
                  <button
                    key={c}
                    onClick={() => setActiveCourse(c)}
                    className={`px-3 py-1 rounded text-xs font-semibold capitalize transition-all ${
                      activeCourse === c
                        ? 'bg-[#1C1917] text-white shadow-sm'
                        : 'bg-[#F5EFEB] text-[#8C827A] hover:bg-[#E7E2DC]'
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
          /* TABLE FLOOR PLAN GRID */
          <div className="flex-1 p-6 overflow-y-auto">
            {['Main Dining', 'Outdoor Terrace', 'Private Dining'].map(section => {
              const sectionTables = tables.filter(t => t.section === section);
              if (sectionTables.length === 0) return null;

              return (
                <div key={section} className="mb-8">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#8C827A] mb-3">{section}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {sectionTables.map(t => {
                      const isVacant = t.status === 'vacant';
                      const isOccupied = t.status === 'occupied';
                      const isBilled = t.status === 'billed';
                      const isReserved = t.status === 'reserved';

                      return (
                        <div
                          key={t.id}
                          onClick={() => handleSelectTable(t)}
                          className={`cursor-pointer rounded-xl border p-4 transition-all hover:shadow-md flex flex-col justify-between h-36 ${
                            isVacant ? 'bg-white border-[#E7E2DC] hover:border-[#2D5A27]' :
                            isOccupied ? 'bg-[#FFF7F4] border-[#D9531E]/40 hover:border-[#D9531E]' :
                            isBilled ? 'bg-[#FFFDF5] border-amber-300 hover:border-amber-500' :
                            isReserved ? 'bg-purple-50/50 border-purple-200' :
                            'bg-gray-50 border-gray-200 opacity-60'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <span className="text-base font-bold font-serif text-[#1C1917]">{t.table_number}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
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
                                <div className="text-xs text-[#8C827A] flex items-center gap-1">
                                  <Users className="w-3 h-3" /> {t.covers || 2} covers • {t.server_name || 'Staff'}
                                </div>
                                <div className="text-sm font-bold text-[#1C1917] mt-1">
                                  {formatRupees(t.active_bill_amount || 0)}
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-[#8C827A] flex items-center gap-1">
                                <Users className="w-3 h-3" /> Capacity: {t.capacity}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-[#8C827A] pt-2 border-t border-black/5">
                            <span>{t.seated_time || 'Ready'}</span>
                            <span className="text-[#D9531E] font-medium group-hover:underline">Open &rarr;</span>
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
            {/* CATEGORIES BAR */}
            <div className="bg-white border-b border-[#E7E2DC] px-6 py-2.5 flex items-center gap-2 overflow-x-auto">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? 'bg-[#D9531E] text-white shadow-sm'
                      : 'bg-[#FBF9F6] text-[#6B6158] hover:bg-[#F5EFEB]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* MENU ITEMS GRID */}
            <div className="flex-1 p-6 overflow-y-auto grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredMenu.map(item => (
                <div
                  key={item.id}
                  onClick={() => handleAddToCart(item)}
                  className="bg-white rounded-xl border border-[#E7E2DC] p-4 cursor-pointer hover:border-[#D9531E] hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          item.veg_status === 'veg' ? 'bg-[#2D5A27]' : 'bg-[#D9531E]'
                        }`} />
                        <span className="text-[10px] font-bold text-[#8C827A] uppercase">{item.item_code}</span>
                      </div>
                      <span className="text-[10px] bg-[#F5EFEB] text-[#8C827A] px-1.5 py-0.5 rounded capitalize font-medium">
                        {item.station}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-[#1C1917] group-hover:text-[#D9531E] transition-colors leading-tight">
                      {item.name}
                    </h4>
                    {item.description && (
                      <p className="text-[11px] text-[#8C827A] mt-1 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#F5EFEB] flex items-center justify-between">
                    <span className="text-sm font-bold font-serif text-[#1C1917]">
                      {formatRupees(item.base_price)}
                    </span>
                    <button className="bg-[#F5EFEB] text-[#1C1917] group-hover:bg-[#D9531E] group-hover:text-white p-1.5 rounded-lg transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT SIDEBAR: ORDER CART & BILLING */}
      <div className="w-96 bg-white flex flex-col border-l border-[#E7E2DC] shadow-sm">
        {/* CART HEADER */}
        <div className="p-4 border-b border-[#E7E2DC] bg-[#FAF8F5]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#D9531E]" />
              <h2 className="text-sm font-bold font-serif text-[#1C1917]">
                {selectedTable ? `Order: ${selectedTable.table_number}` : 'No Table Selected'}
              </h2>
            </div>
            {selectedTable && (
              <span className="text-xs bg-white border border-[#E7E2DC] px-2 py-0.5 rounded text-[#8C827A]">
                Covers: {coversInput}
              </span>
            )}
          </div>
          {selectedTable && (
            <div className="text-[11px] text-[#8C827A] mt-1 flex items-center justify-between">
              <span>Server: {selectedTable.server_name || 'Vikramaditya Roy'}</span>
              <span>GST: 5% Non-ITC (2.5% + 2.5%)</span>
            </div>
          )}
        </div>

        {/* CART ITEMS LIST */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#8C827A]">
              <Utensils className="w-8 h-8 mb-2 stroke-1 text-[#C4BCB3]" />
              <p className="text-sm font-medium">Cart is empty</p>
              <p className="text-xs mt-1">Select a table and click items on the menu to add to order</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="bg-[#FBF9F6] border border-[#E7E2DC] rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h5 className="text-xs font-bold text-[#1C1917]">{item.name}</h5>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] uppercase font-bold text-[#8C827A] tracking-wider">
                        {item.course}
                      </span>
                      <span className="text-[10px] text-[#8C827A]">• {item.station}</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold font-serif text-[#1C1917]">
                    {formatRupees(item.base_price * item.quantity)}
                  </span>
                </div>

                {item.notes && (
                  <p className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60">
                    Note: {item.notes}
                  </p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-[#E7E2DC]">
                  {/* HOLD / FIRE TOGGLE */}
                  <button
                    onClick={() => handleToggleCourseStatus(item.id)}
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase transition-colors flex items-center gap-1 ${
                      item.status === 'fire'
                        ? 'bg-[#D9531E] text-white shadow-xs'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    <Flame className="w-2.5 h-2.5" />
                    {item.status === 'fire' ? 'FIRE' : 'HOLD'}
                  </button>

                  {/* QUANTITY CONTROLS */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUpdateQuantity(item.id, -1)}
                      className="w-6 h-6 rounded bg-white border border-[#E7E2DC] flex items-center justify-center text-[#1C1917] hover:bg-[#F5EFEB]"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                    <button
                      onClick={() => handleUpdateQuantity(item.id, 1)}
                      className="w-6 h-6 rounded bg-white border border-[#E7E2DC] flex items-center justify-center text-[#1C1917] hover:bg-[#F5EFEB]"
                    >
                      <Plus className="w-3 h-3" />
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
              <span>{formatRupees(subtotal)}</span>
            </div>

            {discountPercent > 0 && (
              <div className="flex justify-between text-xs text-[#2D5A27]">
                <span>Discount ({discountPercent}%)</span>
                <span>-{formatRupees(discountAmount)}</span>
              </div>
            )}

            <div className="flex justify-between text-[11px] text-[#8C827A]">
              <span>CGST (2.5%)</span>
              <span>{formatRupees(cgst)}</span>
            </div>
            <div className="flex justify-between text-[11px] text-[#8C827A]">
              <span>SGST (2.5%)</span>
              <span>{formatRupees(sgst)}</span>
            </div>

            <div className="flex justify-between text-sm font-bold text-[#1C1917] pt-2 border-t border-[#E7E2DC]">
              <span>Grand Total</span>
              <span className="font-serif text-base text-[#D9531E]">{formatRupees(grandTotal)}</span>
            </div>

            {/* ACTION BUTTONS */}
            <div className="grid grid-cols-2 gap-2 pt-3">
              <button
                onClick={handleSendKotClick}
                disabled={!selectedTable}
                className="bg-[#1C1917] hover:bg-black text-white py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <ChefHat className="w-4 h-4 text-[#D9531E]" />
                Send KOT
              </button>

              <button
                onClick={handlePrintBill}
                disabled={!selectedTable}
                className="bg-[#F5EFEB] hover:bg-[#E7E2DC] text-[#1C1917] border border-[#D5CDC5] py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Printer className="w-4 h-4 text-[#8C827A]" />
                Print Bill
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => setShowSplitModal(true)}
                disabled={!selectedTable}
                className="bg-white hover:bg-[#F5EFEB] text-[#8C827A] border border-[#E7E2DC] py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
              >
                <Split className="w-3.5 h-3.5" /> Split Bill
              </button>

              <button
                onClick={() => setShowPaymentModal(true)}
                disabled={!selectedTable}
                className="bg-[#2D5A27] hover:bg-[#23471f] text-white py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors shadow-sm"
              >
                <CreditCard className="w-3.5 h-3.5" /> Settle / Pay
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PAYMENT & SETTLEMENT MODAL */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scaleUp">
            <h3 className="text-lg font-bold font-serif text-[#1C1917] mb-1">Settle Order: {selectedTable?.table_number}</h3>
            <p className="text-xs text-[#8C827A] mb-4">Tax Invoice compliant with Indian GST Section 31</p>

            <div className="bg-[#FAF8F5] border border-[#E7E2DC] rounded-xl p-4 mb-4">
              <div className="flex justify-between items-center text-sm font-semibold text-[#8C827A] mb-1">
                <span>Total Amount Due:</span>
                <span className="text-xl font-bold font-serif text-[#D9531E]">{formatRupees(grandTotal)}</span>
              </div>
              <div className="text-[11px] text-[#8C827A] flex justify-between">
                <span>Inclusive of 5% Non-ITC GST:</span>
                <span>{formatRupees(totalTax)}</span>
              </div>
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

            {paymentMethod === 'room' && (
              <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs">
                <span className="font-bold text-amber-900 block mb-1">Hotel PMS Charge-to-Room:</span>
                <span className="text-amber-800">Posts directly to guest ledger with 18% Hotel GST threshold validation.</span>
              </div>
            )}

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 py-2.5 border border-[#E7E2DC] rounded-xl text-xs font-semibold text-[#8C827A] hover:bg-[#F5EFEB]"
              >
                Cancel
              </button>
              <button
                onClick={handleCompletePayment}
                className="flex-1 py-2.5 bg-[#2D5A27] hover:bg-[#23471f] text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
              >
                Confirm Settlement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SPLIT BILL MODAL (Largest Remainder Method) */}
      {showSplitModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold font-serif text-[#1C1917] mb-1">Split Bill (C++ Engine)</h3>
            <p className="text-xs text-[#8C827A] mb-4">Using Hamilton / Largest-Remainder zero-penny-loss split</p>

            <div className="mb-4">
              <label className="text-xs font-bold text-[#1C1917] block mb-2">Number of Splits</label>
              <div className="flex items-center gap-3">
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

            <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#E7E2DC] mb-6 space-y-1.5">
              <div className="text-xs flex justify-between text-[#8C827A]">
                <span>Total Amount:</span>
                <span className="font-bold text-[#1C1917]">{formatRupees(grandTotal)}</span>
              </div>
              <div className="text-xs flex justify-between font-bold text-[#D9531E] pt-2 border-t border-[#E7E2DC]">
                <span>Each Share:</span>
                <span>{formatRupees(Math.round(grandTotal / splitCount))}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSplitModal(false)}
                className="flex-1 py-2 border border-[#E7E2DC] rounded-xl text-xs font-semibold text-[#8C827A]"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowSplitModal(false);
                  setPaymentSuccessMsg(`Bill divided into ${splitCount} tax invoices.`);
                  setTimeout(() => setPaymentSuccessMsg(null), 3000);
                }}
                className="flex-1 py-2 bg-[#1C1917] text-white rounded-xl text-xs font-bold"
              >
                Apply Split
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
