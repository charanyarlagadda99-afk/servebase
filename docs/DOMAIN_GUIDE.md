# ServeBase Hospitality Domain Guide

This document provides a comprehensive operational, legal, and financial reference manual for restaurant operators, controllers, and software engineers using or extending ServeBase.

---

## 1. Indian Goods and Services Tax (GST) for F&B Operations

### Statutory Framework
Under the Central Goods and Services Tax (CGST) Act, 2017, restaurant and food services in India operate under distinct tax classifications based on location, alcohol service, and room tariff thresholds:

| Establishment Type | Applicable Tax Rate | Composition of Rate | Input Tax Credit (ITC) Eligibility |
| :--- | :--- | :--- | :--- |
| **Standalone Restaurants (AC & Non-AC)** | **5% GST** | 2.5% CGST + 2.5% SGST | **No ITC permitted** on capital goods, rent, or raw ingredients. |
| **Restaurants in Hotel Premises (Tariff < ₹7,500/night)** | **5% GST** | 2.5% CGST + 2.5% SGST | **No ITC permitted**. |
| **Restaurants in Hotel Premises (Tariff ≥ ₹7,500/night)** | **18% GST** | 9.0% CGST + 9.0% SGST | **Full ITC permitted** on all business inputs and capital expenditure. |
| **Outdoor Catering Services** | **5% GST** | 2.5% CGST + 2.5% SGST | **No ITC permitted**. |
| **Composition Scheme Outlets (Turnover < ₹1.5 Cr)** | **5% Flat Turnover Tax** | 2.5% CGST + 2.5% SGST | No tax collected on invoice; no ITC permitted. |
| **Alcohol / Liquor for Human Consumption** | **State VAT** | Varies by State (15%–25%) | Exempt from GST; subject to State Excise and Value Added Tax. |

### HSN & SAC Classification
- **SAC 996331**: Services provided by restaurants, cafes, and room service.
- **SAC 996332**: Takeaway and online food delivery services.
- **SAC 996337**: Outdoor catering services.

---

## 2. Section 31 CGST Act: Tax Invoices & Sequential Numbering

### Statutory Mandate
Under Rule 46 of the CGST Rules, 2017, every tax invoice issued by a registered taxpayer must carry:
1. A **consecutive serial number**, not exceeding 16 characters, in one or multiple series, containing alphabets, numerals, and special characters (hyphen `/` and dash `-`), unique for each financial year.
2. Date of invoice issuance.
3. Name, address, and GSTIN of the supplier and recipient (if B2B).
4. Description of goods/services, HSN/SAC code, quantity, and total value.
5. Taxable value, tax rate, and separate amounts of CGST, SGST, IGST.

### Concurrency Protection in ServeBase
To ensure that gaps or duplicate invoice numbers never occur even during high-concurrency peak hours (e.g. 50 cashiers closing bills simultaneously across multiple terminals), ServeBase enforces **atomic row-level locking**:

```sql
-- Executed inside an atomic transaction
SELECT current_number 
FROM invoice_sequences 
WHERE outlet_id = $1 AND financial_year = $2 AND series_code = $3 
FOR UPDATE;

UPDATE invoice_sequences 
SET current_number = current_number + 1, updated_at = NOW() 
WHERE outlet_id = $1 AND financial_year = $2 AND series_code = $3 
RETURNING current_number;
```

Format template: `T{terminal_number}/{YY-YY}/{sequence_number_padded_5}`  
Example: `T1/26-27/00142`

---

## 3. Hamilton / Largest-Remainder Split-Billing Mathematics

### The Rounding Discrepancy Problem
When dividing a bill among $n$ diners, dividing the total paise $T$ by $n$ produces floating-point quotients with repeating fractions. Standard rounding (e.g. Round Half Up) frequently causes penny discrepancies:
- A bill of ₹100.00 (10,000 paise) split 3 ways:
  - $\frac{10000}{3} = 3333.333\dots$
  - Truncated or rounded: $3333 + 3333 + 3333 = 9999$ paise (1 paise missing).
  - Rounded up: $3334 + 3334 + 3334 = 10002$ paise (2 paise excess).
Either outcome violates accounting invariants where the sum of child invoices must exactly equal the master invoice.

### The Algorithm (Executed in Native C++)
ServeBase utilizes the **Hamilton / Largest-Remainder Method**:
1. Compute the integer base quotient for each share:
   $$q = \lfloor T / n \rfloor$$
2. Compute the total allocated base sum:
   $$\text{Allocated} = q \times n$$
3. Compute the unallocated remainder paise:
   $$R = T - \text{Allocated} \quad (0 \le R < n)$$
4. Sort the shares by their fractional remainder in descending order.
5. Allocate an additional 1 paise to the first $R$ shares.
6. Result: Every participant pays either $q$ or $q + 1$ paise, and:
   $$\sum_{i=1}^n \text{Share}_i \equiv T \quad \text{(Zero Penny Loss Guaranteed)}$$

---

## 4. Perpetual Inventory & Weighted Average Costing (WAC)

### WAC Formula
Whenever inward inventory is received via a Goods Receipt Note (GRN), the unit cost of that SKU is dynamically recalculated across the aggregate book stock:

$$\text{WAC}_{\text{new}} = \frac{(\text{Current Stock Qty} \times \text{Current WAC}) + (\text{Received Qty} \times \text{Landed Unit Cost})}{\text{Current Stock Qty} + \text{Received Qty}}$$

