-- ServeBase PostgreSQL Schema
-- Money stored as BIGINT paise (1 INR = 100 paise)
-- Timestamps in UTC with business_date
-- Optimistic concurrency version column on orders and tables
-- Soft deletes only (deleted_at TIMESTAMPTZ NULL)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Organizations & Outlets
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS outlets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES brands(id),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    gstin VARCHAR(20) NOT NULL,
    address TEXT NOT NULL,
    state_code VARCHAR(10) NOT NULL DEFAULT '07',
    state_name VARCHAR(100) NOT NULL DEFAULT 'Delhi',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    financial_year_start_month INT NOT NULL DEFAULT 4,
    business_day_cutoff_hour INT NOT NULL DEFAULT 4,
    tax_mode VARCHAR(30) NOT NULL DEFAULT 'no_itc_5', -- 'no_itc_5', 'itc_18', 'composition'
    price_tax_inclusive BOOLEAN NOT NULL DEFAULT FALSE,
    rounding_rule VARCHAR(30) NOT NULL DEFAULT 'nearest_rupee',
    service_charge_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    service_charge_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    target_food_cost_min NUMERIC(5,2) NOT NULL DEFAULT 28.00,
    target_food_cost_max NUMERIC(5,2) NOT NULL DEFAULT 35.00,
    target_labor_cost_min NUMERIC(5,2) NOT NULL DEFAULT 25.00,
    target_labor_cost_max NUMERIC(5,2) NOT NULL DEFAULT 35.00,
    target_prime_cost_max NUMERIC(5,2) NOT NULL DEFAULT 65.00,
    current_business_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS terminals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    name VARCHAR(100) NOT NULL,
    terminal_code VARCHAR(20) NOT NULL,
    invoice_series_code VARCHAR(10) NOT NULL DEFAULT 'T1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    UNIQUE(outlet_id, terminal_code)
);

-- Users & Roles
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    discount_cap_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    can_void_after_kot BOOLEAN NOT NULL DEFAULT FALSE,
    can_approve_refund BOOLEAN NOT NULL DEFAULT FALSE,
    can_override_price BOOLEAN NOT NULL DEFAULT FALSE,
    can_open_drawer_no_sale BOOLEAN NOT NULL DEFAULT FALSE,
    can_reprint_bill BOOLEAN NOT NULL DEFAULT FALSE,
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    pin_hash VARCHAR(255),
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    failed_pin_attempts INT NOT NULL DEFAULT 0,
    pin_locked_until TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS user_outlet_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    role_id UUID NOT NULL REFERENCES roles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, outlet_id, role_id)
);

CREATE TABLE IF NOT EXISTS approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    approver_user_id UUID NOT NULL REFERENCES users(id),
    action_type VARCHAR(50) NOT NULL,
    reference_id UUID,
    reason TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tamper-Evident Audit Log (SHA-256 Hash Chain)
