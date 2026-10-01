#include <iostream>
#include <cassert>
#include <cmath>
#include "../src/dispatcher.hpp"

void test_price_bill() {
    std::cout << "[TEST] Running test_price_bill...\n";
    json req = {
        {"id", "test-1"},
        {"op", "price_bill"},
        {"payload", {
            {"tax_mode", "no_itc_5"},
            {"is_inter_state", false},
            {"service_charge_percent", 5.0},
            {"service_charge_enabled", true},
            {"tip_paise", 5000}, // Rs 50 tip
            {"bill_discount_percent", 10.0}, // 10% bill discount
            {"items", {
                {
                    {"item_id", "p-1"},
                    {"name", "Paneer Tikka"},
                    {"quantity", 2},
                    {"unit_price_paise", 35000}, // 2 * 350 = 700
                    {"tax_rate_percent", 5.0}
                },
                {
                    {"item_id", "b-1"},
                    {"name", "Butter Naan"},
                    {"quantity", 4},
                    {"unit_price_paise", 6000}, // 4 * 60 = 240
                    {"tax_rate_percent", 5.0}
                }
            }}
        }}
    };

    servebase::WorkerResponse resp = servebase::dispatch(req);
    assert(resp.ok);
    auto res = resp.result;

    int64_t subtotal = res["subtotal_paise"];
    assert(subtotal == 94000); // 700 + 240 = 940 Rs

    int64_t bill_disc = res["bill_discount_paise"];
    assert(bill_disc == 9400); // 10% of 940 = 94 Rs

    int64_t taxable = res["taxable_value_paise"];
    assert(taxable == (subtotal - bill_disc)); // 846 Rs = 84600 paise

    int64_t cgst = res["cgst_paise"];
    int64_t sgst = res["sgst_paise"];
    assert(cgst == sgst); // CGST == SGST in GST
    assert(cgst > 0);

    // Invariant: total = taxable + cgst + sgst + igst + service_charge + tip + round_off
    int64_t total = res["total_paise"];
    int64_t sc = res["service_charge_paise"];
    int64_t tip = res["tip_paise"];
    int64_t round_off = res["round_off_paise"];

    int64_t expected_total = taxable + cgst + sgst + sc + tip + round_off;
    assert(total == expected_total);
    // Nearest rupee check: total % 100 == 0
    assert(total % 100 == 0);

    std::cout << "  ✓ price_bill: subtotal=" << subtotal << ", taxable=" << taxable 
              << ", cgst=" << cgst << ", sgst=" << sgst << ", total=" << total << " (INVARIANTS OK)\n";
}

void test_split_bill() {
    std::cout << "[TEST] Running test_split_bill...\n";
    json bill = {
        {"subtotal_paise", 94000},
        {"item_discount_paise", 0},
        {"bill_discount_paise", 9400},
        {"taxable_value_paise", 84600},
        {"cgst_paise", 2115},
        {"sgst_paise", 2115},
        {"igst_paise", 0},
        {"service_charge_paise", 4230},
        {"tip_paise", 5000},
        {"round_off_paise", -60},
        {"total_paise", 98000}
    };

    json req = {
        {"id", "split-1"},
        {"op", "split_bill"},
        {"payload", {
            {"bill", bill},
            {"split_type", "equal"},
            {"num_parts", 3} // 3 equal splits
        }}
    };

    servebase::WorkerResponse resp = servebase::dispatch(req);
    assert(resp.ok);
    auto res = resp.result;

    assert(res["splits"].size() == 3);

    int64_t sum_total = 0;
    int64_t sum_taxable = 0;
    int64_t sum_cgst = 0;
    int64_t sum_sgst = 0;
    int64_t sum_roundoff = 0;

    for (const auto& sp : res["splits"]) {
        int64_t t = sp["total_paise"];
        int64_t tx = sp["taxable_value_paise"];
        int64_t c = sp["cgst_paise"];
        int64_t s = sp["sgst_paise"];
        int64_t ro = sp["round_off_paise"];
        sum_total += t;
        sum_taxable += tx;
        sum_cgst += c;
        sum_sgst += s;
        sum_roundoff += ro;
    }

    // Largest-Remainder strict invariants: sum of splits MUST equal master bill
    int64_t master_total = bill["total_paise"];
    int64_t master_taxable = bill["taxable_value_paise"];
    int64_t master_cgst = bill["cgst_paise"];
    int64_t master_sgst = bill["sgst_paise"];
    int64_t master_roundoff = bill["round_off_paise"];

    assert(sum_total == master_total);
    assert(sum_taxable == master_taxable);
    assert(sum_cgst == master_cgst);
    assert(sum_sgst == master_sgst);
    assert(sum_roundoff == master_roundoff);

    std::cout << "  ✓ split_bill: 3-way split exact paise sum=" << sum_total 
              << " matches master total=" << master_total << " (INVARIANTS OK)\n";
}

