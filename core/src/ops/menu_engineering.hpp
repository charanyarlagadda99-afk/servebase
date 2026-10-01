#pragma once

#include "../types.hpp"
#include <vector>
#include <numeric>

namespace servebase {

inline json op_menu_engineering(const json& payload) {
    if (!payload.contains("items") || !payload["items"].is_array()) {
        throw std::runtime_error("menu_engineering requires 'items' array");
    }

    struct ItemData {
        std::string item_id;
        std::string name;
        std::string category;
        int quantity_sold;
        int64_t total_revenue_paise;
        int64_t unit_food_cost_paise;
        int64_t unit_price_paise;
        int64_t unit_cm_paise;
        int64_t total_cm_paise;
    };

    std::vector<ItemData> items;
    int total_quantity_sold = 0;
    int64_t total_revenue_paise = 0;
    int64_t total_cm_paise = 0;

    for (const auto& it : payload["items"]) {
        ItemData d;
        d.item_id = it.value("item_id", "");
        d.name = it.value("name", "");
        d.category = it.value("category", "General");
        d.quantity_sold = it.value("quantity_sold", 0);
        d.total_revenue_paise = it.value("total_revenue_paise", 0LL);
        d.unit_food_cost_paise = it.value("unit_food_cost_paise", 0LL);

        if (d.quantity_sold > 0) {
            d.unit_price_paise = d.total_revenue_paise / d.quantity_sold;
        } else {
            d.unit_price_paise = it.value("unit_price_paise", 0LL);
        }

        d.unit_cm_paise = d.unit_price_paise - d.unit_food_cost_paise;
        d.total_cm_paise = d.unit_cm_paise * d.quantity_sold;

        total_quantity_sold += d.quantity_sold;
        total_revenue_paise += d.total_revenue_paise;
        total_cm_paise += d.total_cm_paise;

        items.push_back(d);
    }

    size_t n = items.size();
    if (n == 0) {
        return json{
            {"items", json::array()},
            {"average_cm_paise", 0},
            {"total_revenue_paise", 0},
            {"total_quantity_sold", 0}
        };
    }

    // Benchmark thresholds:
    // 1. Average CM = total CM / total quantity sold
    int64_t average_cm_paise = total_quantity_sold > 0 ? (total_cm_paise / total_quantity_sold) : 0LL;

    // 2. Popularity threshold = 70% of fair share (1 / n)
    double fair_share = 1.0 / static_cast<double>(n);
    double popularity_threshold = 0.70 * fair_share;

    json classified_items = json::array();

    for (const auto& it : items) {
        double item_share = total_quantity_sold > 0 ? (static_cast<double>(it.quantity_sold) / total_quantity_sold) : 0.0;
        bool high_popularity = item_share >= popularity_threshold;
        bool high_cm = it.unit_cm_paise >= average_cm_paise;

        std::string classification;
        std::string recommendation;

        if (high_popularity && high_cm) {
            classification = "star";
            recommendation = "Maintain consistency, protect recipe standards, prime menu real-estate placement";
        } else if (high_popularity && !high_cm) {
            classification = "plowhorse";
            recommendation = "Re-engineer recipe to reduce food cost or test modest price increase";
        } else if (!high_popularity && high_cm) {
            classification = "puzzle";
            recommendation = "High margin item: boost visibility, feature in specials, or train servers to upsell";
        } else {
            classification = "dog";
            recommendation = "Low margin and low volume: consider retiring item or replacing with new offering";
        }

        double food_cost_pct = it.unit_price_paise > 0 ? (static_cast<double>(it.unit_food_cost_paise) / it.unit_price_paise) * 100.0 : 0.0;

        classified_items.push_back({
            {"item_id", it.item_id},
            {"name", it.name},
            {"category", it.category},
            {"quantity_sold", it.quantity_sold},
            {"unit_price_paise", it.unit_price_paise},
            {"unit_food_cost_paise", it.unit_food_cost_paise},
            {"food_cost_percent", food_cost_pct},
            {"unit_cm_paise", it.unit_cm_paise},
            {"total_cm_paise", it.total_cm_paise},
            {"sales_share_percent", item_share * 100.0},
            {"classification", classification},
            {"recommendation", recommendation}
        });
    }

    return json{
        {"items", classified_items},
        {"average_cm_paise", average_cm_paise},
        {"total_revenue_paise", total_revenue_paise},
        {"total_cm_paise", total_cm_paise},
        {"total_quantity_sold", total_quantity_sold}
    };
}

} // namespace servebase
