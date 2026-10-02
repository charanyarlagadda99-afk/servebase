import React, { useState, useEffect } from 'react';
import { 
  INITIAL_TABLES, 
  INITIAL_MENU, 
  INITIAL_KDS_TICKETS, 
  INITIAL_INVENTORY, 
  INITIAL_STAFF, 
  INITIAL_ROOMS, 
  INITIAL_ALERTS 
} from './data/mockData';
import { Table, MenuItem, KdsTicket, InventoryItem, StaffMember, Room, SystemAlert, CartItem, TableStatus } from './types';
import { PosView } from './views/PosView';
import { KdsView } from './views/KdsView';
import { InventoryView } from './views/InventoryView';
import { StaffView } from './views/StaffView';
import { HotelView } from './views/HotelView';
import { ReportsView } from './views/ReportsView';
import { checkBackendHealth } from './api/client';
import { 
  LayoutGrid, ChefHat, Boxes, Users, Building2, 
  FileSpreadsheet, ShieldCheck, Cpu, Wifi, Bell, 
  Command, Search, X, Check, ArrowRight
} from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pos' | 'kds' | 'inventory' | 'staff' | 'hotel' | 'reports'>('pos');
  const [selectedOutlet, setSelectedOutlet] = useState<string>('ServeBase Flagship Bistro & Bar');
  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(false);
  const [showCommandPalette, setShowCommandPalette] = useState<boolean>(false);
  const [commandQuery, setCommandQuery] = useState<string>('');
  
  // Application Data States
  const [tables, setTables] = useState<Table[]>(INITIAL_TABLES);
  const [menu, setMenu] = useState<MenuItem[]>(INITIAL_MENU);
  const [tickets, setTickets] = useState<KdsTicket[]>(INITIAL_KDS_TICKETS);
  const [inventory, setInventory] = useState<InventoryItem[]>(INITIAL_INVENTORY);
  const [staff, setStaff] = useState<StaffMember[]>(INITIAL_STAFF);
  const [rooms, setRooms] = useState<Room[]>(INITIAL_ROOMS);
  const [alerts, setAlerts] = useState<SystemAlert[]>(INITIAL_ALERTS);

  // Check backend health periodically
  useEffect(() => {
    checkBackendHealth().then(res => setIsBackendOnline(res.online));
    const interval = setInterval(() => {
      checkBackendHealth().then(res => setIsBackendOnline(res.online));
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Global Keyboard Shortcuts (Ctrl+K or Cmd+K for Command Palette)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      } else if (e.key === 'Escape') {
        setShowCommandPalette(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Table status updater
  const handleUpdateTableStatus = (tableId: string, status: TableStatus, billAmount?: number) => {
    setTables(prev => prev.map(t => {
      if (t.id === tableId) {
        return {
          ...t,
          status,
          active_bill_amount: status === 'vacant' ? 0 : (billAmount !== undefined ? billAmount : t.active_bill_amount),
          current_order_id: status === 'vacant' ? undefined : t.current_order_id,
          idle_minutes: 0,
        };
      }
      return t;
    }));
  };

  // Send KOT from POS to Kitchen
  const handleSendKot = (tableNumber: string, items: CartItem[]) => {
    const stations = Array.from(new Set(items.map(i => i.station)));
    
    stations.forEach((st, idx) => {
      const stationItems = items.filter(i => i.station === st);
      const newTicket: KdsTicket = {
        id: `kot-${Date.now()}-${idx}`,
        kot_number: `KOT-20261002-${Math.floor(1000 + Math.random() * 9000)}`,
        order_id: `ord-${Date.now()}`,
        table_number: tableNumber,
        server_name: 'Rahul Sharma',
        station: st,
        created_at: new Date().toISOString(),
        status: 'open',
        items: stationItems.map((si, sidx) => ({
          id: `ki-${Date.now()}-${sidx}`,
          name: si.name,
          quantity: si.quantity,
          course: si.course,
          status: 'pending',
          notes: si.notes,
          station: si.station
        }))
      };

      setTickets(prev => [newTicket, ...prev]);
    });
  };

  // KDS Handlers
  const handleBumpTicket = (ticketId: string) => {
    setTickets(prev => prev.map(t => {
      if (t.id === ticketId) {
        return {
          ...t,
          status: 'completed',
          items: t.items.map(i => ({ ...i, status: 'ready' }))
        };
      }
      return t;
    }));
  };

  const handleBumpItem = (ticketId: string, itemId: string) => {
    setTickets(prev => prev.map(t => {
      if (t.id === ticketId) {
        const updatedItems = t.items.map(i => {
          if (i.id === itemId) {
            const nextStatus: 'pending' | 'preparing' | 'ready' = 
              i.status === 'pending' ? 'preparing' : 
              i.status === 'preparing' ? 'ready' : 'pending';
            return { ...i, status: nextStatus };
          }
          return i;
        });
        const allReady = updatedItems.every(i => i.status === 'ready');
        return {
          ...t,
          items: updatedItems,
          status: allReady ? 'completed' : t.status
        };
      }
      return t;
    }));
  };

  const handleRecallTicket = (ticketId: string) => {
    setTickets(prev => prev.map(t => {
      if (t.id === ticketId) {
        return {
          ...t,
          status: 'open',
          items: t.items.map(i => ({ ...i, status: 'preparing' }))
        };
      }
      return t;
    }));
  };

  // Inventory Handlers
  const handleReceiveStock = (sku: string, qty: number, unitCostPaise: number) => {
    setInventory(prev => prev.map(item => {
      if (item.sku === sku) {
        const oldTotalCost = item.current_stock * item.unit_cost;
        const newInwardCost = qty * unitCostPaise;
        const newTotalStock = item.current_stock + qty;
        const newWac = Math.round((oldTotalCost + newInwardCost) / newTotalStock);

        return {
          ...item,
          current_stock: newTotalStock,
          unit_cost: newWac,
          last_received_at: new Date().toISOString()
        };
      }
      return item;
    }));
  };

  const handleRecordStocktake = (sku: string, countedQty: number) => {
    setInventory(prev => prev.map(item => {
      if (item.sku === sku) {
        const variance = countedQty - item.current_stock;
        return {
          ...item,
          current_stock: countedQty,
          variance_qty: variance
        };
      }
      return item;
    }));
  };

  // Staff Handlers
  const handleClockToggle = (staffId: string) => {
    setStaff(prev => prev.map(s => {
      if (s.id === staffId) {
        const isClockedIn = s.status === 'clocked_in';
        return {
          ...s,
          status: isClockedIn ? 'clocked_out' : 'clocked_in',
          clock_in_time: isClockedIn ? undefined : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
      }
      return s;
    }));
  };

  // Hotel Handlers
  const handleUpdateRoomStatus = (roomId: string, status: Room['status'], cleanStatus?: Room['clean_status']) => {
    setRooms(prev => prev.map(r => {
      if (r.id === roomId) {
        return {
          ...r,
          status,
          clean_status: cleanStatus || r.clean_status,
          guest_name: status === 'vacant' ? undefined : r.guest_name,
          current_folio_balance: status === 'vacant' ? 0 : r.current_folio_balance
        };
      }
      return r;
    }));
  };

  const handlePostCharge = (roomId: string, amountPaise: number, description: string) => {
    setRooms(prev => prev.map(r => {
      if (r.id === roomId) {
        const newCharge = {
          id: `chg-${Date.now()}`,
          desc: description,
          amount: amountPaise,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          is_reversed: false
        };
        return {
          ...r,
          current_folio_balance: r.current_folio_balance + amountPaise,
          charges_history: [newCharge, ...(r.charges_history || [])]
        };
      }
      return r;
    }));

    const newAlert: SystemAlert = {
      id: `alt-${Date.now()}`,
      title: 'Room Charge Posted',
      message: `Charge of ₹${(amountPaise/100).toFixed(2)} (${description}) posted to Room`,
      severity: 'info',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      resolved: false,
      category: 'security'
    };
    setAlerts(prev => [newAlert, ...prev]);
  };

  const handleReverseCharge = (roomId: string, chargeId: string) => {
    setRooms(prev => prev.map(r => {
      if (r.id === roomId && r.charges_history) {
        const targetCharge = r.charges_history.find(c => c.id === chargeId);
        if (!targetCharge || targetCharge.is_reversed) return r;

        return {
          ...r,
          current_folio_balance: Math.max(0, r.current_folio_balance - targetCharge.amount),
          charges_history: r.charges_history.map(c => c.id === chargeId ? { ...c, is_reversed: true } : c)
        };
      }
      return r;
    }));

    const newAlert: SystemAlert = {
      id: `alt-${Date.now()}`,
      title: 'Room Charge Reversed',
      message: `Incidental charge voided and credited back to guest folio.`,
      severity: 'info',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      resolved: false,
      category: 'security'
    };
    setAlerts(prev => [newAlert, ...prev]);
  };

  const handleCheckIn = (roomId: string, guestName: string) => {
    setRooms(prev => prev.map(r => {
      if (r.id === roomId) {
        return {
          ...r,
          status: 'occupied',
          guest_name: guestName,
          check_in_date: '2026-10-02',
          current_folio_balance: 0,
          charges_history: []
        };
      }
      return r;
    }));
  };

  const handleCheckOut = (roomId: string) => {
    setRooms(prev => prev.map(r => {
      if (r.id === roomId) {
        return {
          ...r,
          status: 'vacant',
          clean_status: 'dirty',
          guest_name: undefined,
          current_folio_balance: 0,
          charges_history: []
        };
      }
      return r;
    }));
  };

  const handleResolveAlert = (alertId: string) => {
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, resolved: true } : a));
  };

  const unreadAlertsCount = alerts.filter(a => !a.resolved).length;
  const activeKotCount = tickets.filter(t => t.status === 'open').length;

  // Command Palette Options
  const commands = [
    { id: 'pos', title: 'Open POS & Floor Plan', category: 'Navigation', action: () => { setActiveTab('pos'); setShowCommandPalette(false); } },
    { id: 'kds', title: 'Open Kitchen KDS Display', category: 'Navigation', action: () => { setActiveTab('kds'); setShowCommandPalette(false); } },
    { id: 'inventory', title: 'Open Stock & Recipe Ledger', category: 'Navigation', action: () => { setActiveTab('inventory'); setShowCommandPalette(false); } },
    { id: 'staff', title: 'Open Staff & Payroll Terminal', category: 'Navigation', action: () => { setActiveTab('staff'); setShowCommandPalette(false); } },
    { id: 'hotel', title: 'Open Hotel PMS Room Grid', category: 'Navigation', action: () => { setActiveTab('hotel'); setShowCommandPalette(false); } },
    { id: 'reports', title: 'Open Financials & Z-Report', category: 'Navigation', action: () => { setActiveTab('reports'); setShowCommandPalette(false); } },
    { id: 'audit', title: 'Verify Cryptographic SHA-256 Chain', category: 'Security', action: () => { setActiveTab('reports'); setShowCommandPalette(false); } },
  ];

  const filteredCommands = commands.filter(c => 
    c.title.toLowerCase().includes(commandQuery.toLowerCase()) || 
    c.category.toLowerCase().includes(commandQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#FBF9F6]">
      {/* GLOBAL TOP NAVIGATION BAR */}
      <header className="bg-[#1C1917] text-white border-b border-black/40 px-4 sm:px-6 py-2.5 flex items-center justify-between select-none">
        {/* BRAND & OUTLET SELECTOR */}
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setActiveTab('pos')}>
            <div className="w-8 h-8 rounded-lg bg-[#D9531E] flex items-center justify-center font-serif text-white font-bold text-lg shadow-xs">
              S
            </div>
            <div>
              <span className="font-serif font-bold text-sm sm:text-base tracking-wide text-white block leading-tight">
                ServeBase
              </span>
              <span className="text-[9px] uppercase font-bold tracking-widest text-[#D9531E] block">
                Hospitality OS
              </span>
            </div>
          </div>

          <div className="h-5 w-[1px] bg-white/10 hidden md:block" />

          {/* OUTLET SELECTOR */}
          <div className="hidden lg:flex items-center gap-2">
            <select
              value={selectedOutlet}
              onChange={e => setSelectedOutlet(e.target.value)}
              className="bg-white/5 border border-white/10 hover:border-white/20 rounded-lg px-2.5 py-1 text-xs font-semibold text-white/90 focus:outline-none"
            >
              <option value="ServeBase Flagship Bistro & Bar" className="bg-[#1C1917]">ServeBase Flagship Bistro & Bar (Indiranagar)</option>
              <option value="ServeBase SkyLounge & Rooftop" className="bg-[#1C1917]">ServeBase SkyLounge & Rooftop</option>
              <option value="ServeBase Hotel & Suites" className="bg-[#1C1917]">ServeBase Hotel & Suites (MG Road)</option>
            </select>

            <span className="bg-[#2D5A27]/20 border border-[#2D5A27]/40 text-[#2D5A27] text-[10px] font-bold px-2 py-0.5 rounded-full">
              Day 2026-10-02 (Open)
            </span>
          </div>
        </div>

        {/* DOMAIN MODULE NAVIGATION */}
        <nav className="flex items-center gap-1 overflow-x-auto">
          {[
            { id: 'pos', label: 'POS & Floor', icon: LayoutGrid, count: null },
            { id: 'kds', label: 'Kitchen KDS', icon: ChefHat, count: activeKotCount > 0 ? activeKotCount : null },
            { id: 'inventory', label: 'Stock & Recipe', icon: Boxes, count: null },
            { id: 'staff', label: 'Staff & Payroll', icon: Users, count: null },
            { id: 'hotel', label: 'Hotel PMS', icon: Building2, count: null },
            { id: 'reports', label: 'Financials', icon: FileSpreadsheet, count: null },
          ].map(module => (
            <button
              key={module.id}
              onClick={() => setActiveTab(module.id as any)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === module.id
                  ? 'bg-[#D9531E] text-white shadow-xs'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              <module.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{module.label}</span>
              {module.count !== null && (
                <span className="bg-white text-[#D9531E] text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {module.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* SYSTEM STATUS ENGINE BADGES & SHORTCUT */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* COMMAND PALETTE BUTTON */}
          <button
            onClick={() => setShowCommandPalette(true)}
            className="hidden md:flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 px-2 py-1 rounded-lg text-[10px] text-white/70 font-mono"
            title="Command Palette (Ctrl+K)"
          >
            <Command className="w-3 h-3 text-[#D9531E]" />
            <span>Ctrl+K</span>
          </button>

          {/* BACKEND STATUS INDICATOR */}
          <div className="hidden sm:flex items-center gap-2 text-[10px] font-medium text-white/70">
            <span 
              className={`flex items-center gap-1 px-2 py-1 rounded border ${
                isBackendOnline 
                  ? 'bg-[#2D5A27]/20 border-[#2D5A27]/40 text-[#2D5A27]' 
                  : 'bg-white/5 border-white/10 text-white/70'
              }`} 
              title={isBackendOnline ? 'Connected to Fastify on port 3000' : 'Running in Standalone Client Mode'}
            >
              <Cpu className="w-3 h-3" />
              <span>{isBackendOnline ? 'Full-Stack (Port 3000)' : 'Standalone Preview'}</span>
            </span>
          </div>

          <button
            onClick={() => setActiveTab('reports')}
            className="relative p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 transition-colors"
            title="System Alerts"
          >
            <Bell className="w-4 h-4" />
            {unreadAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#D9531E] text-white text-[9px] font-bold flex items-center justify-center">
                {unreadAlertsCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ACTIVE WORKSPACE VIEW */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'pos' && (
          <PosView
            tables={tables}
            menu={menu}
            onUpdateTableStatus={handleUpdateTableStatus}
            onSendKot={handleSendKot}
          />
        )}

        {activeTab === 'kds' && (
          <KdsView
            tickets={tickets}
            onBumpTicket={handleBumpTicket}
            onBumpItem={handleBumpItem}
            onRecallTicket={handleRecallTicket}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryView
            inventory={inventory}
            onReceiveStock={handleReceiveStock}
            onRecordStocktake={handleRecordStocktake}
          />
        )}

        {activeTab === 'staff' && (
          <StaffView
            staff={staff}
            onClockToggle={handleClockToggle}
          />
        )}

        {activeTab === 'hotel' && (
          <HotelView
            rooms={rooms}
            onUpdateRoomStatus={handleUpdateRoomStatus}
            onPostCharge={handlePostCharge}
            onReverseCharge={handleReverseCharge}
            onCheckIn={handleCheckIn}
            onCheckOut={handleCheckOut}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            alerts={alerts}
            onResolveAlert={handleResolveAlert}
          />
        )}
      </main>

      {/* COMMAND PALETTE (CTRL+K) MODAL */}
      {showCommandPalette && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-24 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-[#E7E2DC] animate-scaleUp">
            <div className="p-3 border-b border-[#E7E2DC] flex items-center gap-2.5">
              <Search className="w-4 h-4 text-[#8C827A]" />
              <input
                type="text"
                autoFocus
                value={commandQuery}
                onChange={e => setCommandQuery(e.target.value)}
                placeholder="Type a command or jump to screen... (ESC to close)"
                className="w-full text-xs font-medium focus:outline-none"
              />
              <button onClick={() => setShowCommandPalette(false)} className="text-[#8C827A] hover:text-[#1C1917]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2 max-h-72 overflow-y-auto space-y-1">
              {filteredCommands.map(cmd => (
                <div
                  key={cmd.id}
                  onClick={cmd.action}
                  className="p-2.5 rounded-lg hover:bg-[#FAF8F5] cursor-pointer flex items-center justify-between text-xs transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C827A] bg-[#F5EFEB] px-1.5 py-0.5 rounded">
                      {cmd.category}
                    </span>
                    <span className="font-semibold text-[#1C1917]">{cmd.title}</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[#8C827A]" />
                </div>
              ))}
              {filteredCommands.length === 0 && (
                <p className="text-xs text-[#8C827A] p-4 text-center">No matching commands found.</p>
              )}
            </div>

            <div className="p-2.5 bg-[#FAF8F5] border-t border-[#E7E2DC] text-[10px] text-[#8C827A] flex justify-between">
              <span>Use arrow keys to navigate, Enter to select</span>
              <span>ESC to exit</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
