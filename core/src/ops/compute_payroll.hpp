#pragma once

#include "../types.hpp"
#include <algorithm>

namespace servebase {

inline json op_compute_payroll(const json& payload) {
    if (!payload.contains("employees") || !payload["employees"].is_array()) {
        throw std::runtime_error("compute_payroll requires 'employees' array");
    }

    // Configurable statutory rates (default empty/zero until configured)
    double pf_rate_pct = payload.value("pf_rate_percent", 0.0);
    double esi_rate_pct = payload.value("esi_rate_percent", 0.0);
    int64_t pt_flat_paise = payload.value("pt_flat_paise", 0LL);
    double tds_rate_pct = payload.value("tds_rate_percent", 0.0);

    json payslips = json::array();
    int64_t total_gross_paise = 0;
    int64_t total_deductions_paise = 0;
    int64_t total_net_paise = 0;

    for (const auto& emp : payload["employees"]) {
        std::string emp_id = emp.value("employee_id", "");
        std::string salary_type = emp.value("salary_type", "monthly");
        int64_t base_rate_paise = emp.value("base_rate_paise", 0LL);
        double scheduled_hours = emp.value("scheduled_hours", 200.0);
        double worked_hours = emp.value("worked_hours", 200.0);
        double overtime_hours = emp.value("overtime_hours", 0.0);
        int64_t late_deduction_paise = emp.value("late_deduction_paise", 0LL);
        int64_t advances_recovery_paise = emp.value("advances_recovery_paise", 0LL);

        int64_t gross_paise = 0;
        if (salary_type == "monthly") {
            // Prorate for attendance
            if (scheduled_hours > 0 && worked_hours < scheduled_hours) {
                gross_paise = static_cast<int64_t>(std::round((worked_hours / scheduled_hours) * base_rate_paise));
            } else {
                gross_paise = base_rate_paise;
            }
            // Overtime for monthly if applicable (hourly equivalent * 1.5)
            if (overtime_hours > 0 && scheduled_hours > 0) {
                double hourly_equiv = static_cast<double>(base_rate_paise) / scheduled_hours;
                gross_paise += static_cast<int64_t>(std::round(overtime_hours * hourly_equiv * 1.5));
            }
        } else { // "hourly"
            gross_paise = static_cast<int64_t>(std::round(worked_hours * base_rate_paise));
            if (overtime_hours > 0) {
                gross_paise += static_cast<int64_t>(std::round(overtime_hours * base_rate_paise * 1.5));
            }
        }

        // Apply late deduction from gross
        gross_paise = std::max<int64_t>(0, gross_paise - late_deduction_paise);

        // Deductions
        int64_t pf_paise = 0;
        if (pf_rate_pct > 0.0) {
            pf_paise = static_cast<int64_t>(std::round(gross_paise * (pf_rate_pct / 100.0)));
        }

        int64_t esi_paise = 0;
        if (esi_rate_pct > 0.0) {
            esi_paise = static_cast<int64_t>(std::round(gross_paise * (esi_rate_pct / 100.0)));
        }

        int64_t pt_paise = pt_flat_paise;

        int64_t tds_paise = 0;
        if (tds_rate_pct > 0.0) {
            tds_paise = static_cast<int64_t>(std::round(gross_paise * (tds_rate_pct / 100.0)));
        }

        int64_t emp_deductions = pf_paise + esi_paise + pt_paise + tds_paise + advances_recovery_paise;
        emp_deductions = std::min(emp_deductions, gross_paise); // Cannot deduct more than earned

        int64_t net_paise = gross_paise - emp_deductions;

        total_gross_paise += gross_paise;
        total_deductions_paise += emp_deductions;
        total_net_paise += net_paise;

        payslips.push_back({
            {"employee_id", emp_id},
            {"salary_type", salary_type},
            {"gross_paise", gross_paise},
            {"pf_deduction_paise", pf_paise},
            {"esi_deduction_paise", esi_paise},
            {"pt_deduction_paise", pt_paise},
            {"tds_deduction_paise", tds_paise},
            {"advances_recovery_paise", advances_recovery_paise},
            {"total_deductions_paise", emp_deductions},
            {"net_paise", net_paise}
        });
    }

    return json{
        {"total_gross_paise", total_gross_paise},
        {"total_deductions_paise", total_deductions_paise},
        {"total_net_paise", total_net_paise},
        {"payslips", payslips}
    };
}

} // namespace servebase
