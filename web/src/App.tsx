import React, { useState } from 'react';
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
import { 
  LayoutGrid, ChefHat, Boxes, Users, Building2, 
  FileSpreadsheet, ShieldCheck, Cpu, Wifi, Bell
} from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pos' | 'kds' | 'inventory' | 'staff' | 'hotel' | 'reports'>('pos');
  const [selectedOutlet, setSelectedOutlet] = useState<string>('ServeBase Flagship Bistro & Bar');
  
  // Application Data States
  const [tables, setTables] = useState<Table[]>(INITIAL_TABLES);
  const [menu, setMenu] = useState<MenuItem[]>(INITIAL_MENU);
  const [tickets, setTickets] = useState<KdsTicket[]>(INITIAL_KDS_TICKETS);
  const [inventory, setInventory] = useState<InventoryItem[]>(INITIAL_INVENTORY);
  const [staff, setStaff] = useState<StaffMember[]>(INITIAL_STAFF);
  const [rooms, setRooms] = useState<Room[]>(INITIAL_ROOMS);
  const [alerts, setAlerts] = useState<SystemAlert[]>(INITIAL_ALERTS);

  // Table status updater
  const handleUpdateTableStatus = (tableId: string, status: TableStatus, billAmount?: number) => {
    setTables(prev => prev.map(t => {
      if (t.id === tableId) {
        return {
          ...t,
          status,
          active_bill_amount: status === 'vacant' ? 0 : (billAmount !== undefined ? billAmount : t.active_bill_amount),
          current_order_id: status === 'vacant' ? undefined : t.current_order_id,
        };
      }
      return t;
    }));
  };

  // Send KOT from POS to Kitchen
  const handleSendKot = (tableNumber: string, items: CartItem[]) => {
    // Group items by station
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
        return {
          ...item,
          current_stock: countedQty
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
        return {
          ...r,
          current_folio_balance: r.current_folio_balance + amountPaise
        };
      }
      return r;
    }));
    // Add alert
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

  const handleCheckIn = (roomId: string, guestName: string) => {
    setRooms(prev => prev.map(r => {
      if (r.id === roomId) {
        return {
          ...r,
          status: 'occupied',
          guest_name: guestName,
          check_in_date: '2026-10-02',
          current_folio_balance: 0
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
          current_folio_balance: 0
        };
      }
      return r;
    }));
  };

  // Alerts
  const handleResolveAlert = (alertId: string) => {
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, resolved: true } : a));
  };

  const unreadAlertsCount = alerts.filter(a => !a.resolved).length;
  const activeKotCount = tickets.filter(t => t.status === 'open').length;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#FBF9F6]">
      {/* GLOBAL TOP NAVIGATION BAR */}
      <header className="bg-[#1C1917] text-white border-b border-black/40 px-6 py-2.5 flex items-center justify-between select-none">
        {/* BRAND & OUTLET SELECTOR */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#D9531E] flex items-center justify-center font-serif text-white font-bold text-lg shadow-sm">
              S
            </div>
            <div>
              <span className="font-serif font-bold text-base tracking-wide text-white block leading-tight">
                ServeBase
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#D9531E] block">
                Hospitality OS
              </span>
            </div>
          </div>

          <div className="h-6 w-[1px] bg-white/10" />

          {/* OUTLET SELECTOR */}
          <div className="flex items-center gap-2">
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

        {/* DOMAIN NAVIGATION MODULES */}
        <nav className="flex items-center gap-1">
          {[
            { id: 'pos', label: 'POS & Floor', icon: LayoutGrid, count: null },
            { id: 'kds', label: 'Kitchen KDS', icon: ChefHat, count: activeKotCount > 0 ? activeKotCount : null },
            { id: 'inventory', label: 'Stock & Recipe', icon: Boxes, count: null },
            { id: 'staff', label: 'Staff & Payroll', icon: Users, count: null },
            { id: 'hotel', label: 'Hotel PMS', icon: Building2, count: null },
            { id: 'reports', label: 'Financials & Close', icon: FileSpreadsheet, count: null },
          ].map(module => (
            <button
              key={module.id}
              onClick={() => setActiveTab(module.id as any)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === module.id
                  ? 'bg-[#D9531E] text-white shadow-sm'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              <module.icon className="w-3.5 h-3.5" />
              <span>{module.label}</span>
              {module.count !== null && (
                <span className="bg-white text-[#D9531E] text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {module.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* SYSTEM STATUS ENGINE BADGES */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[10px] font-medium text-white/70">
            <span className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded border border-white/10" title="C++17 Business Logic Engine Pool">
              <Cpu className="w-3 h-3 text-[#2D5A27]" /> C++ Engine: Active
            </span>
            <span className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded border border-white/10" title="Offline SQLite/IndexedDB Sync">
              <Wifi className="w-3 h-3 text-[#2D5A27]" /> Node: Synced
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
    </div>
  );
};

export default App;
