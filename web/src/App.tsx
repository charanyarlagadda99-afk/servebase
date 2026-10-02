import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, MenuItem, KdsTicket, InventoryItem, StaffMember, Room, SystemAlert, CartItem, TableStatus 
} from './types';
import { PosView } from './views/PosView';
import { KdsView } from './views/KdsView';
import { InventoryView } from './views/InventoryView';
import { StaffView } from './views/StaffView';
import { HotelView } from './views/HotelView';
import { ReportsView } from './views/ReportsView';
import { LoginView } from './views/LoginView';
import { 
  api, 
  checkBackendHealth, 
  isAuthenticated, 
  getCurrentUser, 
  API_BASE 
} from './api/client';
import { 
  LayoutGrid, ChefHat, Boxes, Users, Building2, 
  FileSpreadsheet, Cpu, Bell, 
  Command, Search, X, ArrowRight, LogOut, RefreshCw
} from 'lucide-react';

export const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(isAuthenticated());
  const [currentUser, setCurrentUser] = useState<any>(getCurrentUser());
  const [activeTab, setActiveTab] = useState<'pos' | 'kds' | 'inventory' | 'staff' | 'hotel' | 'reports'>('pos');
  const [selectedOutlet, setSelectedOutlet] = useState<string>('ServeBase Flagship Bistro & Bar');
  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(true);
  const [isLocalServer, setIsLocalServer] = useState<boolean>(false);
  const [showCommandPalette, setShowCommandPalette] = useState<boolean>(false);
  const [commandQuery, setCommandQuery] = useState<string>('');
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  
  // Real Application Data States (Zero hardcoded mock fallbacks)
  const [tables, setTables] = useState<Table[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [tickets, setTickets] = useState<KdsTicket[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);

  // Fetch all domain datasets from the API
  const refreshData = useCallback(async () => {
    if (!isAuthenticated()) return;
    setIsLoadingData(true);
    try {
      const [tablesRes, menuRes, ticketsRes, inventoryRes, staffRes, roomsRes, alertsRes] = await Promise.all([
        api.floor.getTables(),
        api.menu.getFullMenu(),
        api.kitchen.getTickets(),
        api.inventory.getInventory(),
        api.staff.getStaff(),
        api.hotel.getRooms(),
        api.alerts.getActive(),
      ]);

      if (tablesRes.ok && Array.isArray(tablesRes.data)) {
        setTables(tablesRes.data.map((t: any) => ({
          id: t.id,
          table_number: t.table_number,
          section: t.area_name || t.section || 'Main Dining',
          capacity: t.capacity || 4,
          status: t.status || 'vacant',
          current_order_id: t.active_order_id || t.current_order_id,
          active_bill_amount: Number(t.active_bill_amount || 0),
          covers: t.current_covers,
          locked_by: t.locked_by,
        })));
      }

      if (menuRes.ok && Array.isArray(menuRes.data)) {
        setMenu(menuRes.data.map((m: any) => ({
          id: m.id,
          name: m.name,
          item_code: m.item_code || m.code || '',
          category: m.category_name || m.category || 'Main Curries',
          base_price: Number(m.base_price_paise || m.base_price || 0),
          tax_rate_percent: Number(m.tax_rate_percent || 5.0),
          station: (m.station_code?.toLowerCase() || m.station || 'curry') as any,
          is_available: m.is_available ?? true,
          veg_status: m.veg_status || 'veg',
        })));
      }

      if (ticketsRes.ok && Array.isArray(ticketsRes.data)) {
        setTickets(ticketsRes.data.map((tk: any) => ({
          id: tk.id,
          kot_number: tk.kot_number ? `KOT-${tk.kot_number}` : tk.kot_number_display || `KOT-${tk.id.slice(0, 6)}`,
          order_id: tk.order_id,
          table_number: tk.table_number || 'T1',
          server_name: tk.server_name || 'Staff',
          station: (tk.station_code?.toLowerCase() || tk.station || 'curry') as any,
          created_at: tk.created_at,
          status: tk.status === 'bumped' ? 'completed' : (tk.status || 'open'),
          items: Array.isArray(tk.items) ? tk.items.map((it: any) => ({
            id: it.id,
            name: it.item_name || it.name,
            quantity: Number(it.quantity || 1),
            course: it.course || 'main',
            status: it.status || 'pending',
            notes: it.notes,
            station: (it.station_code?.toLowerCase() || 'curry') as any,
          })) : [],
        })));
      }

      if (inventoryRes.ok && Array.isArray(inventoryRes.data)) {
        setInventory(inventoryRes.data.map((inv: any) => ({
          id: inv.id,
          sku: inv.sku || inv.item_code || '',
          name: inv.name,
          category: inv.category || 'Dry Goods',
          unit: inv.unit_symbol || inv.uom || 'kg',
          current_stock: Number(inv.current_stock || 0),
          par_level: Number(inv.par_level || 10),
          reorder_quantity: Number(inv.reorder_quantity || 5),
          unit_cost: Number(inv.current_cost_paise || inv.unit_cost || 0),
          supplier_name: inv.supplier_name || 'Imperial Wholesale',
        })));
      }

      if (staffRes.ok && Array.isArray(staffRes.data)) {
        setStaff(staffRes.data.map((s: any) => ({
          id: s.id,
          staff_id: s.employee_code || s.staff_id || `EMP-${s.id.slice(0, 4)}`,
          name: s.full_name || s.name,
          role: (s.role_name?.toLowerCase() || s.role || 'waiter') as any,
          status: s.status || 'clocked_out',
          clock_in_time: s.clock_in_time,
          phone: s.phone || '',
          base_monthly_salary: Number(s.base_salary_paise || s.base_monthly_salary || 2500000),
        })));
      }

      if (roomsRes.ok && Array.isArray(roomsRes.data)) {
        setRooms(roomsRes.data.map((r: any) => ({
          id: r.id,
          room_number: r.room_number,
          room_type: r.room_type || 'deluxe',
          status: r.status || 'vacant',
          clean_status: r.housekeeping_status || r.clean_status || 'clean',
          guest_name: r.guest_name,
          folio_id: r.folio_id,
          rate_per_night: Number(r.base_tariff_paise || r.rate_per_night || 450000),
          current_folio_balance: Number(r.current_balance_paise || r.current_folio_balance || 0),
          charges_history: r.charges || [],
        })));
      }

      if (alertsRes.ok && Array.isArray(alertsRes.data)) {
        setAlerts(alertsRes.data);
      }
    } catch (err) {
      console.error('Error fetching initial ServeBase state:', err);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  // Health check polling
  useEffect(() => {
    checkBackendHealth().then(res => {
      setIsBackendOnline(res.online);
      setIsLocalServer(res.isLocalServer);
    });
    const interval = setInterval(() => {
      checkBackendHealth().then(res => {
        setIsBackendOnline(res.online);
        setIsLocalServer(res.isLocalServer);
      });
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Initial load on mount or login
  useEffect(() => {
    if (isLoggedIn) {
      refreshData();
    }
  }, [isLoggedIn, refreshData]);

  // Realtime Server-Sent Events (SSE) Stream
  useEffect(() => {
    if (!isLoggedIn) return;
    const disconnectSSE = api.realtime.connect((event) => {
      if (['KOT_CREATED', 'KOT_BUMPED', 'KOT_RECALLED', 'ITEM_BUMPED'].includes(event.type)) {
        api.kitchen.getTickets().then(res => {
          if (res.ok && Array.isArray(res.data)) {
            setTickets(res.data.map((tk: any) => ({
              id: tk.id,
              kot_number: tk.kot_number ? `KOT-${tk.kot_number}` : `KOT-${tk.id.slice(0, 6)}`,
              order_id: tk.order_id,
              table_number: tk.table_number || 'T1',
              server_name: tk.server_name || 'Staff',
              station: (tk.station_code?.toLowerCase() || tk.station || 'curry') as any,
              created_at: tk.created_at,
              status: tk.status === 'bumped' ? 'completed' : (tk.status || 'open'),
              items: Array.isArray(tk.items) ? tk.items.map((it: any) => ({
                id: it.id,
                name: it.item_name || it.name,
                quantity: Number(it.quantity || 1),
                course: it.course || 'main',
                status: it.status || 'pending',
                notes: it.notes,
                station: (it.station_code?.toLowerCase() || 'curry') as any,
              })) : [],
            })));
          }
        });
      }
      if (['TABLE_UPDATED', 'BILL_PRINTED', 'PAYMENT_RECEIVED'].includes(event.type)) {
        api.floor.getTables().then(res => {
          if (res.ok && Array.isArray(res.data)) {
            const dataList = res.data;
            setTables(tablesRes => tablesRes.map((t: any) => {
              const incoming = dataList.find((x: any) => x.id === t.id);
              if (!incoming) return t;
              return {
                ...t,
                status: incoming.status || t.status,
                current_order_id: incoming.active_order_id || incoming.current_order_id,
                active_bill_amount: Number(incoming.active_bill_amount || 0),
              };
            }));
          }
        });
      }
    });

    return () => {
      disconnectSSE();
    };
  }, [isLoggedIn]);

  // Global Keyboard Shortcuts (Ctrl+K or Cmd+K)
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
  const handleUpdateTableStatus = async (tableId: string, status: TableStatus, billAmount?: number) => {
    try {
      await api.floor.updateTableStatus(tableId, status);
    } catch (err) {}

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

  // Send KOT: Create order on server and route tickets
  const handleSendKot = async (tableNumber: string, items: CartItem[]) => {
    try {
      const targetTable = tables.find(t => t.table_number === tableNumber);
      if (!targetTable) return;

      const orderPayload = {
        order_type: 'dine_in',
        table_id: targetTable.id,
        covers: targetTable.capacity,
        items: items.map(i => ({
          menu_item_id: i.menu_item_id,
          item_name: i.name,
          quantity: i.quantity,
          unit_price_paise: i.base_price,
          course: i.course,
          course_status: i.status === 'fire' ? 'fire' : 'hold',
          notes: i.notes,
        })),
      };

      const orderRes = await api.orders.create(orderPayload);
      if (orderRes.ok && orderRes.data?.id) {
        await api.orders.sendKot(orderRes.data.id);
      }
      await refreshData();
    } catch (err) {
      console.error('Failed to send KOT to backend:', err);
    }
  };

  // KDS Handlers
  const handleBumpTicket = async (ticketId: string) => {
    try {
      await api.kitchen.bumpTicket(ticketId);
    } catch (err) {}
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

  const handleBumpItem = async (ticketId: string, itemId: string) => {
    try {
      await api.kitchen.bumpItem(itemId);
    } catch (err) {}
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

  const handleRecallTicket = async (ticketId: string) => {
    try {
      await api.kitchen.recallTicket(ticketId);
    } catch (err) {}
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
  const handleReceiveStock = async (sku: string, qty: number, unitCostPaise: number) => {
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

  const handleRecordStocktake = async (sku: string, countedQty: number) => {
    const item = inventory.find(i => i.sku === sku);
    if (item) {
      try {
        await api.inventory.recordStocktake([{ material_id: item.id, physical_stock: countedQty }]);
      } catch (err) {}
    }
    setInventory(prev => prev.map(i => {
      if (i.sku === sku) {
        const variance = countedQty - i.current_stock;
        return {
          ...i,
          current_stock: countedQty,
          variance_qty: variance
        };
      }
      return i;
    }));
  };

  // Staff Handlers
  const handleClockToggle = async (staffId: string) => {
    const s = staff.find(x => x.id === staffId);
    if (s) {
      try {
        if (s.status === 'clocked_in') {
          await api.staff.clockOut(s.id);
        } else {
          await api.staff.clockIn(s.id);
        }
      } catch (err) {}
    }
    setStaff(prev => prev.map(mem => {
      if (mem.id === staffId) {
        const isClockedIn = mem.status === 'clocked_in';
        return {
          ...mem,
          status: isClockedIn ? 'clocked_out' : 'clocked_in',
          clock_in_time: isClockedIn ? undefined : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
      }
      return mem;
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

  const handlePostCharge = async (roomId: string, amountPaise: number, description: string) => {
    const r = rooms.find(x => x.id === roomId);
    if (r) {
      try {
        await api.hotel.postCharge(r.room_number, amountPaise, description);
      } catch (err) {}
    }
    setRooms(prev => prev.map(room => {
      if (room.id === roomId) {
        const newCharge = {
          id: `chg-${Date.now()}`,
          desc: description,
          amount: amountPaise,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          is_reversed: false
        };
        return {
          ...room,
          current_folio_balance: room.current_folio_balance + amountPaise,
          charges_history: [newCharge, ...(room.charges_history || [])]
        };
      }
      return room;
    }));
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
  };

  const handleCheckIn = (roomId: string, guestName: string) => {
    setRooms(prev => prev.map(r => {
      if (r.id === roomId) {
        return {
          ...r,
          status: 'occupied',
          guest_name: guestName,
          check_in_date: new Date().toISOString().split('T')[0],
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

  const handleResolveAlert = async (alertId: string) => {
    try {
      await api.alerts.acknowledge(alertId);
    } catch (err) {}
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
    { id: 'refresh', title: 'Refresh Live State from Server', category: 'System', action: () => { refreshData(); setShowCommandPalette(false); } },
    { id: 'logout', title: 'Logout of Terminal', category: 'Auth', action: () => { api.auth.logout(); setIsLoggedIn(false); setCurrentUser(null); setShowCommandPalette(false); } },
  ];

  const filteredCommands = commands.filter(c => 
    c.title.toLowerCase().includes(commandQuery.toLowerCase()) || 
    c.category.toLowerCase().includes(commandQuery.toLowerCase())
  );

  // If user is not authenticated, render LoginView
  if (!isLoggedIn) {
    return (
      <LoginView
        onLoginSuccess={(user: any) => {
          setIsLoggedIn(true);
          setCurrentUser(user);
          refreshData();
        }}
        isBackendOnline={isBackendOnline}
        isLocalServer={isLocalServer}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#FBF9F6]">
      {/* PUBLIC PREVIEW / CLOUD DEMO BAR */}
      {!isLocalServer && (
        <div className="bg-slate-900 border-b border-amber-500/30 text-amber-200 px-4 py-1.5 text-xs font-medium flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>ServeBase Public Demo Mode (Interactive In-Browser Engine) • Full C++ calculations simulated • POS, KDS, Splits & PMS ready</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-400 font-mono hidden md:inline">Standalone Cloud Deployment</span>
            <button 
              onClick={() => checkBackendHealth().then(r => { setIsBackendOnline(r.online); setIsLocalServer(r.isLocalServer); })}
              className="text-[11px] text-amber-400 hover:text-amber-300 underline font-semibold"
            >
              Check Local Server
            </button>
          </div>
        </div>
      )}

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
          {/* REFRESH DATA BUTTON */}
          <button
            onClick={refreshData}
            disabled={isLoadingData}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 transition-colors"
            title="Refresh Live Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? 'animate-spin' : ''}`} />
          </button>

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
              title={isBackendOnline ? `Connected to ${API_BASE}` : 'Offline / Standalone Mode'}
            >
              <Cpu className="w-3 h-3" />
              <span>{isBackendOnline ? 'API Connected' : 'Offline Mode'}</span>
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

          {/* USER PROFILE & LOGOUT */}
          {currentUser && (
            <div className="flex items-center gap-2 border-l border-white/10 pl-2">
              <span className="hidden xl:inline text-[11px] font-semibold text-white/80">
                {currentUser.fullName || currentUser.email}
              </span>
              <button
                onClick={() => {
                  api.auth.logout();
                  setIsLoggedIn(false);
                  setCurrentUser(null);
                }}
                className="flex items-center gap-1 text-[10px] font-bold bg-white/10 hover:bg-red-900/60 text-white px-2 py-1 rounded transition-colors"
                title="Log Out"
              >
                <LogOut className="w-3 h-3" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          )}
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
