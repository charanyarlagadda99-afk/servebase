# ServeBase Product Demonstration Walkthrough

This script provides a complete end-to-end walkthrough demonstrating all 12 operational modules of ServeBase. It can be executed live using the web touch interface (`http://localhost:5173`) or via backend API test scripts.

---

## Scene 1: Table Seating & Course-Timed Order Intake (POS)
1. **Navigate to the POS Module**:
   - The screen displays the table floor plan across three sections: **Main Dining**, **Outdoor Terrace**, and **Private Dining**.
   - Note the status indicators: Vacant (Green), Occupied (Terracotta), Billed (Amber), Reserved (Purple).
2. **Select Table `T-01` (Main Dining)**:
   - Click on Table `T-01`. The view transitions to the Touch Menu Catalog.
   - The right sidebar displays the order ticket for `T-01` with Server and GST details.
3. **Add Starters & Mains with Course Controls**:
   - Click the **Starters** category. Tap **Paneer Tikka Angaarey** (₹380.00). Notice it defaults to course status `FIRE`.
   - Toggle the active course bar to **Main**.
   - Tap **Butter Chicken Grand Trunk** (₹540.00) and **Tandoori Garlic Butter Naan** (2x, ₹110.00 each). Notice they default to course status `HOLD`.
4. **Dispatch KOT**:
   - Click **Send KOT**.
   - The native C++ engine routes the order: Paneer Tikka and Naan route to the **Tandoor** station, while Butter Chicken routes to the **Curry** station.
   - Table `T-01` turns Terracotta (`OCCUPIED`) on the floor plan.

---

## Scene 2: Multi-Station Kitchen Display System (KDS)
1. **Switch to Kitchen KDS Tab**:
   - The KDS displays active KOT tickets ordered chronologically with live elapsed preparation timers.
2. **Filter by Station**:
   - Click **Tandoor & Grill**: See the ticket for Table `T-01` containing Paneer Tikka (marked `FIRE`) and Garlic Naan.
   - Click **Main Curry Range**: See the ticket for Table `T-01` containing Butter Chicken (marked `HOLD`).
   - Click **Expediter Pass**: View consolidated item totals across all open tickets (e.g. *1x Paneer Tikka, 2x Garlic Naan, 1x Butter Chicken*).
3. **Bump Items & Tickets**:
   - On the Tandoor ticket, tap **Paneer Tikka Angaarey**. Its status toggles to `preparing` (orange), then `ready` (green strikethrough).
   - Click **Bump KOT**: The ticket clears from the station queue with an audio confirmation.
4. **Recall a Bumped Ticket**:
   - Click **Recall (Recent)**: The bumped ticket appears in the archive view.
   - Click **Recall to Station**: The ticket restores to the active queue.

---

## Scene 3: Hamilton Split-Billing & Split-Tender Payment
1. **Return to POS Tab & Select Table `T-02`**:
   - Table `T-02` is currently occupied with a total bill of ₹1,450.00.
2. **Execute Largest-Remainder Split Bill**:
   - Click **Split Bill**.
   - Select **3 Ways**.
   - Notice the calculation: ₹1,450.00 divided by 3 creates two shares of ₹483.33 and one share of ₹483.34. The native C++ Hamilton algorithm ensures the sum equals exactly ₹1,450.00 with zero penny loss.
   - Click **Apply Split**.
3. **Settle via Multiple Tenders**:
   - Click **Settle / Pay**.
   - Tender options appear: UPI / QR Code, Credit Card, Cash, and Hotel Room Folio.
   - Select **UPI / QR Code**. Click **Confirm Settlement**.
   - The invoice is generated in strict sequence (`T1/26-27/00143`), stock depletions are posted, and Table `T-02` returns to `VACANT` (Green).

---

## Scene 4: Perpetual Stock Ledger, WAC & 3-Way Match
1. **Switch to Stock & Recipe Tab**:
   - The table shows real-time stock levels, par levels, Weighted Average Cost (WAC), and current book valuation.
   - Notice the status badge on **Fresh Chicken Breast**: *Below Par (8.5 kg / Par 25.0 kg)*.
