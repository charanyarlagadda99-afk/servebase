import { Table, MenuItem, InventoryItem, StaffMember, Room, SystemAlert, KdsTicket } from '../types';

export const INITIAL_TABLES: Table[] = [
  { id: 'tbl-1', table_number: 'T-01', section: 'Main Dining', capacity: 2, status: 'vacant' },
  { id: 'tbl-2', table_number: 'T-02', section: 'Main Dining', capacity: 4, status: 'occupied', current_order_id: 'ord-101', active_bill_amount: 145000, covers: 3, server_name: 'Rahul Sharma', seated_time: '12:45 PM' },
  { id: 'tbl-3', table_number: 'T-03', section: 'Main Dining', capacity: 4, status: 'billed', current_order_id: 'ord-102', active_bill_amount: 285000, covers: 4, server_name: 'Priya Patel', seated_time: '12:15 PM' },
  { id: 'tbl-4', table_number: 'T-04', section: 'Main Dining', capacity: 6, status: 'vacant' },
  { id: 'tbl-5', table_number: 'T-05', section: 'Main Dining', capacity: 6, status: 'cleaning' },
  { id: 'tbl-6', table_number: 'T-06', section: 'Outdoor Terrace', capacity: 2, status: 'vacant' },
  { id: 'tbl-7', table_number: 'T-07', section: 'Outdoor Terrace', capacity: 4, status: 'occupied', current_order_id: 'ord-103', active_bill_amount: 89000, covers: 2, server_name: 'Rahul Sharma', seated_time: '01:10 PM' },
  { id: 'tbl-8', table_number: 'T-08', section: 'Outdoor Terrace', capacity: 4, status: 'vacant' },
  { id: 'tbl-9', table_number: 'PDR-1', section: 'Private Dining', capacity: 10, status: 'reserved', covers: 8, server_name: 'Amit Verma' },
  { id: 'tbl-10', table_number: 'PDR-2', section: 'Private Dining', capacity: 12, status: 'vacant' },
];

export const INITIAL_MENU: MenuItem[] = [
  // Appetizers / Starters (Tandoor)
  { id: 'menu-1', name: 'Paneer Tikka Angaarey', item_code: 'APP01', category: 'Starters', base_price: 38000, tax_rate_percent: 5, station: 'tandoor', is_available: true, veg_status: 'veg', description: 'Cottage cheese marinated in Kashmiri chilli & mustard oil, char-grilled' },
  { id: 'menu-2', name: 'Murgh Malai Tikka', item_code: 'APP02', category: 'Starters', base_price: 46000, tax_rate_percent: 5, station: 'tandoor', is_available: true, veg_status: 'non_veg', description: 'Tender chicken skewers infused with cardamom, mace, cream cheese' },
  { id: 'menu-3', name: 'Dahi Ke Kebab', item_code: 'APP03', category: 'Starters', base_price: 34000, tax_rate_percent: 5, station: 'tandoor', is_available: true, veg_status: 'veg', description: 'Crispy hung curd patties spiced with green coriander and ginger' },
  { id: 'menu-4', name: 'Gilafi Gosht Seekh', item_code: 'APP04', category: 'Starters', base_price: 52000, tax_rate_percent: 5, station: 'tandoor', is_available: true, veg_status: 'non_veg', description: 'Spiced minced lamb skewers cloaked in sweet bell peppers' },

  // Mains (Curry)
  { id: 'menu-5', name: 'Butter Chicken Grand Trunk', item_code: 'CUR01', category: 'Main Curries', base_price: 54000, tax_rate_percent: 5, station: 'curry', is_available: true, veg_status: 'non_veg', description: 'Smoked pulled tandoori chicken simmered in rich velvety tomato makhani' },
  { id: 'menu-6', name: 'Dal Makhani Bukhara Style', item_code: 'CUR02', category: 'Main Curries', base_price: 39000, tax_rate_percent: 5, station: 'curry', is_available: true, veg_status: 'veg', description: 'Whole black urad lentils slow-cooked overnight with white butter' },
  { id: 'menu-7', name: 'Paneer Lababdar', item_code: 'CUR03', category: 'Main Curries', base_price: 44000, tax_rate_percent: 5, station: 'curry', is_available: true, veg_status: 'veg', description: 'Fresh paneer cubes tossed in onion tomato masala finished with cream' },
  { id: 'menu-8', name: 'Nalli Rogan Josh', item_code: 'CUR04', category: 'Main Curries', base_price: 68000, tax_rate_percent: 5, station: 'curry', is_available: true, veg_status: 'non_veg', description: 'Slow-braised tender lamb shanks in Kashmiri ratanjot gravy' },

  // Biryani & Breads
  { id: 'menu-9', name: 'Dum Murgh Biryani (Awadhi)', item_code: 'BIR01', category: 'Biryani & Breads', base_price: 52000, tax_rate_percent: 5, station: 'curry', is_available: true, veg_status: 'non_veg', description: 'Fragrant aged basmati rice layered with saffron marinated chicken' },
  { id: 'menu-10', name: 'Tandoori Garlic Butter Naan', item_code: 'BRD01', category: 'Biryani & Breads', base_price: 11000, tax_rate_percent: 5, station: 'tandoor', is_available: true, veg_status: 'veg', description: 'Refined flour leavened flatbread brushed with roasted garlic butter' },
  { id: 'menu-11', name: 'Laccha Paratha', item_code: 'BRD02', category: 'Biryani & Breads', base_price: 9000, tax_rate_percent: 5, station: 'tandoor', is_available: true, veg_status: 'veg', description: 'Crispy layered whole wheat flatbread baked in clay oven' },

  // Desserts & Beverages
  { id: 'menu-12', name: 'Kesar Pista Kulfi Falooda', item_code: 'DES01', category: 'Desserts', base_price: 24000, tax_rate_percent: 5, station: 'pantry', is_available: true, veg_status: 'veg', description: 'Traditional condensed milk ice cream topped with saffron falooda' },
  { id: 'menu-13', name: 'Gulab Jamun Flambé', item_code: 'DES02', category: 'Desserts', base_price: 22000, tax_rate_percent: 5, station: 'pantry', is_available: true, veg_status: 'veg', description: 'Warm khoya dumplings soaked in fragrant cardamom sugar syrup' },
  { id: 'menu-14', name: 'Classic Fresh Lime Soda', item_code: 'BEV01', category: 'Beverages', base_price: 15000, tax_rate_percent: 5, station: 'bar', is_available: true, veg_status: 'veg', description: 'Hand-squeezed Key lime with sparkling soda (Sweet / Salt)' },
  { id: 'menu-15', name: 'Masala Chaas Pot', item_code: 'BEV02', category: 'Beverages', base_price: 16000, tax_rate_percent: 5, station: 'bar', is_available: true, veg_status: 'veg', description: 'Chilled spiced buttermilk with roasted cumin and crushed mint' },
];

