#pragma once

#include "../types.hpp"
#include <vector>
#include <numeric>

namespace servebase {

inline json op_forecast_par(const json& payload) {
    if (!payload.contains("historical_usage") || !payload["historical_usage"].is_array()) {
        throw std::runtime_error("forecast_par requires 'historical_usage' array");
    }

    double lead_time_days = payload.value("lead_time_days", 2.0);
    double review_cycle_days = payload.value("review_cycle_days", 3.0);
    double safety_stock_percent = payload.value("safety_stock_percent", 20.0);
    double current_stock = payload.value("current_stock", 0.0);

    const auto& history = payload["historical_usage"];
    size_t count = history.size();
    if (count == 0) {
        return json{
            {"average_daily_usage", 0.0},
            {"lead_time_demand", 0.0},
            {"safety_stock", 0.0},
            {"reorder_point", 0.0},
            {"par_level", 0.0},
            {"suggested_order_qty", 0.0}
        };
    }

    // Weighted moving average: recent days have linearly higher weight
    double weight_sum = 0.0;
    double weighted_usage_sum = 0.0;
    for (size_t i = 0; i < count; ++i) {
        double w = static_cast<double>(i + 1); // Older to newer
        double u = history[i].get<double>();
        weighted_usage_sum += (u * w);
        weight_sum += w;
    }

    double avg_daily_usage = weighted_usage_sum / weight_sum;
    double lead_time_demand = avg_daily_usage * lead_time_days;
    double safety_stock = lead_time_demand * (safety_stock_percent / 100.0);
    double reorder_point = lead_time_demand + safety_stock;
    double cycle_demand = avg_daily_usage * review_cycle_days;
    double par_level = reorder_point + cycle_demand;

    double suggested_order = 0.0;
    if (current_stock <= reorder_point) {
        suggested_order = std::max(0.0, par_level - current_stock);
    }

    return json{
        {"average_daily_usage", avg_daily_usage},
        {"lead_time_demand", lead_time_demand},
        {"safety_stock", safety_stock},
        {"reorder_point", reorder_point},
        {"par_level", par_level},
        {"current_stock", current_stock},
        {"is_below_reorder_point", current_stock <= reorder_point},
        {"suggested_order_qty", suggested_order}
    };
}

} // namespace servebase
