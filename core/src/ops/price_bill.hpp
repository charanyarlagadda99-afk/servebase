#pragma once

#include "../types.hpp"

namespace servebase {

struct BillItemInput {
    std::string item_id;
    std::string name;
    int quantity;
    int64_t unit_price_paise;
    double tax_rate_percent;
    std::string sac_code;
    bool is_complimentary;
    int64_t discount_paise;
};

struct BillPricingResult {
    int64_t subtotal_paise = 0;
    int64_t item_discount_paise = 0;
    int64_t bill_discount_paise = 0;
    int64_t taxable_value_paise = 0;
    int64_t cgst_paise = 0;
    int64_t sgst_paise = 0;
    int64_t igst_paise = 0;
    int64_t service_charge_paise = 0;
    int64_t tip_paise = 0;
    int64_t round_off_paise = 0;
    int64_t total_paise = 0;
    json priced_items = json::array();
};

inline json op_price_bill(const json& payload) {
    std::string tax_mode = payload.value("tax_mode", "no_itc_5"); // "no_itc_5", "itc_18", "composition"
    bool is_inter_state = payload.value("is_inter_state", false);
    bool price_tax_inclusive = payload.value("price_tax_inclusive", false);
    double service_charge_percent = payload.value("service_charge_percent", 0.0);
    bool service_charge_enabled = payload.value("service_charge_enabled", false);
    int64_t tip_paise = payload.value("tip_paise", 0LL);
    std::string rounding_rule = payload.value("rounding_rule", "nearest_rupee");

    // Bill-level discount
    double bill_discount_percent = payload.value("bill_discount_percent", 0.0);
    int64_t bill_discount_flat_paise = payload.value("bill_discount_flat_paise", 0LL);

    BillPricingResult result;
    result.tip_paise = tip_paise;

    std::vector<BillItemInput> items;
    if (payload.contains("items") && payload["items"].is_array()) {
        for (const auto& item_json : payload["items"]) {
            BillItemInput item;
            item.item_id = item_json.value("item_id", "");
            item.name = item_json.value("name", "");
            item.quantity = item_json.value("quantity", 1);
            item.unit_price_paise = item_json.value("unit_price_paise", 0LL);
            item.tax_rate_percent = item_json.value("tax_rate_percent", 5.0);
            item.sac_code = item_json.value("sac_code", "996331");
            item.is_complimentary = item_json.value("is_complimentary", false);
            item.discount_paise = item_json.value("discount_paise", 0LL);

            if (tax_mode == "composition") {
                item.tax_rate_percent = 0.0;
            } else if (tax_mode == "no_itc_5") {
                item.tax_rate_percent = 5.0;
            } else if (tax_mode == "itc_18") {
                item.tax_rate_percent = 18.0;
            }

            items.push_back(item);
        }
    }

    // Step 1: Compute subtotal and item-level lines
    int64_t gross_subtotal = 0;
    int64_t total_item_discount = 0;

    for (const auto& item : items) {
        int64_t line_gross = 0;
        if (!item.is_complimentary) {
            line_gross = item.quantity * item.unit_price_paise;
        }
        gross_subtotal += line_gross;
        total_item_discount += item.discount_paise;
    }

    result.subtotal_paise = gross_subtotal;
    result.item_discount_paise = total_item_discount;

    // Step 2: Compute Bill-level discount
    int64_t pre_discount_subtotal = std::max(0LL, gross_subtotal - total_item_discount);
    int64_t total_bill_discount = 0;
    if (bill_discount_percent > 0.0) {
        total_bill_discount += static_cast<int64_t>(std::round(pre_discount_subtotal * (bill_discount_percent / 100.0)));
    }
    if (bill_discount_flat_paise > 0) {
        total_bill_discount += bill_discount_flat_paise;
    }
    // Cap discount at subtotal
    total_bill_discount = std::min(total_bill_discount, pre_discount_subtotal);
    result.bill_discount_paise = total_bill_discount;

    // Step 3: Allocate bill discount proportionally across items and calculate tax
    int64_t remaining_bill_discount = total_bill_discount;
    int64_t running_taxable = 0;
    int64_t running_cgst = 0;
    int64_t running_sgst = 0;
    int64_t running_igst = 0;

    for (size_t i = 0; i < items.size(); ++i) {
        const auto& item = items[i];
        int64_t line_gross = item.is_complimentary ? 0LL : (item.quantity * item.unit_price_paise);
        int64_t line_net_item = std::max(0LL, line_gross - item.discount_paise);

        // Allocate bill discount
        int64_t allocated_bill_discount = 0;
        if (pre_discount_subtotal > 0 && total_bill_discount > 0) {
            if (i == items.size() - 1) {
                allocated_bill_discount = remaining_bill_discount;
            } else {
                allocated_bill_discount = static_cast<int64_t>(std::round((static_cast<double>(line_net_item) / pre_discount_subtotal) * total_bill_discount));
                allocated_bill_discount = std::min(allocated_bill_discount, remaining_bill_discount);
                remaining_bill_discount -= allocated_bill_discount;
            }
        }

        int64_t line_taxable = std::max(0LL, line_net_item - allocated_bill_discount);
        int64_t line_cgst = 0;
        int64_t line_sgst = 0;
        int64_t line_igst = 0;

        if (tax_mode != "composition" && item.tax_rate_percent > 0.0) {
            if (is_inter_state) {
                line_igst = static_cast<int64_t>(std::round(line_taxable * (item.tax_rate_percent / 100.0)));
            } else {
                double half_rate = item.tax_rate_percent / 2.0;
                line_cgst = static_cast<int64_t>(std::round(line_taxable * (half_rate / 100.0)));
                line_sgst = line_cgst; // CGST and SGST are always identical
            }
        }

        running_taxable += line_taxable;
        running_cgst += line_cgst;
        running_sgst += line_sgst;
        running_igst += line_igst;

        int64_t line_total = line_taxable + line_cgst + line_sgst + line_igst;

        result.priced_items.push_back({
            {"item_id", item.item_id},
            {"name", item.name},
            {"quantity", item.quantity},
            {"unit_price_paise", item.unit_price_paise},
            {"gross_paise", line_gross},
            {"item_discount_paise", item.discount_paise},
            {"allocated_bill_discount_paise", allocated_bill_discount},
            {"taxable_value_paise", line_taxable},
            {"tax_rate_percent", item.tax_rate_percent},
            {"sac_code", item.sac_code},
            {"cgst_paise", line_cgst},
            {"sgst_paise", line_sgst},
            {"igst_paise", line_igst},
            {"total_paise", line_total},
            {"is_complimentary", item.is_complimentary}
        });
    }

    result.taxable_value_paise = running_taxable;
    result.cgst_paise = running_cgst;
    result.sgst_paise = running_sgst;
    result.igst_paise = running_igst;

    // Step 4: Voluntary service charge (NEVER taxed, on pre-tax taxable amount)
    if (service_charge_enabled && service_charge_percent > 0.0) {
        result.service_charge_paise = static_cast<int64_t>(std::round(running_taxable * (service_charge_percent / 100.0)));
    } else {
        result.service_charge_paise = 0LL;
    }

    // Step 5: Raw total before rounding
    int64_t raw_total = running_taxable + running_cgst + running_sgst + running_igst + result.service_charge_paise + result.tip_paise;

    // Step 6: Rounding rule (nearest rupee = nearest 100 paise)
    int64_t rounded_total = raw_total;
    if (rounding_rule == "nearest_rupee") {
        int64_t remainder = raw_total % 100;
        if (remainder >= 50) {
            rounded_total = raw_total + (100 - remainder);
        } else if (remainder > 0) {
            rounded_total = raw_total - remainder;
        }
    }
    result.round_off_paise = rounded_total - raw_total;
    result.total_paise = rounded_total;

    return json{
        {"subtotal_paise", result.subtotal_paise},
        {"item_discount_paise", result.item_discount_paise},
        {"bill_discount_paise", result.bill_discount_paise},
        {"taxable_value_paise", result.taxable_value_paise},
        {"cgst_paise", result.cgst_paise},
        {"sgst_paise", result.sgst_paise},
        {"igst_paise", result.igst_paise},
        {"service_charge_paise", result.service_charge_paise},
        {"tip_paise", result.tip_paise},
        {"round_off_paise", result.round_off_paise},
        {"total_paise", result.total_paise},
        {"items", result.priced_items}
    };
}

} // namespace servebase