CREATE TABLE IF NOT EXISTS audit_logs (
    seq BIGSERIAL UNIQUE,
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID REFERENCES outlets(id),
    user_id UUID REFERENCES users(id),
    terminal_id UUID REFERENCES terminals(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    before_state JSONB,
    after_state JSONB,
    prev_hash VARCHAR(64) NOT NULL,
    entry_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS seq BIGSERIAL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_outlet ON audit_logs(outlet_id, seq);

-- Menu & Stations
CREATE TABLE IF NOT EXISTS kitchen_stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    name VARCHAR(100) NOT NULL,
    station_code VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    UNIQUE(outlet_id, station_code)
);

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    name VARCHAR(100) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    parent_id UUID REFERENCES categories(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS modifier_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    name VARCHAR(100) NOT NULL,
    min_selection INT NOT NULL DEFAULT 0,
    max_selection INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS modifiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES modifier_groups(id),
    name VARCHAR(100) NOT NULL,
    price_paise BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    category_id UUID NOT NULL REFERENCES categories(id),
    station_id UUID REFERENCES kitchen_stations(id),
    name VARCHAR(255) NOT NULL,
    short_name VARCHAR(50),
    description TEXT,
    dietary_type VARCHAR(20) NOT NULL DEFAULT 'veg', -- 'veg', 'non_veg', 'egg'
    sac_hsn_code VARCHAR(20) NOT NULL DEFAULT '996331',
    tax_rate_percent NUMERIC(5,2) NOT NULL DEFAULT 5.00,
    base_price_paise BIGINT NOT NULL,
    prep_time_minutes INT NOT NULL DEFAULT 15,
    default_course VARCHAR(20) NOT NULL DEFAULT 'mains', -- 'starters', 'mains', 'desserts', 'beverages'
    is_open_item BOOLEAN NOT NULL DEFAULT FALSE,
    is_combo BOOLEAN NOT NULL DEFAULT FALSE,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    allergens TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS item_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id UUID NOT NULL REFERENCES menu_items(id),
    name VARCHAR(100) NOT NULL,
    price_paise BIGINT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS item_modifier_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id UUID NOT NULL REFERENCES menu_items(id),
    modifier_group_id UUID NOT NULL REFERENCES modifier_groups(id),
    UNIQUE(menu_item_id, modifier_group_id)
);

CREATE TABLE IF NOT EXISTS channel_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id UUID NOT NULL REFERENCES menu_items(id),
    variant_id UUID REFERENCES item_variants(id),
    channel VARCHAR(30) NOT NULL, -- 'dine_in', 'takeaway', 'delivery', 'aggregator', 'room_service'
    price_paise BIGINT NOT NULL,
    UNIQUE(menu_item_id, variant_id, channel)
);

-- Floor & Tables
CREATE TABLE IF NOT EXISTS floor_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    name VARCHAR(100) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    area_id UUID NOT NULL REFERENCES floor_areas(id),
    table_number VARCHAR(20) NOT NULL,
    capacity INT NOT NULL DEFAULT 4,
    status VARCHAR(30) NOT NULL DEFAULT 'available', -- 'available', 'occupied', 'bill_printed', 'partially_paid', 'reserved', 'cleaning', 'blocked', 'locked'
    active_order_id UUID,
    current_covers INT NOT NULL DEFAULT 0,
    assigned_waiter_id UUID REFERENCES users(id),
    status_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version INT NOT NULL DEFAULT 1,
    locked_by_user_id UUID REFERENCES users(id),
    locked_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    UNIQUE(outlet_id, table_number)
);

CREATE TABLE IF NOT EXISTS table_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    table_id UUID REFERENCES tables(id),
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(30) NOT NULL,
    guest_count INT NOT NULL DEFAULT 2,
    reservation_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'confirmed', -- 'confirmed', 'seated', 'cancelled', 'no_show'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS waitlist_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    token_number INT NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(30) NOT NULL,
    guest_count INT NOT NULL DEFAULT 2,
    status VARCHAR(20) NOT NULL DEFAULT 'waiting', -- 'waiting', 'notified', 'seated', 'cancelled'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Customers & Loyalty
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(30) UNIQUE NOT NULL,
    email VARCHAR(255),
    gstin VARCHAR(20),
    loyalty_points INT NOT NULL DEFAULT 0,
    loyalty_tier VARCHAR(20) NOT NULL DEFAULT 'bronze', -- 'bronze', 'silver', 'gold', 'platinum'
    total_spend_paise BIGINT NOT NULL DEFAULT 0,
    visit_count INT NOT NULL DEFAULT 0,
    consent_marketing BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    code VARCHAR(50) NOT NULL UNIQUE,
    discount_type VARCHAR(20) NOT NULL DEFAULT 'percent', -- 'percent', 'flat'
    discount_value NUMERIC(10,2) NOT NULL,
    min_order_paise BIGINT NOT NULL DEFAULT 0,
    max_discount_paise BIGINT,
    valid_until DATE NOT NULL,
    usage_limit INT NOT NULL DEFAULT 1000,
    times_used INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Orders & Kitchen Tickets
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    terminal_id UUID REFERENCES terminals(id),
    order_type VARCHAR(30) NOT NULL DEFAULT 'dine_in', -- 'dine_in', 'takeaway', 'delivery', 'room_service', 'aggregator', 'qr_table'
    table_id UUID REFERENCES tables(id),
    customer_id UUID REFERENCES customers(id),
    room_number VARCHAR(20),
    hotel_folio_id UUID,
    status VARCHAR(30) NOT NULL DEFAULT 'open', -- 'open', 'kot_sent', 'preparing', 'ready', 'served', 'billed', 'paid', 'closed', 'cancelled'
    covers INT NOT NULL DEFAULT 1,
    business_date DATE NOT NULL,
    version INT NOT NULL DEFAULT 1,
    notes TEXT,
    created_by_user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    menu_item_id UUID NOT NULL REFERENCES menu_items(id),
    variant_id UUID REFERENCES item_variants(id),
    item_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price_paise BIGINT NOT NULL,
    course VARCHAR(20) NOT NULL DEFAULT 'mains',
    course_status VARCHAR(20) NOT NULL DEFAULT 'hold', -- 'hold', 'fire'
    notes TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'preparing', 'ready', 'served', 'voided'
    is_complimentary BOOLEAN NOT NULL DEFAULT FALSE,
    comp_reason TEXT,
    comp_authorized_by UUID REFERENCES users(id),
    is_voided BOOLEAN NOT NULL DEFAULT FALSE,
    void_reason TEXT,
    void_approved_by UUID REFERENCES users(id),
    void_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_item_modifiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    modifier_id UUID NOT NULL REFERENCES modifiers(id),
    name VARCHAR(100) NOT NULL,
    price_paise BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS kots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    order_id UUID NOT NULL REFERENCES orders(id),
    station_id UUID NOT NULL REFERENCES kitchen_stations(id),
    kot_number INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'sent', -- 'sent', 'preparing', 'ready', 'served', 'cancelled'
    is_reprint BOOLEAN NOT NULL DEFAULT FALSE,
    reprint_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE kots ADD COLUMN IF NOT EXISTS bumped_at TIMESTAMPTZ;