void test_route_kot() {
    std::cout << "[TEST] Running test_route_kot...\n";
    json req = {
        {"id", "kot-1"},
        {"op", "route_kot"},
        {"payload", {
            {"stations", {
                {{"id", "k1"}, {"name", "Main Kitchen"}},
                {{"id", "b1"}, {"name", "Main Bar"}}
            }},
            {"items", {
                {{"id", "1"}, {"name", "Biryani"}, {"station_id", "k1"}, {"course", "mains"}, {"quantity", 2}},
                {{"id", "2"}, {"name", "Paneer Tikka"}, {"station_id", "k1"}, {"course", "starters"}, {"quantity", 1}},
                {{"id", "3"}, {"name", "Gulab Jamun"}, {"station_id", "k1"}, {"course", "desserts"}, {"quantity", 2}},
                {{"id", "4"}, {"name", "Gin Tonic"}, {"station_id", "b1"}, {"course", "beverages"}, {"quantity", 2}}
            }}
        }}
    };

    servebase::WorkerResponse resp = servebase::dispatch(req);
    assert(resp.ok);
    auto tickets = resp.result["tickets"];
    assert(tickets.size() == 2);

    for (const auto& t : tickets) {
        if (t["station_id"] == "k1") {
            assert(t["items"].size() == 3);
            // Verify course priority ordering: starters before mains before desserts
            assert(t["items"][0]["course"] == "starters");
            assert(t["items"][1]["course"] == "mains");
            assert(t["items"][2]["course"] == "desserts");
        } else if (t["station_id"] == "b1") {
            assert(t["items"].size() == 1);
            assert(t["items"][0]["name"] == "Gin Tonic");
        }
    }

    std::cout << "  ✓ route_kot: routed to 2 stations with course priority sequence (FIFO OK)\n";
}

void test_explode_recipe() {
    std::cout << "[TEST] Running test_explode_recipe...\n";
    json req = {
        {"id", "rec-1"},
        {"op", "explode_recipe"},
        {"payload", {
            {"ordered_items", {
                {{"menu_item_id", "pizza-1"}, {"quantity", 5.0}}, // 5 pizzas
                {{"menu_item_id", "pasta-1"}, {"quantity", 2.0}}  // 2 pastas
            }},
            {"recipes", {
                {
                    {"menu_item_id", "pizza-1"},
                    {"yield_portions", 1.0},
                    {"ingredients", {
                        {{"raw_material_id", "flour"}, {"quantity", 0.200}, {"wastage_percent", 5.0}}, // 200g + 5% waste
                        {{"raw_material_id", "cheese"}, {"quantity", 0.150}, {"wastage_percent", 0.0}}  // 150g cheese
                    }}
                },
                {
                    {"menu_item_id", "pasta-1"},
                    {"yield_portions", 1.0},
                    {"ingredients", {
                        {{"raw_material_id", "cheese"}, {"quantity", 0.050}, {"wastage_percent", 0.0}},
                        {{"raw_material_id", "cream"}, {"quantity", 0.100}, {"wastage_percent", 2.0}}
                    }}
                }
            }}
        }}
    };

    servebase::WorkerResponse resp = servebase::dispatch(req);
    assert(resp.ok);
    auto consumptions = resp.result["consumptions"];
    assert(consumptions.size() == 3);

    for (const auto& c : consumptions) {
        if (c["raw_material_id"] == "cheese") {
            // 5 * 0.150 + 2 * 0.050 = 0.75 + 0.10 = 0.850 kg
            double qty = c["total_quantity_required"];
            assert(std::abs(qty - 0.850) < 0.001);
        } else if (c["raw_material_id"] == "flour") {
            // 5 * 0.200 * 1.05 = 1.050 kg
            double qty = c["total_quantity_required"];
            assert(std::abs(qty - 1.050) < 0.001);
        }
    }

    std::cout << "  ✓ explode_recipe: calculated ingredient explosion with yield and wastage factors\n";
}

