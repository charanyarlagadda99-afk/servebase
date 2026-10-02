export type TableStatus = 'vacant' | 'occupied' | 'billed' | 'reserved' | 'cleaning';
export type Station = 'tandoor' | 'curry' | 'bar' | 'expediter' | 'pantry' | 'dessert';
export type Course = 'beverage' | 'starter' | 'main' | 'dessert';
export type CourseStatus = 'hold' | 'fire' | 'ready' | 'served';

export interface Table {
  id: string;
  table_number: string;
  section: string;
  capacity: number;
  status: TableStatus;
  current_order_id?: string;
  active_bill_amount?: number;
  covers?: number;
  server_name?: string;
  seated_time?: string;
  idle_minutes?: number;
  locked_by?: string; // Terminal or staff locking the table
}

export interface MenuItem {
  id: string;
  name: string;
  item_code: string;
  category: string;
  base_price: number; // in paise
  tax_rate_percent: number;
  station: Station;
  is_available: boolean;
  description?: string;
  veg_status: 'veg' | 'non_veg' | 'egg';
  food_cost_paise?: number; // Raw ingredient cost for menu engineering
}

export interface CartItem {
  id: string; // unique cart entry ID
  menu_item_id: string;
  name: string;
  base_price: number; // paise
  quantity: number;
  course: Course;
  status: CourseStatus;
  station: Station;
  notes?: string;
  seat_number?: number;
  is_voided?: boolean;
  void_reason?: string;
  modifiers?: { name: string; price: number }[];
}

export interface KdsTicketItem {
  id: string;
  name: string;
  quantity: number;
  course: Course;
  status: 'pending' | 'preparing' | 'ready' | 'served' | 'voided';
  notes?: string;
  station: Station;
}

export interface KdsTicket {
  id: string;
  kot_number: string;
  order_id: string;
  table_number: string;
  server_name: string;
  station: Station;
  created_at: string;
  status: 'open' | 'completed' | 'recalled';
  items: KdsTicketItem[];
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
  par_level: number;
  reorder_quantity: number;
  unit_cost: number; // in paise
  supplier_name: string;
  last_received_at?: string;
  theoretical_usage?: number;
  actual_usage?: number;
  variance_qty?: number;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_name: string;
  status: 'draft' | 'ordered' | 'received' | 'matched' | 'discrepancy';
  total_amount: number; // paise
  created_at: string;
  items_count: number;
}

export interface StaffMember {
  id: string;
  staff_id: string;
  name: string;
  role: 'cashier' | 'waiter' | 'chef' | 'manager' | 'receptionist';
  status: 'clocked_in' | 'clocked_out' | 'on_break';
  clock_in_time?: string;
  phone: string;
  base_monthly_salary: number; // paise
  pin?: string;
}

export interface Room {
  id: string;
  room_number: string;
  room_type: 'deluxe' | 'suite' | 'executive';
  status: 'vacant' | 'occupied' | 'reserved' | 'maintenance';
  clean_status: 'clean' | 'dirty' | 'inspected';
  guest_name?: string;
  folio_id?: string;
  rate_per_night: number; // paise
  current_folio_balance: number; // paise
  check_in_date?: string;
  charges_history?: { id: string; desc: string; amount: number; timestamp: string; is_reversed?: boolean }[];
}

export interface SystemAlert {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
  resolved: boolean;
  category: 'inventory' | 'cash' | 'hardware' | 'security';
}

export interface ZReportSummary {
  business_date: string;
  outlet_name: string;
  closed_at: string;
  gross_sales: number; // paise
  discounts: number; // paise
  net_sales: number; // paise
  taxes: {
    cgst: number;
    sgst: number;
    igst: number;
    vat: number;
  };
  settlements: {
    cash: number;
    card: number;
    upi: number;
    room_folio: number;
  };
  total_bills: number;
  total_covers: number;
  average_bill_value: number;
  void_amount: number;
}

export interface AggregatorOrder {
  id: string;
  order_id: string;
  channel: 'Zomato' | 'Swiggy';
  customer_name: string;
  status: 'placed' | 'accepted' | 'preparing' | 'ready_for_pickup' | 'picked_up' | 'delivered';
  items_summary: string;
  gross_amount: number; // paise
  commission_amount: number; // paise (e.g. 18%)
  net_payout: number; // paise
  placed_at: string;
  rider_name?: string;
  rider_phone?: string;
}

export interface MenuEngineeringItem {
  id: string;
  name: string;
  category: string;
  units_sold: number;
  selling_price: number; // paise
  food_cost: number; // paise
  margin_paise: number;
  popularity: 'high' | 'low';
  profitability: 'high' | 'low';
  quadrant: 'star' | 'plowhorse' | 'puzzle' | 'dog';
}

export interface DenominationTally {
  note_2000: number;
  note_500: number;
  note_200: number;
  note_100: number;
  note_50: number;
  note_20: number;
  note_10: number;
  coins: number;
}
