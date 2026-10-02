# ServeBase Regulatory & Statutory Compliance Notes

This document provides legal and regulatory notes on how ServeBase fulfills statutory requirements across Taxation, Labour Welfare, Corporate Audit Trail Mandates, and Food Safety standards.

---

## 1. Taxation Compliance: Central Goods and Services Tax (CGST) Act, 2017

### Rule 46 CGST Rules: Tax Invoice Specifications
ServeBase invoices strictly fulfill the statutory requirements mandated under Rule 46:
1. **Consecutive Serial Numbering**: Enforced via atomic database row-locks on `invoice_sequences` preventing duplicate or skipped numbers.
2. **Identification Details**: Includes Legal Name, Trade Name, Registered Address, and GSTIN of the operating entity.
3. **B2B Invoicing**: Captures recipient GSTIN, state code, and place of supply for corporate accounts.
4. **HSN/SAC Classification**: SAC 996331 is explicitly tagged on restaurant food services.
5. **Itemized Tax Breakdown**: CGST (2.5%), SGST (2.5%), and IGST (if interstate supply) are explicitly calculated and printed on separate ledger lines.

### Section 34 CGST Act: Credit Notes & Invoicing Rectifications
- In accordance with GST law, invoices once generated and closed cannot be arbitrarily deleted or modified.
- To cancel or adjust a billed invoice, ServeBase issues a **Credit Note** under Section 34 containing:
  - Distinct consecutive serial number.
  - Date of issue.
  - Original tax invoice reference number and date.
  - Taxable value, tax rate, and amount credited.
  - Reason for issuance (e.g. `BILL_CANCELLED_PRE_PREPARATION`, `ORDER_VOID_MANAGER_OVERRIDE`).

---

## 2. Corporate Governance: MCA Audit Trail Mandate (Rule 3(1))

### The Statutory Requirement
Under the **Companies (Accounts) Rules, 2014 (amended by the Ministry of Corporate Affairs, India)**, every company using accounting software must use software that features:
1. An **audit trail (edit log)** recording each and every transaction.
2. Logging of every change made in books of account along with the date and time when such changes were made.
3. Ensuring that the audit trail **cannot be disabled or manipulated**.

### ServeBase Cryptographic Solution
ServeBase implements an append-only **SHA-256 linear hash chain**:
- Any insert, update, or deletion to financial ledgers, bills, or inventory generates an immutable record in `audit_log`.
- Each record binds its sequence number, timestamp, actor ID, action type, and JSON payload to the previous record's hash:
  $$\text{Hash}_n = \text{SHA256}(\text{seq}_n \mathbin{\Vert} \text{Hash}_{n-1} \mathbin{\Vert} \text{timestamp} \mathbin{\Vert} \text{action} \mathbin{\Vert} \text{entity\_id} \mathbin{\Vert} \text{payload})$$
- Database triggers and role-based permissions deny `UPDATE` and `DELETE` queries on the `audit_log` table.
- A built-in scanner (`verifyAuditChain`) can be executed by corporate auditors at any time to verify 100% chain integrity.

---

## 3. Labour Law Compliance: Indian Statutory Payroll

### 1. Employees' Provident Funds and Miscellaneous Provisions Act, 1952
- **Deduction Ceiling**: Deductions are calculated on Basic Pay (50% of Gross).
- **Statutory Wage Ceiling**: The Act caps mandatory contributions at ₹15,000 per month.
- **Formula**:
  $$\text{PF Deduction} = \min(\text{Basic Wage}, 15000) \times 12\%$$
  $$\max \text{Employee Deduction} = \text{₹}1,800/\text{month}$$

### 2. Employees' State Insurance Act, 1948
- **Wage Threshold**: Applies only to employees with gross monthly wages up to **₹21,000 per month**.
- **Contribution**: Employee pays $0.75\%$; Employer contributes $3.25\%$.
- For employees earning $> \text{₹}21,000$, ESI deduction is systematically set to zero.

### 3. Payment of Wages Act, 1936
- Implements accurate time-tracking with a 15-minute grace period.
- Generates itemized monthly payslips detailing Gross Salary, Basic, HRA, PF, ESI, Professional Tax, TDS, and Net Payable.

---

## 4. Food Safety & Traceability: FSSAI Standards

### Batch & Supplier Traceability
Under the Food Safety and Standards (Licensing and Registration of Food Businesses) Regulations, 2011, ServeBase ensures traceability of perishable ingredients:
1. **Goods Receipt Note (GRN)**: Logs vendor name, invoice reference, delivery vehicle timestamp, and unit landing costs.
2. **First-In, First-Out (FIFO) Valuation**: Perpetual stock ledger records stock movements chronologically.
3. **Recipe Yields**: Standardizes portion control to prevent ingredient adulteration or unauthorized recipe deviations.
