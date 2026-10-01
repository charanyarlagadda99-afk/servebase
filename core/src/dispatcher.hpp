#pragma once

#include "types.hpp"
#include "ops/price_bill.hpp"
#include "ops/split_bill.hpp"
#include "ops/route_kot.hpp"
#include "ops/explode_recipe.hpp"
#include "ops/compute_variance.hpp"
#include "ops/compute_payroll.hpp"
#include "ops/aggregate_sales.hpp"
#include "ops/reconcile_shift.hpp"
#include "ops/menu_engineering.hpp"
#include "ops/forecast_par.hpp"

namespace servebase {

inline WorkerResponse dispatch(const json& request) {
    WorkerResponse resp;
    resp.id = request.value("id", "0");
    resp.ok = false;

    if (!request.contains("op") || !request["op"].is_string()) {
        resp.error = "Missing or invalid 'op' string in request";
        return resp;
    }

    std::string op = request["op"].get<std::string>();
    json payload = request.value("payload", json::object());

    try {
        if (op == "price_bill") {
            resp.result = op_price_bill(payload);
            resp.ok = true;
        } else if (op == "split_bill") {
            resp.result = op_split_bill(payload);
            resp.ok = true;
        } else if (op == "route_kot") {
            resp.result = op_route_kot(payload);
            resp.ok = true;
        } else if (op == "explode_recipe") {
            resp.result = op_explode_recipe(payload);
            resp.ok = true;
        } else if (op == "compute_variance") {
            resp.result = op_compute_variance(payload);
            resp.ok = true;
        } else if (op == "compute_payroll") {
            resp.result = op_compute_payroll(payload);
            resp.ok = true;
        } else if (op == "aggregate_sales") {
            resp.result = op_aggregate_sales(payload);
            resp.ok = true;
        } else if (op == "reconcile_shift") {
            resp.result = op_reconcile_shift(payload);
            resp.ok = true;
        } else if (op == "menu_engineering") {
            resp.result = op_menu_engineering(payload);
            resp.ok = true;
        } else if (op == "forecast_par") {
            resp.result = op_forecast_par(payload);
            resp.ok = true;
        } else {
            resp.error = "Unknown op: " + op;
        }
    } catch (const std::exception& ex) {
        resp.ok = false;
        resp.error = std::string("Operation error: ") + ex.what();
    } catch (...) {
        resp.ok = false;
        resp.error = "Unknown internal C++ exception";
    }

    return resp;
}

} // namespace servebase
