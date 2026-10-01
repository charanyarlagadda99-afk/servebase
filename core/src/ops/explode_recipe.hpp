#pragma once

#include "../types.hpp"
#include <map>

namespace servebase {

inline json op_explode_recipe(const json& payload) {
    if (!payload.contains("ordered_items") || !payload["ordered_items"].is_array()) {
        throw std::runtime_error("explode_recipe requires 'ordered_items' array");
    }
    if (!payload.contains("recipes") || !payload["recipes"].is_array()) {
        throw std::runtime_error("explode_recipe requires 'recipes' array");
    }

    // Build index of recipes by menu_item_id + variant_id
    struct RecipeKey {
        std::string menu_item_id;
        std::string variant_id;
        bool operator<(const RecipeKey& other) const {
            if (menu_item_id != other.menu_item_id) return menu_item_id < other.menu_item_id;
            return variant_id < other.variant_id;
        }
    };

    struct IngredientReq {
        std::string raw_material_id;
        double quantity;
        double wastage_percent;
    };

    struct RecipeDef {
        double yield_portions;
        std::vector<IngredientReq> ingredients;
    };

    std::map<RecipeKey, RecipeDef> recipe_map;
    for (const auto& r : payload["recipes"]) {
        RecipeKey key{
            r.value("menu_item_id", ""),
            r.value("variant_id", "")
        };
        RecipeDef def;
        def.yield_portions = r.value("yield_portions", 1.0);
        if (def.yield_portions <= 0.0) def.yield_portions = 1.0;

        if (r.contains("ingredients") && r["ingredients"].is_array()) {
            for (const auto& ing : r["ingredients"]) {
                def.ingredients.push_back({
                    ing.value("raw_material_id", ""),
                    ing.value("quantity", 0.0),
                    ing.value("wastage_percent", 0.0)
                });
            }
        }
        recipe_map[key] = def;
    }

    // Map of raw_material_id -> total required quantity
    std::map<std::string, double> raw_material_totals;

    for (const auto& item : payload["ordered_items"]) {
        std::string menu_item_id = item.value("menu_item_id", "");
        std::string variant_id = item.value("variant_id", "");
        double order_qty = item.value("quantity", 1.0);

        RecipeKey key{menu_item_id, variant_id};
        auto it = recipe_map.find(key);
        // Fallback without variant if variant recipe not specifically defined
        if (it == recipe_map.end() && !variant_id.empty()) {
            it = recipe_map.find(RecipeKey{menu_item_id, ""});
        }

        if (it != recipe_map.end()) {
            const auto& def = it->second;
            double portion_factor = order_qty / def.yield_portions;

            for (const auto& ing : def.ingredients) {
                double wastage_multiplier = 1.0 + (ing.wastage_percent / 100.0);
                double needed = ing.quantity * portion_factor * wastage_multiplier;
                raw_material_totals[ing.raw_material_id] += needed;
            }
        }
    }

    json consumption_list = json::array();
    for (const auto& [mat_id, total_qty] : raw_material_totals) {
        consumption_list.push_back({
            {"raw_material_id", mat_id},
            {"total_quantity_required", total_qty}
        });
    }

    return json{
        {"consumptions", consumption_list},
        {"total_materials", consumption_list.size()}
    };
}

} // namespace servebase
