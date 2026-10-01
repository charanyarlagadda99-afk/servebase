import { query } from './pool.js';

export async function truncateAll() {
  await query(`
    TRUNCATE TABLE 
      system_alerts, folio_charges, hotel_folios, guests, rooms,
      journal_lines, journal_entries, chart_of_accounts,
      payslips, payroll_runs, statutory_deduction_rates, attendance, staff_roster, staff_shifts, employees,
      vendor_bills, grn_items, goods_receipt_notes, po_items, purchase_orders, vendors,
      stock_count_items, stock_counts, recipe_ingredients, recipes, stock_ledger, raw_materials, inventory_locations, uom_conversions, uoms,
      day_closes, shift_cash_movements, shifts,
      payment_refunds, payments, invoice_items, invoices, invoice_counters,
      kot_items, kots, order_item_modifiers, order_items, orders,
      waitlist_entries, table_reservations, tables, floor_areas,
      coupons, customers, channels,
      channel_pricing, item_modifier_groups, item_variants, menu_items, modifiers, modifier_groups, categories, kitchen_stations,
      audit_logs, approvals, user_outlet_roles, users, roles,
      terminals, outlets, brands, organizations
    CASCADE;
  `);
}