2. **Receive Inward Goods (GRN)**:
   - Click **Receive Goods (GRN)**.
   - Select SKU `RAW-MEAT-01 (Fresh Chicken Breast)`.
   - Enter Quantity: `20 kg`, Landed Unit Cost: `₹265.00/kg`.
   - Click **Post GRN**.
   - Observe that the current stock updates to 28.5 kg and the WAC dynamically recalculates across the total weighted quantity.
3. **Review 3-Way Match Audit**:
   - Click **3-Way Match**.
   - Review cross-validation between Purchase Order `PO-202610-0012`, Goods Receipt Note, and Vendor Invoice: All items match with 0.0% variance.

---

## Scene 5: Biometric/PIN Time Clock & Indian Statutory Payroll
1. **Switch to Staff & Payroll Tab**:
   - The Roster view lists employees, roles, clock-in status, and active punch timestamps.
2. **Simulate Cashier Clock-Out**:
   - On Priya Patel's record, click **Clock Out**.
   - The PIN entry modal appears. Enter PIN `1234` and tap **Punch**.
   - The record transitions to *OFF DUTY* with the exact punch timestamp recorded.
3. **Review Monthly Statutory Payroll**:
   - Click the **Monthly Statutory Payroll** sub-tab.
   - Review the C++ engine calculation:
     - Basic Pay is calculated at 50% of Gross.
     - EPF (12%) is deducted and capped at the ₹15,000 statutory wage ceiling (₹1,800 max).
     - ESI (0.75%) is applied only to eligible employees earning $\le$ ₹21,000.
     - Professional Tax (PT) is deducted at flat ₹200.
     - Net Payable salary is computed with zero arithmetic rounding drift.

---

## Scene 6: Hotel PMS Room Folios & Night Audit Wizard
1. **Switch to Hotel PMS Tab**:
   - The room inventory grid displays 20 rooms across Deluxe, Suite, and Executive types with clean/dirty status and current folio balances.
2. **Post In-Room Dining Charge to Room 101**:
   - Room 101 is occupied by guest *Siddharth Malhotra*.
   - Click **+ Post F&B**.
   - Enter description: `In-Room Dining: Awadhi Dum Biryani`, Amount: `₹520.00`.
   - Click **Post to Folio**.
   - Notice Room 101's folio balance updates immediately. A security alert is broadcast to the terminal.
3. **Execute Hotel Night Audit**:
   - Click **Run Night Audit**.
   - The Night Audit wizard computes key hotel KPIs:
     - **Occupancy %**: Total sold rooms vs inventory.
     - **ADR (Average Daily Rate)**: Room revenue divided by rooms sold.
     - **RevPAR (Revenue Per Available Room)**: ADR multiplied by Occupancy Rate.
   - Click **Execute Night Audit**: Room charges and 12% GST post to all guest folios, and the hotel date rolls over.

---

## Scene 7: Double-Entry Financials, SHA-256 Audit Trail & Day Close
1. **Switch to Financials & Close Tab**:
2. **Inspect Double-Entry Flash P&L**:
   - Click **Flash P&L & Ledger**.
   - Review Operating Revenue, Cost of Goods Sold (31.5%), Operating Expenses, and Net EBITDA.
   - Notice the status badge: **Trial Balance: Balanced (₹0.00 Diff)** confirming `Total Debits == Total Credits`.
3. **Verify Cryptographic Audit Hash-Chain**:
   - Click **SHA-256 Audit Log**.
   - Inspect the sequence of records. Each entry displays its document reference, event type, cryptographic SHA-256 hash, and previous entry hash.
   - The badge confirms **Chain Integrity Verified (No Gaps)**.
4. **Execute Z-Report Day Close**:
   - Click **Z-Report Day Close**.
   - Verify that gross sales, taxes, discounts, and tender breakdown (UPI, Card, Cash, Room) match exactly.
   - Click **Execute Day Close & Print Z-Report**.
   - The shift registers are sealed, all ledger journals are locked, and the business date advances to `2026-10-03`.