### Bill of Materials (BOM) Recipe Yield Explosion
Recipes in ServeBase link menu items to raw material inventory items. Each ingredient specification includes:
- **Net Quantity**: The quantity present in the finished dish.
- **Gross Quantity**: The raw quantity required before prep (cleaning, peeling, trimming, butchering).
- **Yield Percentage**:
  $$\text{Yield} = \frac{\text{Net Quantity}}{\text{Gross Quantity}} \times 100$$
  - *Example*: 1,000g of raw unpeeled onions yields 850g of diced onions for curry gravy ($\text{Yield} = 85\%$).
  - When a portion of Curry requiring 170g diced onion is sold, the inventory depletion engine automatically deducts:
    $$\text{Depletion} = \frac{170}{0.85} = 200\text{g of raw onion SKU}$$

---

## 5. Procurement 3-Way Match Verification

Before an Accounts Payable journal voucher can be posted for vendor payment, the procurement engine reconciles three documents:
1. **Purchase Order (PO)**: Authorized quantities and agreed unit prices.
2. **Goods Receipt Note (GRN)**: Quantities physically delivered, inspected, and accepted at the store receiving bay.
3. **Vendor Tax Invoice**: Quantities and amounts billed by the vendor.

### Tolerance Thresholds
- **Quantity Variance**: Deliveries within $\pm 2.0\%$ are accepted; excess is rejected or flagged.
- **Cost Variance**: Invoiced prices exceeding PO price by $> 0.5\%$ require mandatory Purchasing Manager authorization.

---

## 6. Indian Statutory Payroll Rules

ServeBase computes staff payroll according to Indian statutory labor laws:

### 1. Employees' Provident Funds (EPF) Act, 1952
- **Applicability**: Mandatory for establishments with 20 or more employees.
- **Wage Base**: Calculated on **Basic Wages** (typically structured as $50\%$ of Gross Salary).
- **Statutory Wage Ceiling**: ₹15,000 per month.
- **Deduction**: $12\%$ of Basic wage up to ₹15,000 ceiling. Maximum statutory employee deduction:
  $$\max \text{PF} = 15000 \times 12\% = \text{₹}1,800/\text{month}$$

### 2. Employees' State Insurance (ESI) Act, 1948
- **Applicability**: Mandatory for employees whose gross monthly wages do not exceed **₹21,000 per month**.
- **Deduction**: $0.75\%$ of gross salary from employee; $3.25\%$ contributed by employer.
- If Gross Salary $> \text{₹}21,000$, ESI deduction is zero.

### 3. State Professional Tax (PT)
- Deducted according to state-specific legislative slabs. In Karnataka, employees earning $\ge \text{₹}15,000$ per month are deducted a flat ₹200 per month.

### 4. Tax Deducted at Source (TDS)
- Withheld under Section 192 of the Income Tax Act based on annual estimated taxable income brackets.

---

## 7. Hotel PMS & Night Audit Operations

### Room Charge-to-Room Routing
Dine-in guests staying in the hotel can charge restaurant, bar, or room service bills directly to their room folio:
1. POS queries room status: Must be `occupied` and assigned to a registered guest folio.
2. Credit limit verification:
   $$\text{Current Folio Balance} + \text{New Charge} \le \text{Guest Credit Limit}$$
3. GST treatment: If the restaurant is within the hotel and room tariff $\ge \text{₹}7,500$, the charge is billed with $18\%$ GST with full ITC.

### Night Audit Key Performance Indicators (KPIs)
The Night Audit wizard seals the hotel day and computes standard hospitality metrics:
- **Occupancy Percentage**:
  $$\text{Occupancy Rate} = \left(\frac{\text{Rooms Sold}}{\text{Total Available Rooms}}\right) \times 100$$
- **Average Daily Rate (ADR)**:
  $$\text{ADR} = \frac{\text{Total Room Revenue}}{\text{Rooms Sold}}$$
- **Revenue Per Available Room (RevPAR)**:
  $$\text{RevPAR} = \frac{\text{Total Room Revenue}}{\text{Total Available Rooms}} = \text{ADR} \times \text{Occupancy Rate}$$

---

## 8. Menu Engineering: The Kasavana & Smith BCG Matrix

ServeBase evaluates restaurant menu performance using the Kasavana & Smith menu engineering model, plotting each menu item across two dimensions:
1. **Sales Volume (Popularity)**: High if item sales $\ge 70\%$ of average sales per item.
2. **Contribution Margin (Profitability)**: High if item gross margin $\ge$ weighted average category margin.

```
                  HIGH CONTRIBUTION MARGIN
                             |
             PUZZLES         |          STARS
        (Low Volume,         |     (High Volume,
         High Margin)        |      High Margin)
                             |
-----------------------------+-----------------------------
                             |
              DOGS           |       PLOWHORSES
        (Low Volume,         |     (High Volume,
         Low Margin)         |      Low Margin)
                             |
                   LOW CONTRIBUTION MARGIN
```

### Strategic Action Plan
- **Stars (High Margin, High Volume)**: Maintain consistent recipe quality, highlight visually on touch menus, protect raw ingredient supply chains.
- **Plowhorses (Low Margin, High Volume)**: Review ingredient portions, substitute components to lower COGS, or incrementally increase price.
- **Puzzles (High Margin, Low Volume)**: Rename, reposition, train service captains to upsell, or pair with popular beverages.
- **Dogs (Low Margin, Low Volume)**: Candidate for immediate removal during quarterly menu revamps.