export const INITIAL_KDS_TICKETS: KdsTicket[] = [
  {
    id: 'kot-101',
    kot_number: 'KOT-20261002-0041',
    order_id: 'ord-101',
    table_number: 'T-02',
    server_name: 'Rahul Sharma',
    station: 'tandoor',
    created_at: '2026-10-02T12:47:00Z',
    status: 'open',
    items: [
      { id: 'kitem-1', name: 'Paneer Tikka Angaarey', quantity: 1, course: 'starter', status: 'preparing', notes: 'Extra spicy, mint chutney', station: 'tandoor' },
      { id: 'kitem-2', name: 'Tandoori Garlic Butter Naan', quantity: 2, course: 'main', status: 'pending', notes: 'Well done', station: 'tandoor' }
    ]
  },
  {
    id: 'kot-102',
    kot_number: 'KOT-20261002-0042',
    order_id: 'ord-101',
    table_number: 'T-02',
    server_name: 'Rahul Sharma',
    station: 'curry',
    created_at: '2026-10-02T12:48:30Z',
    status: 'open',
    items: [
      { id: 'kitem-3', name: 'Butter Chicken Grand Trunk', quantity: 1, course: 'main', status: 'preparing', notes: 'Boneless only', station: 'curry' },
      { id: 'kitem-4', name: 'Dal Makhani Bukhara Style', quantity: 1, course: 'main', status: 'ready', station: 'curry' }
    ]
  },
  {
    id: 'kot-103',
    kot_number: 'KOT-20261002-0045',
    order_id: 'ord-103',
    table_number: 'T-07',
    server_name: 'Rahul Sharma',
    station: 'bar',
    created_at: '2026-10-02T13:11:00Z',
    status: 'open',
    items: [
      { id: 'kitem-5', name: 'Classic Fresh Lime Soda', quantity: 2, course: 'beverage', status: 'preparing', notes: '1 Sweet, 1 Salted', station: 'bar' }
    ]
  }
];

