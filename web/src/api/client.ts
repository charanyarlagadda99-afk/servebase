// ServeBase Production Typed API Client
// All requests flow through this client to the Fastify + C++ Core Engine backend.
// Zero mock data fallbacks in production paths.

export const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

const TOKEN_KEY = 'sb_auth_token';
const USER_KEY = 'sb_current_user';
const OUTLET_KEY = 'sb_active_outlet_id';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(OUTLET_KEY);
}

export function getCurrentUser(): any | null {
  const data = localStorage.getItem(USER_KEY);
  return data ? JSON.parse(data) : null;
}

export function setCurrentUser(user: any): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getActiveOutletId(): string | null {
  return localStorage.getItem(OUTLET_KEY);
}

export function setActiveOutletId(outletId: string): void {
  localStorage.setItem(OUTLET_KEY, outletId);
}

export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  simulated?: boolean;
}

async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${path}`;
  const headers = new Headers(options.headers || {});
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getAuthToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const outletId = getActiveOutletId();
  if (outletId) {
    headers.set('x-outlet-id', outletId);
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      if (res.status === 401 && !path.includes('/auth/login') && !path.includes('/auth/pin-login') && !path.includes('/auth/terminal-pin')) {
        // Token expired or invalid
        removeAuthToken();
      }
      return {
        ok: false,
        error: json?.error || {
          code: `HTTP_${res.status}`,
          message: res.statusText || 'Request failed',
        },
      };
    }

    return json || { ok: true };
  } catch (err: any) {
    return {
      ok: false,
      error: {
        code: 'NETWORK_ERROR',
        message: err.message || 'Network error connecting to ServeBase API',
      },
    };
  }
}

export const api = {
  // System Health
  health: {
    check: async () => {
      const res = await apiRequest<{ status: string; database: string; core_engine: string }>('/health');
      return {
        online: res.ok && res.data?.status === 'ok',
        databaseConnected: res.data?.database === 'connected',
        coreActive: res.data?.core_engine === 'active',
      };
    },
  },

  // Auth & RBAC
  auth: {
    login: async (email: string, password: string) => {
      const res = await apiRequest<{ token: string; user: any }>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (res.ok && res.data?.token) {
        setAuthToken(res.data.token);
        setCurrentUser(res.data.user);
        if (res.data.user?.roles?.[0]?.outletId) {
          setActiveOutletId(res.data.user.roles[0].outletId);
        }
      }
      return res;
    },

    pinLogin: async (pin: string, outletId?: string, terminalId?: string) => {
      const res = await apiRequest<{ token: string; user: any }>('/api/v1/auth/pin-login', {
        method: 'POST',
        body: JSON.stringify({ pin, outlet_id: outletId, terminal_id: terminalId }),
      });
      if (res.ok && res.data?.token) {
        setAuthToken(res.data.token);
        setCurrentUser(res.data.user);
        if (outletId) setActiveOutletId(outletId);
      }
      return res;
    },

    me: async () => {
      return apiRequest('/api/v1/auth/me');
    },

    // Real Server-Side Manager Approval
    approve: async (approverPin: string, actionType: string, reason: string, referenceId?: string) => {
      return apiRequest('/api/v1/auth/approve', {
        method: 'POST',
        body: JSON.stringify({
          approver_pin: approverPin,
          action_type: actionType,
          reason,
          reference_id: referenceId || null,
        }),
      });
    },

    logout: () => {
      removeAuthToken();
    },
  },

  // Floor & Tables
  floor: {
    getTables: async () => {
      return apiRequest<any[]>('/api/v1/floor/tables');
    },
    getAreas: async () => {
      return apiRequest<any[]>('/api/v1/floor/sections');
    },
    updateTableStatus: async (tableId: string, status: string, covers?: number) => {
      return apiRequest(`/api/v1/floor/tables/${tableId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, covers }),
      });
    },
  },

  // Menu Catalog
  menu: {
    getFullMenu: async () => {
      return apiRequest<any[]>('/api/v1/menu');
    },
    getCategories: async () => {
      return apiRequest<any[]>('/api/v1/menu/categories');
    },
    toggleAvailability: async (menuItemId: string, isAvailable: boolean) => {
      return apiRequest(`/api/v1/menu/items/${menuItemId}/availability`, {
        method: 'PATCH',
        body: JSON.stringify({ is_available: isAvailable }),
      });
    },
  },

  // Orders & KOT Tickets
  orders: {
    get: async (orderId: string) => {
      return apiRequest<any>(`/api/v1/orders/${orderId}`);
    },
    create: async (payload: { order_type: string; table_id?: string; covers?: number; customer_id?: string }) => {
      return apiRequest('/api/v1/orders/create', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    addItems: async (orderId: string, items: any[]) => {
      return apiRequest(`/api/v1/orders/${orderId}/items`, {
        method: 'POST',
        body: JSON.stringify({ items }),
      });
    },
    sendKot: async (orderId: string) => {
      return apiRequest(`/api/v1/orders/${orderId}/kot`, {
        method: 'POST',
      });
    },
    voidItem: async (orderId: string, orderItemId: string, reason: string, approvalId?: string) => {
      return apiRequest(`/api/v1/orders/${orderId}/void-item`, {
        method: 'POST',
        body: JSON.stringify({ order_item_id: orderItemId, reason, approval_id: approvalId }),
      });
    },
    cancel: async (orderId: string, reason: string) => {
      return apiRequest(`/api/v1/orders/${orderId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    },
  },

  // Kitchen Display System (KDS)
  kitchen: {
    getTickets: async (station?: string, showBumped = false) => {
      const q = new URLSearchParams();
      if (station && station !== 'all') q.set('station', station);
      if (showBumped) q.set('show_bumped', 'true');
      return apiRequest<any[]>(`/api/v1/kitchen/queue?${q.toString()}`);
    },
    bumpTicket: async (kotId: string) => {
      return apiRequest('/api/v1/kitchen/bump', {
        method: 'POST',
        body: JSON.stringify({ kot_id: kotId, action: 'bump' }),
      });
    },
    bumpItem: async (kotItemId: string) => {
      return apiRequest('/api/v1/kitchen/bump-item', {
        method: 'POST',
        body: JSON.stringify({ kot_item_id: kotItemId }),
      });
    },
    recallTicket: async (kotId: string) => {
      return apiRequest('/api/v1/kitchen/recall', {
        method: 'POST',
        body: JSON.stringify({ kot_id: kotId }),
      });
    },
  },

  // Billing (Engineered with Native C++ Business Engine)
  billing: {
    // Calls C++ price_bill op
    calculate: async (payload: {
      items: Array<{ quantity: number; unit_price_paise: number; tax_rate_percent?: number }>;
      bill_discount_percent?: number;
      bill_discount_flat_paise?: number;
      service_charge_percent?: number;
      service_charge_enabled?: boolean;
      rounding_rule?: string;
      tax_mode?: string;
    }) => {
      return apiRequest('/api/v1/billing/calculate', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    // Calls C++ split_bill op (Hamilton Largest Remainder Method)
    split: async (payload: {
      bill: { total_paise: number; subtotal_paise?: number };
      split_type: 'equal' | 'by_amount' | 'by_item';
      num_parts?: number;
      target_amounts?: number[];
    }) => {
      return apiRequest('/api/v1/billing/split', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    // Issues sequential GST tax invoice
    invoice: async (orderId: string, seriesCode = 'T1', invoiceType = 'tax_invoice') => {
      return apiRequest('/api/v1/billing/invoice', {
        method: 'POST',
        body: JSON.stringify({ order_id: orderId, series_code: seriesCode, invoice_type: invoiceType }),
      });
    },
  },

  // Payments & Tenders
  payments: {
    record: async (payload: {
      invoice_id: string;
      order_id?: string;
      payment_method: 'cash' | 'card' | 'upi' | 'wallet' | 'charge_to_room';
      amount_paise: number;
      room_number?: string;
      reference_id?: string;
    }) => {
      return apiRequest('/api/v1/payments/record', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    splitPayment: async (invoiceId: string, tenders: Array<{ payment_method: string; amount_paise: number; room_number?: string }>) => {
      return apiRequest('/api/v1/payments/split', {
        method: 'POST',
        body: JSON.stringify({ invoice_id: invoiceId, tenders }),
      });
    },
  },

  // Register Shifts & Cash Management
  shifts: {
    open: async (openingFloatPaise: number, terminalId?: string) => {
      return apiRequest('/api/v1/shifts/open', {
        method: 'POST',
        body: JSON.stringify({ opening_float_paise: openingFloatPaise, terminal_id: terminalId }),
      });
    },
    cashMovement: async (shiftId: string, movementType: 'paid_in' | 'paid_out' | 'drop', amountPaise: number, reason: string) => {
      return apiRequest('/api/v1/shifts/cash-movement', {
        method: 'POST',
        body: JSON.stringify({ shift_id: shiftId, movement_type: movementType, amount_paise: amountPaise, reason }),
      });
    },
    close: async (payload: {
      shift_id: string;
      actual_cash_paise: number;
      denominations?: Record<string, number>;
      is_blind_close?: boolean;
      notes?: string;
    }) => {
      return apiRequest('/api/v1/shifts/close', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
  },

  // Day Close & Z-Report
  dayClose: {
    preview: async (businessDate?: string) => {
      const q = businessDate ? `?business_date=${businessDate}` : '';
      return apiRequest(`/api/v1/day-close/preview${q}`);
    },
    perform: async (businessDate?: string, notes?: string) => {
      return apiRequest('/api/v1/day-close/perform', {
        method: 'POST',
        body: JSON.stringify({ business_date: businessDate, notes }),
      });
    },
  },

  // Inventory & Purchasing
  inventory: {
    getItems: async () => {
      return apiRequest<any[]>('/api/v1/inventory/items');
    },
    getInventory: async () => {
      return apiRequest<any[]>('/api/v1/inventory/items');
    },
    recordStocktake: async (items: Array<{ material_id: string; physical_stock: number }>) => {
      return apiRequest('/api/v1/inventory/stocktake', {
        method: 'POST',
        body: JSON.stringify({ items }),
      });
    },
    adjust: async (payload: {
      raw_material_id: string;
      quantity: number;
      movement_type: string;
      unit_cost_paise?: number;
      business_date?: string;
    }) => {
      return apiRequest('/api/v1/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    getLedger: async (rawMaterialId?: string) => {
      const q = rawMaterialId ? `?raw_material_id=${rawMaterialId}` : '';
      return apiRequest<any[]>(`/api/v1/inventory/ledger${q}`);
    },
  },

  // Recipes & Theoretical Costing
  recipes: {
    getRecipes: async () => {
      return apiRequest<any[]>('/api/v1/recipes');
    },
    // Explodes recipe via C++ engine
    explode: async (orderedItems: any[], recipes: any[]) => {
      return apiRequest('/api/v1/recipes/explode', {
        method: 'POST',
        body: JSON.stringify({ ordered_items: orderedItems, recipes }),
      });
    },
  },

  // Staff & Payroll
  staff: {
    getEmployees: async () => {
      return apiRequest<any[]>('/api/v1/staff/employees');
    },
    getStaff: async () => {
      return apiRequest<any[]>('/api/v1/staff/employees');
    },
    clockIn: async (employeeId: string, workDate?: string) => {
      return apiRequest('/api/v1/staff/clock-in', {
        method: 'POST',
        body: JSON.stringify({ employee_id: employeeId, work_date: workDate }),
      });
    },
    clockOut: async (employeeId: string, workDate?: string, breakMinutes = 0) => {
      return apiRequest('/api/v1/staff/clock-out', {
        method: 'POST',
        body: JSON.stringify({ employee_id: employeeId, work_date: workDate, break_minutes: breakMinutes }),
      });
    },
    runPayroll: async (month: number, year: number) => {
      return apiRequest('/api/v1/payroll/run', {
        method: 'POST',
        body: JSON.stringify({ month, year }),
      });
    },
  },

  // Accounting & Financial Reports
  accounting: {
    getTrialBalance: async () => {
      return apiRequest('/api/v1/accounting/trial-balance');
    },
    getFlashPnl: async () => {
      return apiRequest('/api/v1/accounting/flash-pnl');
    },
    getJournals: async () => {
      return apiRequest('/api/v1/accounting/journals');
    },
  },

  // Hotel PMS Extension
  hotel: {
    getRooms: async () => {
      return apiRequest<any[]>('/api/v1/hotel/rooms');
    },
    checkIn: async (roomId: string, guestId: string, creditLimitPaise = 5000000) => {
      return apiRequest('/api/v1/hotel/checkin', {
        method: 'POST',
        body: JSON.stringify({ room_id: roomId, guest_id: guestId, credit_limit_paise: creditLimitPaise }),
      });
    },
    postCharge: async (roomNumber: string, amountPaise: number, description: string) => {
      return apiRequest('/api/v1/hotel/post-charge', {
        method: 'POST',
        body: JSON.stringify({ room_number: roomNumber, amount_paise: amountPaise, description }),
      });
    },
    checkOut: async (folioId: string, paymentMethod = 'card') => {
      return apiRequest('/api/v1/hotel/checkout', {
        method: 'POST',
        body: JSON.stringify({ folio_id: folioId, payment_method: paymentMethod }),
      });
    },
  },

  // Delivery Aggregators & Channels
  channels: {
    getChannels: async () => {
      return apiRequest<any[]>('/api/v1/channels/list');
    },
    simulateOrder: async (payload: any) => {
      return apiRequest('/api/v1/channels/simulate-order', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    getPayoutReconciliation: async () => {
      return apiRequest<any[]>('/api/v1/channels/payout-reconciliation');
    },
  },

  // Operational Reports
  reports: {
    getDailyFlash: async (businessDate?: string) => {
      const q = businessDate ? `?business_date=${businessDate}` : '';
      return apiRequest(`/api/v1/reports/daily-flash${q}`);
    },
    getHourlyMatrix: async () => {
      return apiRequest('/api/v1/reports/hourly-matrix');
    },
    getMenuEngineering: async () => {
      return apiRequest('/api/v1/reports/menu-engineering');
    },
    getLeakage: async () => {
      return apiRequest('/api/v1/reports/leakage');
    },
  },

  // System Alerts
  alerts: {
    getActive: async () => {
      return apiRequest<any[]>('/api/v1/alerts/active');
    },
    acknowledge: async (alertId: string) => {
      return apiRequest(`/api/v1/alerts/${alertId}/acknowledge`, {
        method: 'POST',
      });
    },
  },

  // Cryptographic Audit Trail
  audit: {
    getLogs: async (limit = 50) => {
      return apiRequest<any[]>(`/api/v1/audit/logs?limit=${limit}`);
    },
    verifyChain: async () => {
      return apiRequest<{ valid: boolean; inspected: number }>('/api/v1/audit/verify-chain');
    },
  },

  // Realtime Server-Sent Events (SSE)
  realtime: {
    connect: (onEvent: (event: any) => void, onError?: (err: any) => void): (() => void) => {
      const outletId = getActiveOutletId() || 'default';
      const url = `${API_BASE}/api/v1/realtime/stream?outlet_id=${outletId}`;
      const eventSource = new EventSource(url);

      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          onEvent(data);
        } catch {}
      };

      eventSource.addEventListener('KOT_CREATED', (e: any) => {
        try {
          const data = JSON.parse(e.data);
          onEvent({ type: 'KOT_CREATED', ...data });
        } catch {}
      });

      eventSource.addEventListener('KOT_BUMPED', (e: any) => {
        try {
          const data = JSON.parse(e.data);
          onEvent({ type: 'KOT_BUMPED', ...data });
        } catch {}
      });

      eventSource.addEventListener('TABLE_UPDATED', (e: any) => {
        try {
          const data = JSON.parse(e.data);
          onEvent({ type: 'TABLE_UPDATED', ...data });
        } catch {}
      });

      eventSource.onerror = (err) => {
        if (onError) onError(err);
      };

      return () => {
        eventSource.close();
      };
    },
  },
};

// Legacy exports for compatibility
export const checkBackendHealth = api.health.check;
export const fetchLiveTables = api.floor.getTables;
export const fetchLiveMenu = api.menu.getFullMenu;
export const fetchLiveInventory = api.inventory.getItems;
export const fetchLiveStaff = api.staff.getEmployees;
export const fetchLiveRooms = api.hotel.getRooms;
