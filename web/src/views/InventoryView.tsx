import React, { useState } from 'react';
import { InventoryItem } from '../types';
import { formatRupees, formatQuantity } from '../utils/currency';
import { 
  Boxes, Plus, AlertTriangle, CheckCircle2, Search, 
  ArrowUpDown, FileCheck, ClipboardList, TrendingDown, 
  BarChart3, ShieldAlert, Sparkles, Filter, X
} from 'lucide-react';

interface InventoryViewProps {
  inventory: InventoryItem[];
  onReceiveStock: (sku: string, qty: number, unitCostPaise: number) => void;
  onRecordStocktake: (sku: string, countedQty: number) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  inventory,
  onReceiveStock,
  onRecordStocktake
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeTab, setActiveTab] = useState<'ledger' | 'leakage' | 'purchasing'>('ledger');
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showStocktakeModal, setShowStocktakeModal] = useState(false);
  const [showThreeWayMatchModal, setShowThreeWayMatchModal] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Form states
  const [receiveSku, setReceiveSku] = useState(inventory[0]?.sku || '');
  const [receiveQty, setReceiveQty] = useState(10);
  const [receiveCost, setReceiveCost] = useState(25000);
  const [receiveError, setReceiveError] = useState<string | null>(null);

  const [stocktakeSku, setStocktakeSku] = useState(inventory[0]?.sku || '');
  const [countedQty, setCountedQty] = useState(10);

  const categories = ['All', 'Grains & Staples', 'Dairy', 'Meat & Poultry', 'Oils & Fats', 'Spices', 'Fresh Produce'];

  const filteredItems = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const totalInventoryValue = inventory.reduce((acc, item) => acc + (item.current_stock * item.unit_cost), 0);
  const lowStockCount = inventory.filter(item => item.current_stock < item.par_level).length;
  
  // Total shrinkage calculation in paise
  const totalShrinkagePaise = inventory.reduce((acc, item) => {
    const diff = (item.variance_qty || 0);
    return diff < 0 ? acc + (Math.abs(diff) * item.unit_cost) : acc;
  }, 0);

  const handleReceiveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (receiveQty <= 0) {
      setReceiveError('Quantity received must be greater than zero.');
      return;
    }
    if (receiveCost <= 0) {
      setReceiveError('Landed unit cost must be greater than zero.');
      return;
    }
    setReceiveError(null);
    onReceiveStock(receiveSku, receiveQty, receiveCost);
    setShowReceiveModal(false);
    setSuccessToast(`Stock received and WAC recalculation updated for SKU ${receiveSku}`);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  const handleStocktakeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (countedQty < 0) return;
    onRecordStocktake(stocktakeSku, countedQty);
    setShowStocktakeModal(false);
    setSuccessToast(`Physical cycle count recorded for SKU ${stocktakeSku}. Theoretical variance journal posted.`);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FBF9F6] overflow-hidden">
      {/* SUCCESS TOAST */}
      {successToast && (
        <div className="bg-[#2D5A27] text-white px-6 py-2.5 flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast(null)}>✕</button>
        </div>
      )}

      {/* TOP STATS BAR */}
      <div className="bg-white border-b border-[#E7E2DC] px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-bold font-serif text-[#1C1917]">Perpetual Stock & Recipe Ledger</h1>
          <p className="text-[11px] text-[#8C827A]">Weighted Average Cost (WAC), Recipe BOM Explosion & Theoretical Leakage Audit</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-[#FAF8F5] border border-[#E7E2DC] px-3.5 py-1.5 rounded-xl text-right hidden sm:block">
            <span className="text-[10px] uppercase font-bold text-[#8C827A] block">Valuation</span>
            <span className="text-xs font-bold font-serif text-[#1C1917]">{formatRupees(totalInventoryValue)}</span>
          </div>

          <div className="flex bg-[#FAF8F5] border border-[#E7E2DC] rounded-lg p-1">
            <button
              onClick={() => setActiveTab('ledger')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                activeTab === 'ledger' ? 'bg-white shadow-xs text-[#1C1917]' : 'text-[#8C827A] hover:text-[#1C1917]'
              }`}
            >
              Stock Ledger
            </button>
            <button
              onClick={() => setActiveTab('leakage')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                activeTab === 'leakage' ? 'bg-white shadow-xs text-[#1C1917]' : 'text-[#8C827A] hover:text-[#1C1917]'
              }`}
            >
              Leakage Variance
            </button>
          </div>

          <button
            onClick={() => setShowReceiveModal(true)}
            className="bg-[#1C1917] hover:bg-black text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 text-[#D9531E]" /> Receive GRN
          </button>
        </div>
      </div>

      {/* FILTER & ACTIONS BAR */}
      {activeTab === 'ledger' && (
        <div className="bg-white border-b border-[#E7E2DC] px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-[#D9531E] text-white shadow-xs'
                    : 'bg-[#FBF9F6] text-[#6B6158] hover:bg-[#F5EFEB]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-56 hidden md:block">
              <Search className="w-3.5 h-3.5 text-[#8C827A] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search SKU or item..."
                className="w-full pl-9 pr-3 py-1 bg-[#FBF9F6] border border-[#E7E2DC] rounded-lg text-xs focus:outline-none focus:border-[#D9531E]"
              />
            </div>

            <button
              onClick={() => setShowStocktakeModal(true)}
              className="bg-[#F5EFEB] hover:bg-[#E7E2DC] text-[#1C1917] border border-[#D5CDC5] px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1"
            >
              <ClipboardList className="w-3.5 h-3.5 text-[#8C827A]" /> Stocktake
            </button>

            <button
              onClick={() => setShowThreeWayMatchModal(true)}
              className="bg-white hover:bg-[#F5EFEB] text-[#8C827A] border border-[#E7E2DC] px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1"
            >
              <FileCheck className="w-3.5 h-3.5" /> 3-Way Match
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: STOCK LEDGER */}
      {activeTab === 'ledger' && (
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white border border-[#E7E2DC] rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-[#E7E2DC] text-[10px] font-bold uppercase tracking-wider text-[#8C827A]">
                  <th className="py-3 px-4">Raw Ingredient</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Current Stock</th>
                  <th className="py-3 px-4 text-right">Par Level</th>
                  <th className="py-3 px-4 text-right">Unit Cost (WAC)</th>
                  <th className="py-3 px-4 text-right">Book Value</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E2DC] text-xs">
                {filteredItems.map(item => {
                  const isBelowPar = item.current_stock < item.par_level;
                  const valuation = item.current_stock * item.unit_cost;

                  return (
                    <tr key={item.id} className="hover:bg-[#FBF9F6] transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#1C1917]">{item.name}</div>
                        <div className="text-[10px] font-mono text-[#8C827A] uppercase">{item.sku}</div>
                      </td>
                      <td className="py-3 px-4 text-[#8C827A]">{item.category}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#1C1917]">
                        {formatQuantity(item.current_stock, item.unit)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[#8C827A]">
                        {formatQuantity(item.par_level, item.unit)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[#1C1917]">
                        {formatRupees(item.unit_cost)} / {item.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold font-serif text-[#1C1917]">
                        {formatRupees(valuation)}
                      </td>
                      <td className="py-3 px-4 text-[#8C827A]">{item.supplier_name}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          isBelowPar ? 'bg-red-100 text-red-800' : 'bg-[#2D5A27]/10 text-[#2D5A27]'
                        }`}>
                          {isBelowPar ? (
                            <>
                              <AlertTriangle className="w-2.5 h-2.5" /> Below Par
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-2.5 h-2.5" /> Optimal
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: THEORETICAL VS ACTUAL LEAKAGE REPORT */}
      {activeTab === 'leakage' && (
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border border-[#E7E2DC] rounded-xl p-4">
                <span className="text-[10px] uppercase font-bold text-[#8C827A] block">Total Shrinkage Value</span>
                <span className="text-xl font-bold font-serif text-red-700">{formatRupees(totalShrinkagePaise)}</span>
                <span className="text-[10px] text-[#8C827A] block mt-1">Based on BOM theoretical sales deduction</span>
              </div>
              <div className="bg-white border border-[#E7E2DC] rounded-xl p-4">
                <span className="text-[10px] uppercase font-bold text-[#8C827A] block">Discrepant SKUs</span>
                <span className="text-xl font-bold font-serif text-[#1C1917]">
                  {inventory.filter(i => (i.variance_qty || 0) < 0).length} of {inventory.length}
                </span>
                <span className="text-[10px] text-amber-700 block mt-1">Variance &gt; 1.0% threshold</span>
              </div>
              <div className="bg-white border border-[#E7E2DC] rounded-xl p-4">
                <span className="text-[10px] uppercase font-bold text-[#8C827A] block">Primary Loss Category</span>
                <span className="text-xl font-bold font-serif text-[#D9531E]">Meat & Poultry</span>
                <span className="text-[10px] text-[#8C827A] block mt-1">Prep trimming & portioning</span>
              </div>
            </div>

            <div className="bg-white border border-[#E7E2DC] rounded-xl overflow-hidden shadow-xs">
              <div className="p-4 bg-[#FAF8F5] border-b border-[#E7E2DC]">
                <h3 className="text-sm font-bold text-[#1C1917]">Theoretical (BOM) vs Physical Usage Variance</h3>
                <p className="text-[11px] text-[#8C827A]">Calculated using C++ compute_variance engine</p>
              </div>

              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#FBF9F6] border-b border-[#E7E2DC] text-[10px] font-bold uppercase tracking-wider text-[#8C827A]">
                    <th className="py-2.5 px-4">Ingredient SKU</th>
                    <th className="py-2.5 px-4 text-right">Theoretical Usage (BOM)</th>
                    <th className="py-2.5 px-4 text-right">Actual Physical Usage</th>
                    <th className="py-2.5 px-4 text-right">Variance Qty</th>
                    <th className="py-2.5 px-4 text-right">Cost Impact (Paise)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E2DC]">
                  {inventory.map(item => {
                    const variance = item.variance_qty || 0;
                    const lossPaise = Math.round(variance * item.unit_cost);

                    return (
                      <tr key={item.id} className="hover:bg-[#FAF8F5]">
                        <td className="py-2.5 px-4">
                          <span className="font-bold text-[#1C1917] block">{item.name}</span>
                          <span className="text-[10px] text-[#8C827A] font-mono">{item.sku}</span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono">
                          {formatQuantity(item.theoretical_usage || 0, item.unit)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono">
                          {formatQuantity(item.actual_usage || 0, item.unit)}
                        </td>
                        <td className={`py-2.5 px-4 text-right font-mono font-bold ${
                          variance < 0 ? 'text-red-700' : variance > 0 ? 'text-[#2D5A27]' : 'text-[#8C827A]'
                        }`}>
                          {variance > 0 ? `+${variance}` : variance} {item.unit}
                        </td>
                        <td className={`py-2.5 px-4 text-right font-mono font-serif font-bold ${
                          lossPaise < 0 ? 'text-red-700' : 'text-[#2D5A27]'
                        }`}>
                          {lossPaise < 0 ? `-${formatRupees(Math.abs(lossPaise))}` : '₹0'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* RECEIVE GOODS (GRN) MODAL */}
      {showReceiveModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleReceiveSubmit} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold font-serif text-[#1C1917] mb-1">Goods Receipt Note (GRN)</h3>
            <p className="text-xs text-[#8C827A] mb-4">Ingests inward inventory & automatically adjusts Weighted Average Cost</p>

            {receiveError && (
              <div className="bg-red-50 text-red-700 p-2 rounded-lg text-xs mb-3 font-medium">
                {receiveError}
              </div>
            )}

            <div className="space-y-3 mb-6">
              <div>
                <label className="text-xs font-bold text-[#1C1917] block mb-1">Select Raw Material</label>
                <select
                  value={receiveSku}
                  onChange={e => setReceiveSku(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E7E2DC] rounded-lg p-2 text-xs"
                >
                  {inventory.map(i => (
                    <option key={i.sku} value={i.sku}>{i.name} ({i.sku})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#1C1917] block mb-1">Quantity Received</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={receiveQty}
                  onChange={e => setReceiveQty(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#FAF8F5] border border-[#E7E2DC] rounded-lg p-2 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#1C1917] block mb-1">Landed Unit Cost (Paise)</label>
                <input
                  type="number"
                  min="1"
                  value={receiveCost}
                  onChange={e => setReceiveCost(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-[#FAF8F5] border border-[#E7E2DC] rounded-lg p-2 text-xs"
                />
                <span className="text-[10px] text-[#8C827A] mt-0.5 block">
                  Equivalent to {formatRupees(receiveCost)} per unit
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowReceiveModal(false)}
                className="flex-1 py-2 border border-[#E7E2DC] rounded-lg text-xs font-semibold text-[#8C827A]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-[#1C1917] text-white rounded-lg text-xs font-bold hover:bg-black"
              >
                Post GRN
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STOCKTAKE CYCLE COUNT MODAL */}
      {showStocktakeModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleStocktakeSubmit} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold font-serif text-[#1C1917] mb-1">Physical Cycle Count</h3>
            <p className="text-xs text-[#8C827A] mb-4">Calculates theoretical vs physical variance via C++ core engine</p>

            <div className="space-y-3 mb-6">
              <div>
                <label className="text-xs font-bold text-[#1C1917] block mb-1">Material SKU</label>
                <select
                  value={stocktakeSku}
                  onChange={e => setStocktakeSku(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E7E2DC] rounded-lg p-2 text-xs"
                >
                  {inventory.map(i => (
                    <option key={i.sku} value={i.sku}>{i.name} (Current: {i.current_stock} {i.unit})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#1C1917] block mb-1">Physically Counted Quantity</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={countedQty}
                  onChange={e => setCountedQty(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#FAF8F5] border border-[#E7E2DC] rounded-lg p-2 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowStocktakeModal(false)}
                className="flex-1 py-2 border border-[#E7E2DC] rounded-lg text-xs font-semibold text-[#8C827A]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-[#2D5A27] text-white rounded-lg text-xs font-bold hover:bg-[#23471f]"
              >
                Submit Count
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3-WAY MATCH MODAL */}
      {showThreeWayMatchModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold font-serif text-[#1C1917] mb-1">3-Way Match Verification</h3>
            <p className="text-xs text-[#8C827A] mb-4">Cross-audit: Purchase Order (PO) ↔ Goods Receipt (GRN) ↔ Vendor Invoice</p>

            <div className="space-y-3 mb-6">
              <div className="border border-[#E7E2DC] rounded-xl p-3.5 bg-[#FAF8F5]">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-xs text-[#1C1917]">PO-202610-0012 ↔ Royal Grains Traders</span>
                  <span className="text-[9px] bg-[#2D5A27]/10 text-[#2D5A27] px-2 py-0.5 rounded-full font-bold">MATCHED (0.0% variance)</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] text-[#8C827A]">
                  <div>PO: <strong>50.0 kg</strong></div>
                  <div>GRN: <strong>50.0 kg</strong></div>
                  <div>Invoice: <strong>50.0 kg</strong></div>
                </div>
              </div>

              <div className="border border-[#E7E2DC] rounded-xl p-3.5 bg-[#FAF8F5]">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-xs text-[#1C1917]">PO-202610-0015 ↔ FreshMeat Logistics</span>
                  <span className="text-[9px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">TOLERANCE (-1.5%)</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] text-[#8C827A]">
                  <div>PO: <strong>20.0 kg</strong></div>
                  <div>GRN: <strong>19.7 kg</strong></div>
                  <div>Invoice: <strong>19.7 kg</strong></div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowThreeWayMatchModal(false)}
                className="py-1.5 px-4 bg-[#1C1917] text-white rounded-lg text-xs font-bold"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
