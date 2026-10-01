#pragma once

#include <string>
#include <vector>
#include <map>
#include <cstdint>
#include <cmath>
#include "../vendor/json.hpp"

using json = nlohmann::json;

namespace servebase {

// Common response structure
struct WorkerResponse {
    std::string id;
    bool ok;
    json result;
    std::string error;

    json to_json() const {
        if (ok) {
            return json{
                {"id", id},
                {"ok", true},
                {"result", result}
            };
        } else {
            return json{
                {"id", id},
                {"ok", false},
                {"error", error}
            };
        }
    }
};

} // namespace servebase
