#pragma once

#include "../types.hpp"
#include <map>
#include <vector>

namespace servebase {

inline json op_aggregate_sales(const json& payload) {
    if (!payload.contains("sales_records") || !payload["sales_records"].is_array()) {
        throw std::runtime_error("aggregate_sales requires 'sales_records' array");
    }

    // 1. Hour (0-23) x Weekday (0-6) matrix
    // 7 weekdays (0 = Sunday ... 6 = Saturday)
    int64_t hour_weekday_revenue[7][24] = {{0}};
    int64_t hour_weekday_orders[7][24] = {{0}};

    // 2. Item x Day matrix: item_id -> map<date, {qty, revenue}>
    struct ItemDayStats {
        int quantity = 0;
        int64_t revenue_paise = 0LL;
    };
    std::map<std::string, std::map<std::string, ItemDayStats>> item_day_stats;
    std::map<std::string, std::string> item_names;

    // 3. Channel summary
    struct ChannelStats {
        int order_count = 0;
        int64_t total_paise = 0LL;
        int covers = 0;
    };
    std::map<std::string, ChannelStats> channel_stats;

    for (const auto& rec : payload["sales_records"]) {
        int weekday = rec.value("weekday", 0); // 0 to 6
        int hour = rec.value("hour", 0);       // 0 to 23
        int64_t revenue = rec.value("total_paise", 0LL);
        std::string date = rec.value("business_date", "");
        std::string item_id = rec.value("item_id", "");
        std::string item_name = rec.value("item_name", "");
        int qty = rec.value("quantity", 1);
        std::string channel = rec.value("channel", "dine_in");
        int covers = rec.value("covers", 1);

        if (weekday >= 0 && weekday < 7 && hour >= 0 && hour < 24) {
            hour_weekday_revenue[weekday][hour] += revenue;
            hour_weekday_orders[weekday][hour] += 1;
        }

        if (!item_id.empty() && !date.empty()) {
            item_day_stats[item_id][date].quantity += qty;
            item_day_stats[item_id][date].revenue_paise += revenue;
            if (!item_name.empty()) item_names[item_id] = item_name;
        }

        if (!channel.empty()) {
            channel_stats[channel].order_count += 1;
            channel_stats[channel].total_paise += revenue;
            channel_stats[channel].covers += covers;
        }
    }

    // Format Hour x Weekday heatmap
    json heatmap = json::array();
    for (int d = 0; d < 7; ++d) {
        json day_hours = json::array();
        for (int h = 0; h < 24; ++h) {
            day_hours.push_back({
                {"hour", h},
                {"revenue_paise", hour_weekday_revenue[d][h]},
                {"orders", hour_weekday_orders[d][h]}
            });
        }
        heatmap.push_back({
            {"weekday", d},
            {"hours", day_hours}
        });
    }

    // Format Item x Day matrix
    json item_matrix = json::array();
    for (const auto& [i_id, dates] : item_day_stats) {
        json daily = json::array();
        int64_t total_item_rev = 0;
        int total_item_qty = 0;
        for (const auto& [dt, st] : dates) {
            daily.push_back({
                {"date", dt},
                {"quantity", st.quantity},
                {"revenue_paise", st.revenue_paise}
            });
            total_item_rev += st.revenue_paise;
            total_item_qty += st.quantity;
        }
        item_matrix.push_back({
            {"item_id", i_id},
            {"item_name", item_names.count(i_id) ? item_names[i_id] : i_id},
            {"total_quantity", total_item_qty},
            {"total_revenue_paise", total_item_rev},
            {"daily_trend", daily}
        });
    }

    // Format Channels
    json channels = json::array();
    for (const auto& [ch, st] : channel_stats) {
        channels.push_back({
            {"channel", ch},
            {"order_count", st.order_count},
            {"total_paise", st.total_paise},
            {"covers", st.covers}
        });
    }

    return json{
        {"hour_weekday_matrix", heatmap},
        {"item_day_matrix", item_matrix},
        {"channel_summary", channels}
    };
}

} // namespace servebase
