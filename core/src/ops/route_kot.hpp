#pragma once

#include "../types.hpp"
#include <map>
#include <algorithm>

namespace servebase {

inline int get_course_priority(const std::string& course) {
    if (course == "starters" || course == "starter") return 1;
    if (course == "mains" || course == "main") return 2;
    if (course == "desserts" || course == "dessert") return 3;
    if (course == "beverages" || course == "beverage" || course == "drinks") return 4;
    return 5;
}

inline json op_route_kot(const json& payload) {
    if (!payload.contains("items") || !payload["items"].is_array()) {
        throw std::runtime_error("route_kot requires 'items' array");
    }

    std::string default_station_id = payload.value("default_station_id", "default_kitchen");
    std::map<std::string, std::string> station_names;
    if (payload.contains("stations") && payload["stations"].is_array()) {
        for (const auto& st : payload["stations"]) {
            std::string id = st.value("id", "");
            std::string name = st.value("name", "Kitchen");
            if (!id.empty()) station_names[id] = name;
        }
    }

    // Group items by station
    std::map<std::string, std::vector<json>> station_groups;

    for (const auto& item : payload["items"]) {
        std::string station_id = item.value("station_id", "");
        if (station_id.empty()) station_id = default_station_id;

        json item_copy = item;
        item_copy["course_priority"] = get_course_priority(item.value("course", "mains"));
        station_groups[station_id].push_back(item_copy);
    }

    json station_tickets = json::array();

    for (auto& [station_id, items] : station_groups) {
        // Sort items by course priority (FIFO inside course)
        std::stable_sort(items.begin(), items.end(), [](const json& a, const json& b) {
            return a["course_priority"].get<int>() < b["course_priority"].get<int>();
        });

        std::string st_name = station_names.count(station_id) ? station_names[station_id] : "Kitchen Station";

        station_tickets.push_back({
            {"station_id", station_id},
            {"station_name", st_name},
            {"item_count", items.size()},
            {"items", items}
        });
    }

    return json{
        {"tickets", station_tickets},
        {"total_stations", station_tickets.size()}
    };
}

} // namespace servebase