export const INITIAL_INVENTORY: InventoryItem[] = [
  { id: 'inv-1', sku: 'RAW-RICE-01', name: 'Aged Basmati Rice (Daawat)', category: 'Grains & Staples', unit: 'kg', current_stock: 42.5, par_level: 50.0, reorder_quantity: 50, unit_cost: 14500, supplier_name: 'Royal Grains Traders' },
  { id: 'inv-2', sku: 'RAW-DAIRY-01', name: 'Fresh Malai Paneer', category: 'Dairy', unit: 'kg', current_stock: 12.0, par_level: 15.0, reorder_quantity: 20, unit_cost: 32000, supplier_name: 'Amrit Dairy Farms' },
  { id: 'inv-3', sku: 'RAW-MEAT-01', name: 'Fresh Chicken Breast (Boneless)', category: 'Meat & Poultry', unit: 'kg', current_stock: 8.5, par_level: 25.0, reorder_quantity: 30, unit_cost: 26000, supplier_name: 'FreshMeat Logistics' },
  { id: 'inv-4', sku: 'RAW-DAIRY-02', name: 'Pure Desi Cow Ghee', category: 'Oils & Fats', unit: 'ltr', current_stock: 18.0, par_level: 20.0, reorder_quantity: 20, unit_cost: 65000, supplier_name: 'Amrit Dairy Farms' },
  { id: 'inv-5', sku: 'RAW-SPICE-01', name: 'Royal Garam Masala Blend', category: 'Spices', unit: 'kg', current_stock: 3.2, par_level: 5.0, reorder_quantity: 10, unit_cost: 85000, supplier_name: 'Kashmiri Spice Syndicate' },
  { id: 'inv-6', sku: 'RAW-VEG-01', name: 'Grade A Red Onions', category: 'Fresh Produce', unit: 'kg', current_stock: 65.0, par_level: 80.0, reorder_quantity: 100, unit_cost: 3500, supplier_name: 'Nasik Mandi Direct' },
  { id: 'inv-7', sku: 'RAW-VEG-02', name: 'Bangalore Plum Tomatoes', category: 'Fresh Produce', unit: 'kg', current_stock: 14.0, par_level: 40.0, reorder_quantity: 50, unit_cost: 4200, supplier_name: 'Nasik Mandi Direct' },
];

export const INITIAL_STAFF: StaffMember[] = [
  { id: 'stf-1', staff_id: 'SB-001', name: 'Vikramaditya Roy', role: 'manager', status: 'clocked_in', clock_in_time: '10:00 AM', phone: '+91 98201 12345', base_monthly_salary: 7500000 },
  { id: 'stf-2', staff_id: 'SB-002', name: 'Rahul Sharma', role: 'waiter', status: 'clocked_in', clock_in_time: '11:30 AM', phone: '+91 98201 23456', base_monthly_salary: 2800000 },
  { id: 'stf-3', staff_id: 'SB-003', name: 'Priya Patel', role: 'cashier', status: 'clocked_in', clock_in_time: '11:45 AM', phone: '+91 98201 34567', base_monthly_salary: 3200000 },
  { id: 'stf-4', staff_id: 'SB-004', name: 'Chef Harinder Singh', role: 'chef', status: 'clocked_in', clock_in_time: '10:30 AM', phone: '+91 98201 45678', base_monthly_salary: 6000000 },
  { id: 'stf-5', staff_id: 'SB-005', name: 'Ananya Deshmukh', role: 'receptionist', status: 'clocked_out', phone: '+91 98201 56789', base_monthly_salary: 3000000 },
];

export const INITIAL_ROOMS: Room[] = [
  { id: 'rm-101', room_number: '101', room_type: 'deluxe', status: 'occupied', clean_status: 'clean', guest_name: 'Siddharth Malhotra', folio_id: 'fol-801', rate_per_night: 650000, current_folio_balance: 145000, check_in_date: '2026-10-01' },
  { id: 'rm-102', room_number: '102', room_type: 'deluxe', status: 'vacant', clean_status: 'clean', rate_per_night: 650000, current_folio_balance: 0 },
  { id: 'rm-103', room_number: '103', room_type: 'deluxe', status: 'vacant', clean_status: 'dirty', rate_per_night: 650000, current_folio_balance: 0 },
  { id: 'rm-201', room_number: '201', room_type: 'suite', status: 'occupied', clean_status: 'clean', guest_name: 'Rajesh & Sunita Goel', folio_id: 'fol-802', rate_per_night: 1250000, current_folio_balance: 382000, check_in_date: '2026-09-30' },
  { id: 'rm-202', room_number: '202', room_type: 'suite', status: 'maintenance', clean_status: 'dirty', rate_per_night: 1250000, current_folio_balance: 0 },
  { id: 'rm-301', room_number: '301', room_type: 'executive', status: 'occupied', clean_status: 'clean', guest_name: 'Dr. Arundhati Ghosh', folio_id: 'fol-803', rate_per_night: 1850000, current_folio_balance: 520000, check_in_date: '2026-10-01' },
  { id: 'rm-302', room_number: '302', room_type: 'executive', status: 'reserved', clean_status: 'inspected', rate_per_night: 1850000, current_folio_balance: 0 },
];

export const INITIAL_ALERTS: SystemAlert[] = [
  { id: 'alt-1', title: 'Low Stock Alert', message: 'Fresh Chicken Breast (Boneless) below par level (8.5 kg / par 25.0 kg)', severity: 'warning', timestamp: '12:30 PM', resolved: false, category: 'inventory' },
  { id: 'alt-2', title: 'Room Service Charge Posted', message: 'Charge ₹1,450.00 posted to Room 101 (Guest: Siddharth Malhotra)', severity: 'info', timestamp: '12:46 PM', resolved: true, category: 'security' },
  { id: 'alt-3', title: 'Shift Register Opened', message: 'Cashier Priya Patel opened Terminal 1 with ₹5,000 float', severity: 'info', timestamp: '11:45 AM', resolved: true, category: 'cash' },
];