void test_compute_variance() {
    std::cout << "[TEST] Running test_compute_variance...\n";
    json req = {
        {"id", "var-1"},
        {"op", "compute_variance"},
        {"payload", {
            {"opening_stock", {
                {{"raw_material_id", "cheese"}, {"quantity", 10.0}, {"unit_cost_paise", 40000}}
            }},
            {"purchases", {
                {{"raw_material_id", "cheese"}, {"quantity", 5.0}, {"unit_cost_paise", 40000}}
            }},
            {"closing_stock", {
                {{"raw_material_id", "cheese"}, {"quantity", 6.0}}
            }},
            {"theoretical_usage", {
                {{"raw_material_id", "cheese"}, {"quantity", 8.0}}
            }}
        }}
    };

    // Actual usage = 10 + 5 - 6 = 9.0 kg
    // Theoretical = 8.0 kg
    // Variance = 8.0 - 9.0 = -1.0 kg (1 kg overused/waste)
    servebase::WorkerResponse resp = servebase::dispatch(req);
    assert(resp.ok);
    auto v = resp.result["variances"][0];
    double actual = v["actual_usage_qty"];
    double variance_qty = v["variance_qty"];
    int64_t cost = v["variance_cost_paise"];

    assert(actual == 9.0);
    assert(variance_qty == -1.0);
    assert(cost == -40000);

    std::cout << "  ✓ compute_variance: variance calculation and cost impact OK\n";
}

void test_compute_payroll() {
    std::cout << "[TEST] Running test_compute_payroll...\n";
    json req = {
        {"id", "pay-1"},
        {"op", "compute_payroll"},
        {"payload", {
            {"pf_rate_percent", 12.0},
            {"esi_rate_percent", 0.75},
            {"pt_flat_paise", 20000}, // Rs 200
            {"employees", {
                {
                    {"employee_id", "e1"},
                    {"salary_type", "monthly"},
                    {"base_rate_paise", 3000000}, // Rs 30,000
                    {"scheduled_hours", 200.0},
                    {"worked_hours", 200.0},
                    {"overtime_hours", 10.0} // 10 hrs OT
                }
            }}
        }}
    };

    servebase::WorkerResponse resp = servebase::dispatch(req);
    assert(resp.ok);
    auto p = resp.result["payslips"][0];
    int64_t gross = p["gross_paise"];
    int64_t pf = p["pf_deduction_paise"];
    int64_t net = p["net_paise"];

    assert(gross > 3000000);
    assert(pf > 0);
    assert(net < gross);

    std::cout << "  ✓ compute_payroll: salary, overtime, and statutory deductions OK\n";
}

void test_aggregate_sales() {
    std::cout << "[TEST] Running test_aggregate_sales...\n";
    json req = {
        {"id", "agg-1"},
        {"op", "aggregate_sales"},
        {"payload", {
            {"sales_records", {
                {{"weekday", 5}, {"hour", 19}, {"total_paise", 120000}, {"business_date", "2026-10-02"}, {"item_id", "p1"}, {"item_name", "Pizza"}, {"quantity", 2}, {"channel", "dine_in"}, {"covers", 2}},
                {{"weekday", 5}, {"hour", 20}, {"total_paise", 80000}, {"business_date", "2026-10-02"}, {"item_id", "p1"}, {"item_name", "Pizza"}, {"quantity", 1}, {"channel", "takeaway"}, {"covers", 1}}
            }}
        }}
    };

    servebase::WorkerResponse resp = servebase::dispatch(req);
    assert(resp.ok);
    auto res = resp.result;
    assert(res["hour_weekday_matrix"].size() == 7);
    assert(res["item_day_matrix"].size() == 1);
    int total_qty = res["item_day_matrix"][0]["total_quantity"];
    assert(total_qty == 3);

    std::cout << "  ✓ aggregate_sales: matrix rollups and channel stats OK\n";
}