ALTER TABLE kots ADD COLUMN IF NOT EXISTS recalled_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS kot_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kot_id UUID NOT NULL REFERENCES kots(id),
    order_item_id UUID NOT NULL REFERENCES order_items(id),
    quantity INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'queued', -- 'queued', 'preparing', 'ready', 'bumped'
    bumped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Billing, Invoices & Payments
CREATE TABLE IF NOT EXISTS invoice_counters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    series_code VARCHAR(10) NOT NULL,
    financial_year VARCHAR(10) NOT NULL,
    last_number INT NOT NULL DEFAULT 0,
    UNIQUE(outlet_id, series_code, financial_year)
);

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    terminal_id UUID REFERENCES terminals(id),
    order_id UUID NOT NULL REFERENCES orders(id),
    invoice_number VARCHAR(16) NOT NULL UNIQUE,
    financial_year VARCHAR(10) NOT NULL,
    business_date DATE NOT NULL,
    invoice_type VARCHAR(20) NOT NULL DEFAULT 'tax_invoice', -- 'tax_invoice', 'bill_of_supply', 'credit_note'
    related_invoice_id UUID REFERENCES invoices(id),
    supplier_gstin VARCHAR(20) NOT NULL,
    recipient_gstin VARCHAR(20),
    recipient_name VARCHAR(255),
    place_of_supply VARCHAR(50) NOT NULL DEFAULT '07-Delhi',
    subtotal_paise BIGINT NOT NULL,
    item_discount_paise BIGINT NOT NULL DEFAULT 0,
    bill_discount_paise BIGINT NOT NULL DEFAULT 0,
    taxable_value_paise BIGINT NOT NULL,
    cgst_paise BIGINT NOT NULL DEFAULT 0,
    sgst_paise BIGINT NOT NULL DEFAULT 0,
    igst_paise BIGINT NOT NULL DEFAULT 0,
    service_charge_paise BIGINT NOT NULL DEFAULT 0,
    tip_paise BIGINT NOT NULL DEFAULT 0,
    round_off_paise BIGINT NOT NULL DEFAULT 0,
    total_paise BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'issued', -- 'issued', 'cancelled', 'credit_noted'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    menu_item_id UUID NOT NULL REFERENCES menu_items(id),
    item_name VARCHAR(255) NOT NULL,
    sac_code VARCHAR(20) NOT NULL DEFAULT '996331',
    quantity INT NOT NULL,
    unit_price_paise BIGINT NOT NULL,
    discount_paise BIGINT NOT NULL DEFAULT 0,
    taxable_value_paise BIGINT NOT NULL,
    tax_rate_percent NUMERIC(5,2) NOT NULL DEFAULT 5.00,
    cgst_paise BIGINT NOT NULL DEFAULT 0,
    sgst_paise BIGINT NOT NULL DEFAULT 0,
    igst_paise BIGINT NOT NULL DEFAULT 0,
    total_paise BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    invoice_id UUID REFERENCES invoices(id),
    order_id UUID NOT NULL REFERENCES orders(id),
    payment_method VARCHAR(30) NOT NULL, -- 'cash', 'card', 'upi', 'wallet', 'voucher', 'house_account', 'charge_to_room'
    amount_paise BIGINT NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    status VARCHAR(20) NOT NULL DEFAULT 'completed', -- 'completed', 'refunded', 'failed'
    idempotency_key VARCHAR(100) NOT NULL UNIQUE,
    gateway_ref VARCHAR(100),
    simulated BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id),
    amount_paise BIGINT NOT NULL,
    reason TEXT NOT NULL,
    approved_by UUID NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    simulated BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shifts & Cash Management
CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    terminal_id UUID NOT NULL REFERENCES terminals(id),
    user_id UUID NOT NULL REFERENCES users(id),
    business_date DATE NOT NULL,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    opening_float_paise BIGINT NOT NULL DEFAULT 0,
    closing_cash_actual_paise BIGINT,
    closing_cash_expected_paise BIGINT,
    over_short_paise BIGINT,
    is_blind_closed BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'open', -- 'open', 'closed'
    denomination_breakdown JSONB,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS shift_cash_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID NOT NULL REFERENCES shifts(id),
    movement_type VARCHAR(20) NOT NULL, -- 'paid_in', 'paid_out', 'drop', 'no_sale_open'
    amount_paise BIGINT NOT NULL,
    reason TEXT NOT NULL,
    authorized_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS day_closes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    business_date DATE NOT NULL,
    closed_by_user_id UUID NOT NULL REFERENCES users(id),
    closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    summary_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(outlet_id, business_date)
);

-- Inventory & Stock Ledger
CREATE TABLE IF NOT EXISTS uoms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    symbol VARCHAR(20) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS uom_conversions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_uom_id UUID NOT NULL REFERENCES uoms(id),
    to_uom_id UUID NOT NULL REFERENCES uoms(id),
    factor NUMERIC(12,6) NOT NULL,
    UNIQUE(from_uom_id, to_uom_id)
);

CREATE TABLE IF NOT EXISTS inventory_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS raw_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(50) NOT NULL,
    uom_id UUID NOT NULL REFERENCES uoms(id),
    category VARCHAR(100) NOT NULL DEFAULT 'kitchen',
    current_cost_paise BIGINT NOT NULL DEFAULT 0,
    par_level NUMERIC(10,3) NOT NULL DEFAULT 10.0,
    reorder_point NUMERIC(10,3) NOT NULL DEFAULT 5.0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    UNIQUE(outlet_id, sku)
);

CREATE TABLE IF NOT EXISTS stock_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    location_id UUID REFERENCES inventory_locations(id),
    raw_material_id UUID NOT NULL REFERENCES raw_materials(id),
    movement_type VARCHAR(30) NOT NULL, -- 'purchase', 'sale_consumption', 'transfer_in', 'transfer_out', 'wastage', 'adjustment', 'production'
    quantity NUMERIC(12,3) NOT NULL, -- positive for in, negative for out
    unit_cost_paise BIGINT NOT NULL,
    total_value_paise BIGINT NOT NULL,
    reference_id UUID,
    batch_number VARCHAR(50),
    expiry_date DATE,
    notes TEXT,
    business_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_mat ON stock_ledger(raw_material_id, created_at);

CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id UUID NOT NULL REFERENCES menu_items(id),
    variant_id UUID REFERENCES item_variants(id),
    yield_portions NUMERIC(8,2) NOT NULL DEFAULT 1.0,
    version INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    raw_material_id UUID NOT NULL REFERENCES raw_materials(id),
    quantity NUMERIC(10,3) NOT NULL,
    uom_id UUID NOT NULL REFERENCES uoms(id),
    wastage_percent NUMERIC(5,2) NOT NULL DEFAULT 0.0
);

CREATE TABLE IF NOT EXISTS stock_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    count_type VARCHAR(20) NOT NULL DEFAULT 'cycle', -- 'cycle', 'full'
    business_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- 'draft', 'approved', 'posted'
    created_by UUID NOT NULL REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_count_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_count_id UUID NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
    raw_material_id UUID NOT NULL REFERENCES raw_materials(id),
    theoretical_qty NUMERIC(12,3) NOT NULL,
    actual_qty NUMERIC(12,3) NOT NULL,
    variance_qty NUMERIC(12,3) NOT NULL,
    cost_paise BIGINT NOT NULL,
    variance_reason VARCHAR(50)
);

-- Purchasing & Vendors
CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    gstin VARCHAR(20) NOT NULL,
    contact_name VARCHAR(100),
    phone VARCHAR(30),
    email VARCHAR(255),
    payment_terms_days INT NOT NULL DEFAULT 30,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    po_number VARCHAR(30) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- 'draft', 'approved', 'sent', 'partially_received', 'closed'
    subtotal_paise BIGINT NOT NULL DEFAULT 0,
    tax_paise BIGINT NOT NULL DEFAULT 0,
    total_paise BIGINT NOT NULL DEFAULT 0,
    created_by UUID NOT NULL REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS po_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    raw_material_id UUID NOT NULL REFERENCES raw_materials(id),
    quantity NUMERIC(12,3) NOT NULL,
    unit_price_paise BIGINT NOT NULL,
    tax_rate_percent NUMERIC(5,2) NOT NULL DEFAULT 0.0,
    total_paise BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS goods_receipt_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    purchase_order_id UUID REFERENCES purchase_orders(id),
    grn_number VARCHAR(30) NOT NULL UNIQUE,
    vendor_invoice_number VARCHAR(50) NOT NULL,
    received_date DATE NOT NULL,
    subtotal_paise BIGINT NOT NULL,
    tax_paise BIGINT NOT NULL,
    total_paise BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'verified', -- 'verified', 'mismatched', 'posted'
    received_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grn_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_id UUID NOT NULL REFERENCES goods_receipt_notes(id) ON DELETE CASCADE,
    raw_material_id UUID NOT NULL REFERENCES raw_materials(id),
    po_qty NUMERIC(12,3) NOT NULL,
    received_qty NUMERIC(12,3) NOT NULL,
    unit_price_paise BIGINT NOT NULL,
    tax_rate_percent NUMERIC(5,2) NOT NULL DEFAULT 0.0,
    total_paise BIGINT NOT NULL,
    batch_number VARCHAR(50),
    expiry_date DATE
);

CREATE TABLE IF NOT EXISTS vendor_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    grn_id UUID REFERENCES goods_receipt_notes(id),
    bill_number VARCHAR(50) NOT NULL,
    bill_date DATE NOT NULL,
    due_date DATE NOT NULL,
    subtotal_paise BIGINT NOT NULL,
    tax_paise BIGINT NOT NULL,
    total_paise BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'partially_paid'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Staff, Attendance & Payroll
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    user_id UUID REFERENCES users(id),
    employee_code VARCHAR(30) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL,
    phone VARCHAR(30),
    email VARCHAR(255),
    salary_type VARCHAR(20) NOT NULL DEFAULT 'monthly', -- 'monthly', 'hourly'
    base_rate_paise BIGINT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS staff_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    name VARCHAR(50) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL
);

CREATE TABLE IF NOT EXISTS staff_roster (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    employee_id UUID NOT NULL REFERENCES employees(id),
    shift_id UUID NOT NULL REFERENCES staff_shifts(id),
    work_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(employee_id, work_date)
);

CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    work_date DATE NOT NULL,
    clock_in TIMESTAMPTZ NOT NULL,
    clock_out TIMESTAMPTZ,
    break_minutes INT NOT NULL DEFAULT 0,
    is_late BOOLEAN NOT NULL DEFAULT FALSE,
    is_early_departure BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'present',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(employee_id, work_date)
);

