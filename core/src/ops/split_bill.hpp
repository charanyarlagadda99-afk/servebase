#pragma once

#include "../types.hpp"
#include <numeric>
#include <algorithm>

namespace servebase {

inline std::vector<int64_t> allocate_by_largest_remainder(int64_t total_paise, const std::vector<double>& weights) {
    size_t n = weights.size();
    if (n == 0) return {};
    if (n == 1) return {total_paise};

    double sum_weights = 0.0;
    for (double w : weights) sum_weights += w;
    if (sum_weights <= 0.0) {
        sum_weights = static_cast<double>(n);
    }

    std::vector<int64_t> result(n, 0);
    std::vector<std::pair<double, size_t>> remainders;
    remainders.reserve(n);

    int64_t allocated_sum = 0;
    for (size_t i = 0; i < n; ++i) {
        double exact = (weights[i] / sum_weights) * total_paise;
        int64_t floor_val = static_cast<int64_t>(std::floor(exact));
        double remainder = exact - floor_val;
        result[i] = floor_val;
        allocated_sum += floor_val;
        remainders.push_back({remainder, i});
    }

    int64_t diff = total_paise - allocated_sum;
    // Sort remainders descending
    std::sort(remainders.begin(), remainders.end(), [](const auto& a, const auto& b) {
        return a.first > b.first;
    });

    for (int64_t i = 0; i < diff && i < static_cast<int64_t>(n); ++i) {
        result[remainders[i].second] += 1;
    }

    return result;
}

inline json op_split_bill(const json& payload) {
    if (!payload.contains("bill")) {
        throw std::runtime_error("split_bill requires 'bill' object");
    }

    const auto& bill = payload["bill"];
    std::string split_type = payload.value("split_type", "equal"); // "equal", "by_amount", "by_item"
    int num_parts = payload.value("num_parts", 2);

    int64_t total_paise = bill.value("total_paise", 0LL);
    int64_t subtotal_paise = bill.value("subtotal_paise", 0LL);
    int64_t item_discount_paise = bill.value("item_discount_paise", 0LL);
    int64_t bill_discount_paise = bill.value("bill_discount_paise", 0LL);
    int64_t taxable_value_paise = bill.value("taxable_value_paise", 0LL);
    int64_t cgst_paise = bill.value("cgst_paise", 0LL);
    int64_t sgst_paise = bill.value("sgst_paise", 0LL);
    int64_t igst_paise = bill.value("igst_paise", 0LL);
    int64_t service_charge_paise = bill.value("service_charge_paise", 0LL);
    int64_t tip_paise = bill.value("tip_paise", 0LL);
    int64_t round_off_paise = bill.value("round_off_paise", 0LL);

    std::vector<double> weights;

    if (split_type == "equal") {
        if (num_parts < 1) num_parts = 1;
        weights.assign(num_parts, 1.0);
    } else if (split_type == "by_amount" && payload.contains("target_amounts") && payload["target_amounts"].is_array()) {
        for (const auto& a : payload["target_amounts"]) {
            weights.push_back(a.get<double>());
        }
        num_parts = static_cast<int>(weights.size());
    } else {
        if (num_parts < 1) num_parts = 1;
        weights.assign(num_parts, 1.0);
    }

    auto split_totals = allocate_by_largest_remainder(total_paise, weights);
    auto split_subtotals = allocate_by_largest_remainder(subtotal_paise, weights);
    auto split_item_disc = allocate_by_largest_remainder(item_discount_paise, weights);
    auto split_bill_disc = allocate_by_largest_remainder(bill_discount_paise, weights);
    auto split_taxables = allocate_by_largest_remainder(taxable_value_paise, weights);
    auto split_cgst = allocate_by_largest_remainder(cgst_paise, weights);
    auto split_sgst = allocate_by_largest_remainder(sgst_paise, weights);
    auto split_igst = allocate_by_largest_remainder(igst_paise, weights);
    auto split_service = allocate_by_largest_remainder(service_charge_paise, weights);
    auto split_tips = allocate_by_largest_remainder(tip_paise, weights);
    auto split_roundoff = allocate_by_largest_remainder(round_off_paise, weights);

    json splits = json::array();
    for (size_t i = 0; i < static_cast<size_t>(num_parts); ++i) {
        splits.push_back({
            {"split_index", i + 1},
            {"subtotal_paise", split_subtotals[i]},
            {"item_discount_paise", split_item_disc[i]},
            {"bill_discount_paise", split_bill_disc[i]},
            {"taxable_value_paise", split_taxables[i]},
            {"cgst_paise", split_cgst[i]},
            {"sgst_paise", split_sgst[i]},
            {"igst_paise", split_igst[i]},
            {"service_charge_paise", split_service[i]},
            {"tip_paise", split_tips[i]},
            {"round_off_paise", split_roundoff[i]},
            {"total_paise", split_totals[i]}
        });
    }

    return json{
        {"split_type", split_type},
        {"num_parts", num_parts},
        {"master_total_paise", total_paise},
        {"splits", splits}
    };
}

} // namespace servebase