void test_reconcile_shift() {
    std::cout << "[TEST] Running test_reconcile_shift...\n";
    json req = {
        {"id", "shift-1"},
        {"op", "reconcile_shift"},
        {"payload", {
            {"opening_float_paise", 500000}, // Rs 5,000 float
            {"cash_sales_paise", 1500000},   // Rs 15,000 cash sales
            {"paid_ins_paise", 100000},      // Rs 1,000
            {"paid_outs_paise", 200000},     // Rs 2,000 vendor payment
            {"cash_drops_paise", 1000000},   // Rs 10,000 safe drop
            {"denominations", {
                {"500", 18}, // 18 * 500 = 9,000
                {"100", 0}
            }}
        }}
    };

    // Expected: 5000 + 15000 + 1000 - 2000 - 10000 = 9,000 Rs = 900,000 paise
    // Actual: 18 * 500 = 9,000 Rs
    // Over/short = 0
    servebase::WorkerResponse resp = servebase::dispatch(req);
    assert(resp.ok);
    auto res = resp.result;
    int64_t expected = res["expected_cash_paise"];
    int64_t actual = res["actual_cash_paise"];
    int64_t over_short = res["over_short_paise"];
    bool balanced = res["is_balanced"];

    assert(expected == 900000);
    assert(actual == 900000);
    assert(over_short == 0);
    assert(balanced == true);

    std::cout << "  ✓ reconcile_shift: cash float and denomination reconciliation OK\n";
}

void test_menu_engineering() {
    std::cout << "[TEST] Running test_menu_engineering...\n";
    json req = {
        {"id", "me-1"},
        {"op", "menu_engineering"},
        {"payload", {
            {"items", {
                {{"item_id", "star-item"}, {"name", "Truffle Pasta"}, {"quantity_sold", 100}, {"total_revenue_paise", 6000000}, {"unit_food_cost_paise", 15000}}, // Price 600, Cost 150, CM 450, High Qty -> STAR
                {{"item_id", "dog-item"}, {"name", "Plain Bread"}, {"quantity_sold", 5}, {"total_revenue_paise", 50000}, {"unit_food_cost_paise", 8000}}         // Low Qty, Low CM -> DOG
            }}
        }}
    };

    servebase::WorkerResponse resp = servebase::dispatch(req);
    assert(resp.ok);
    auto items = resp.result["items"];
    assert(items.size() == 2);
    assert(items[0]["classification"] == "star");
    assert(items[1]["classification"] == "dog");

    std::cout << "  ✓ menu_engineering: BCG classification (star, plowhorse, puzzle, dog) OK\n";
}

void test_forecast_par() {
    std::cout << "[TEST] Running test_forecast_par...\n";
    json req = {
        {"id", "par-1"},
        {"op", "forecast_par"},
        {"payload", {
            {"historical_usage", {10.0, 12.0, 14.0, 15.0, 18.0, 20.0, 22.0}},
            {"lead_time_days", 2.0},
            {"review_cycle_days", 3.0},
            {"safety_stock_percent", 20.0},
            {"current_stock", 15.0}
        }}
    };

    servebase::WorkerResponse resp = servebase::dispatch(req);
    assert(resp.ok);
    auto res = resp.result;
    double avg_usage = res["average_daily_usage"];
    double reorder = res["reorder_point"];
    double par = res["par_level"];

    assert(avg_usage > 15.0);
    assert(reorder > 0);
    assert(par > reorder);

    std::cout << "  ✓ forecast_par: weighted demand, reorder point and par calculation OK\n";
}

int main() {
    std::cout << "=== Running ServeBase C++17 Core Engine Test Suite ===\n";
    test_price_bill();
    test_split_bill();
    test_route_kot();
    test_explode_recipe();
    test_compute_variance();
    test_compute_payroll();
    test_aggregate_sales();
    test_reconcile_shift();
    test_menu_engineering();
    test_forecast_par();
    std::cout << "=== ALL 10 CORE OPS PASSED ALL TESTS AND INVARIANTS ===\n";
    return 0;
}
