#pragma once

#include "../types.hpp"
#include <map>

namespace servebase {

inline json op_compute_variance(const json& payload) {
    // Inventory reconciliation: Opening + Purchases - Closing = Actual Usage
    // Variance = Theoretical Usage (from recipe explosion) - Actual Usage
    struct MatStock {
        double opening = 0.0;
        double purchases = 0.0;
        double closing = 0.0;
        double theoretical = 0.0;
        int64_t unit_cost_paise = 0LL;
    };

    std::map<std::string, MatStock> stock_map;

    if (payload.contains("opening_stock") && payload["opening_stock"].is_array()) {
        for (const auto& item : payload["opening_stock"]) {
            std::string id = item.value("raw_material_id", "");
            stock_map[id].opening += item.value("quantity", 0.0);
            if (item.contains("unit_cost_paise")) {
                stock_map[id].unit_cost_paise = item.value("unit_cost_paise", 0LL);
            }
        }
    }

    if (payload.contains("purchases") && payload["purchases"].is_array()) {
        for (const auto& item : payload["purchases"]) {
            std::string id = item.value("raw_material_id", "");
            stock_map[id].purchases += item.value("quantity", 0.0);
            if (item.contains("unit_cost_paise")) {
                stock_map[id].unit_cost_paise = item.value("unit_cost_paise", 0LL);
            }
        }
    }

    if (payload.contains("closing_stock") && payload["closing_stock"].is_array()) {
        for (const auto& item : payload["closing_stock"]) {
            std::string id = item.value("raw_material_id", "");
            stock_map[id].closing += item.value("quantity", 0.0);
        }
    }

    if (payload.contains("theoretical_usage") && payload["theoretical_usage"].is_array()) {
        for (const auto& item : payload["theoretical_usage"]) {
            std::string id = item.value("raw_material_id", "");
            stock_map[id].theoretical += item.value("quantity", 0.0);
        }
    }

    json variance_items = json::array();
    int64_t total_variance_cost_paise = 0;

    for (const auto& [mat_id, st] : stock_map) {
        double actual_usage = st.opening + st.purchases - st.closing;
        double variance_qty = st.theoretical - actual_usage; // Negative means actual usage exceeded recipe theoretical usage
        int64_t variance_cost = static_cast<int64_t>(std::round(variance_qty * st.unit_cost_paise));
        total_variance_cost_paise += variance_cost;

        double variance_pct = 0.0;
        if (st.theoretical > 0.0) {
            variance_pct = (variance_qty / st.theoretical) * 100.0;
        }

        std::string flag = "normal";
        std::string primary_reason = "within_tolerance";
        if (variance_qty < 0.0) {
            if (std::abs(variance_pct) > 10.0) {
                flag = "critical_leakage";
                primary_reason = "waste_or_portioning_error";
            } else {
                flag = "warning_shortage";
                primary_reason = "slight_overportioning";
            }
        } else if (variance_qty > 0.0 && variance_pct > 15.0) {
            flag = "suspicious_surplus";
            primary_reason = "underportioning_or_unrecorded_purchase";
        }

        variance_items.push_back({
            {"raw_material_id", mat_id},
            {"opening_qty", st.opening},
            {"purchases_qty", st.purchases},
            {"closing_qty", st.closing},
            {"actual_usage_qty", actual_usage},
            {"theoretical_usage_qty", st.theoretical},
            {"variance_qty", variance_qty},
            {"variance_percent", variance_pct},
            {"unit_cost_paise", st.unit_cost_paise},
            {"variance_cost_paise", variance_cost},
            {"flag", flag},
            {"reason", primary_reason}
        });
    }

    return json{
        {"variances", variance_items},
        {"total_materials_evaluated", variance_items.size()},
        {"total_variance_cost_paise", total_variance_cost_paise}
    };
}

} // namespace servebase
