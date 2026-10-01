#pragma once

#include "../types.hpp"
#include <map>

namespace servebase {

inline json op_reconcile_shift(const json& payload) {
    int64_t opening_float_paise = payload.value("opening_float_paise", 0LL);
    int64_t cash_sales_paise = payload.value("cash_sales_paise", 0LL);
    int64_t paid_ins_paise = payload.value("paid_ins_paise", 0LL);
    int64_t paid_outs_paise = payload.value("paid_outs_paise", 0LL);
    int64_t cash_drops_paise = payload.value("cash_drops_paise", 0LL);
    int64_t actual_cash_counted_paise = payload.value("actual_cash_counted_paise", 0LL);

    // Calculate total from denominations if provided
    int64_t denom_total_paise = 0;
    if (payload.contains("denominations") && payload["denominations"].is_object()) {
        for (auto& [denom_str, count_val] : payload["denominations"].items()) {
            int64_t denom_rupee = std::stoll(denom_str);
            int64_t count = count_val.get<int64_t>();
            denom_total_paise += (denom_rupee * 100LL) * count;
        }
        // If actual_cash_counted was 0, use denomination count total
        if (actual_cash_counted_paise == 0 && denom_total_paise > 0) {
            actual_cash_counted_paise = denom_total_paise;
        }
    }

    int64_t expected_cash_paise = opening_float_paise + cash_sales_paise + paid_ins_paise - paid_outs_paise - cash_drops_paise;
    int64_t over_short_paise = actual_cash_counted_paise - expected_cash_paise;

    std::string status = "balanced";
    if (over_short_paise > 0) {
        status = "over";
    } else if (over_short_paise < 0) {
        status = "short";
    }

    return json{
        {"opening_float_paise", opening_float_paise},
        {"cash_sales_paise", cash_sales_paise},
        {"paid_ins_paise", paid_ins_paise},
        {"paid_outs_paise", paid_outs_paise},
        {"cash_drops_paise", cash_drops_paise},
        {"expected_cash_paise", expected_cash_paise},
        {"actual_cash_paise", actual_cash_counted_paise},
        {"over_short_paise", over_short_paise},
        {"status", status},
        {"is_balanced", over_short_paise == 0},
        {"denomination_total_paise", denom_total_paise}
    };
}

} // namespace servebase