CREATE TABLE IF NOT EXISTS statutory_deduction_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    component_name VARCHAR(50) NOT NULL,
    percentage NUMERIC(5,2) NOT NULL DEFAULT 0.0,
    flat_amount_paise BIGINT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    notice_text TEXT NOT NULL DEFAULT 'Verify with your accountant before activating statutory deduction tables.'
);

CREATE TABLE IF NOT EXISTS payroll_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    month INT NOT NULL,
    year INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- 'draft', 'approved', 'disbursed'
    total_gross_paise BIGINT NOT NULL DEFAULT 0,
    total_deductions_paise BIGINT NOT NULL DEFAULT 0,
    total_net_paise BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(outlet_id, month, year)
);

CREATE TABLE IF NOT EXISTS payslips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id),
    gross_salary_paise BIGINT NOT NULL,
    pf_deduction_paise BIGINT NOT NULL DEFAULT 0,
    esi_deduction_paise BIGINT NOT NULL DEFAULT 0,
    pt_deduction_paise BIGINT NOT NULL DEFAULT 0,
    tds_deduction_paise BIGINT NOT NULL DEFAULT 0,
    net_salary_paise BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- General Ledger & Double-Entry Accounting
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    account_code VARCHAR(20) NOT NULL UNIQUE,
    account_name VARCHAR(100) NOT NULL,
    account_type VARCHAR(30) NOT NULL, -- 'asset', 'liability', 'equity', 'revenue', 'expense'
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    business_date DATE NOT NULL,
    entry_number VARCHAR(30) NOT NULL UNIQUE,
    entry_type VARCHAR(30) NOT NULL, -- 'sale', 'consumption', 'purchase', 'payroll', 'expense', 'manual'
    reference_id UUID,
    narration TEXT NOT NULL,
    posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    debit_paise BIGINT NOT NULL DEFAULT 0,
    credit_paise BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines(account_id);

-- Hotel Extension (Rooms, Folios, Charges)
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    room_number VARCHAR(20) NOT NULL UNIQUE,
    room_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'clean', -- 'clean', 'occupied', 'dirty', 'maintenance'
    base_tariff_paise BIGINT NOT NULL DEFAULT 450000 -- e.g. Rs 4,500
);

CREATE TABLE IF NOT EXISTS guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(255),
    id_type VARCHAR(50),
    id_number VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hotel_folios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id),
    guest_id UUID NOT NULL REFERENCES guests(id),
    check_in_date TIMESTAMPTZ NOT NULL,
    check_out_date TIMESTAMPTZ,
    credit_limit_paise BIGINT NOT NULL DEFAULT 5000000, -- Rs 50,000 credit limit
    total_posted_paise BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'settled', 'cancelled'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS folio_charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folio_id UUID NOT NULL REFERENCES hotel_folios(id),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    charge_type VARCHAR(30) NOT NULL, -- 'room_charge', 'restaurant_charge', 'room_service', 'tax'
    description TEXT NOT NULL,
    amount_paise BIGINT NOT NULL,
    reference_invoice_id UUID REFERENCES invoices(id),
    is_reversed BOOLEAN NOT NULL DEFAULT FALSE,
    reversed_at TIMESTAMPTZ,
    reversal_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Aggregators & Channels
CREATE TABLE IF NOT EXISTS channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    name VARCHAR(50) NOT NULL, -- 'zomato', 'swiggy', 'direct_web'
    commission_percent NUMERIC(5,2) NOT NULL DEFAULT 20.0,
    gst_collected_by VARCHAR(20) NOT NULL DEFAULT 'platform', -- 'platform', 'merchant' (confirm with CA)
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(outlet_id, name)
);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES channels(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS external_order_id VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rider_name VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rider_phone VARCHAR(30);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rider_status VARCHAR(30);

-- Notifications & Alerts Outbox
CREATE TABLE IF NOT EXISTS system_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id),
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'info', -- 'info', 'warning', 'critical'
    message TEXT NOT NULL,
    metadata JSONB,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
