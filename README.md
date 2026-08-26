# CREDNIVO Frontend — Phase 2.3

Fresh React + Vite frontend for the CREDNIVO finance management platform.

## Phase 2.3 updates

- Moved **Quick Actions** to the top of the Overview page.
- Rebuilt **New Customer** as a 3-step flow: Customer → Jamin → Loan.
- Customer Details now include Name, Mobile, Father’s Name, Date, Work and Address.
- Customer photo supports Camera / Files and becomes the profile photo; tap/click it to view full size.
- Customer document supports image/photo or PDF from Camera / Files.
- Customer Save opens a review popup with the generated Customer ID before moving to Jamin.
- Customer details are saved to frontend localStorage after confirmation, even before the loan step is completed.
- Jamin Details now include Name, Mobile, Father’s Name, Work and Address plus profile photo and document upload.
- Jamin Save opens a review popup before moving to Loan.
- Loan duration is now manual for Daily / Weekly / Monthly and both EMI / IO.
- Loan setup includes Loan Amount, Cycle, Loan Type, Interest %, Duration, Disbursed Date and Interest Taken Yes/No.
- Automatic calculation shows Required Amount, Interest Amount, Given Amount, Collection/Cycle, Total Repayment and Duration.
- Add Loan opens a final review popup showing Loan ID, loan amount, pay schedule, interest and collection/cycle.
- Weekly loan summary shows the collection weekday; Monthly summary shows the pay date.
- Existing-customer **Create Loan** uses the same manual duration and loan review popup.
- Customer Details page now displays the new Customer/Jamin fields, profile photos, documents and expanded loan details.

## Phase 2.2 features retained

- Standardized Lucide icon alignment across cards, buttons, tables and mobile views.
- Collection summary cards always show today's overall totals and no longer change when searching/filtering the list.
- Explicit Unpaid collection status/filter, Pending Today amount and Unpaid Entries count.
- Customer and Loan summary cards remain fixed while using search.
- Payment History From/To date controls, Today/Clear actions, Print/PDF and Download CSV.
- Expenses summary uses Today's Expenses + Overall Expenses and Expense History displays Created By.

## Existing modules

- Responsive Overview dashboard
- Customers: All / Daily / Weekly / Monthly
- Customer profile with loans and payment history
- Loans and Create Loan
- Collections with full / partial / over-payment and separate fine field
- Payments / cash-flow history
- Expenses with Add / Edit / Delete
- Reports + CSV export + Print/PDF
- Mobile Today's Report with download
- Agents
- Documents
- Settings / company profile
- Browser localStorage persistence for frontend testing

## Mobile navigation

Fixed iconic bottom bar:

**Home · Expenses · New Customer · Collections · Report**

The New Customer action is raised in the center for quick field use.

## Run

```powershell
npm install
npm run dev
```

Then open the Vite address, normally `http://localhost:5173`.

## Important

This phase is still frontend-only. Customer photos/documents and test data are kept in browser localStorage for frontend testing. Spring Boot/API/database integration comes later.

## Phase 2.5
Customer Profile desktop layout readability improved: centered max-width content, larger profile summary, larger detail text/media tiles, and more readable loan/payment tables while keeping the mobile card layout from Phase 2.4.

Phase 2.8 update: Added Pay button with direct payment modal to Today's Collection on Overview (desktop + mobile).

## Phase 2.9 update
- Customer Profile > Loan Details now uses compact card layout on desktop and mobile (no wide horizontal loan table).
- Each active loan card has a Pay button.
- Loan-level payment popup supports partial payments, overpayments, and separate fine entry.
- Loan payment updates loan outstanding, customer totals, collection entry when present, and payment history.

## Phase 2.10 updates
- Overview Today's Collection now keeps Daily/Weekly/Monthly as unpaid work queues.
- Fully paid entries automatically move to a new **Collected Today** tab.
- Partial payments remain in the original cycle tab and show the remaining amount.
- Create Loan now includes customer search by Customer ID, name, or mobile.
- Added **New Customer** beside **Add Loan** in the Create Loan header and calculation actions.


## Phase 2.11 Settings
- Settings now contains only App Theme and App Language.
- Theme choices: Light, Dark, System Default (follows device preference live).
- Language choices: English and Tamil; preference is persisted locally and sets the document language.

## Phase 2.13 update
- Removed repeated page titles from the global header.
- Module pages now use `Business Workspace` in the top app header, while the page content keeps the actual title such as Collections, Loans, Expenses, Reports, etc.
- Overview keeps its own `Overview` header because the dashboard content does not repeat that title.

## Phase 2.14 – Monthly Reports
Reports now default to a month-based business report with Daily/Weekly/Monthly/Overall collection totals, customer/loan counts, finance summary, cycle performance, collection trend, activity, pending/overdue recovery, month selection, Print/PDF and CSV export.

## Phase 2.17 - Professional Monthly Report
The Reports page is now presented as a professional business statement rather than a dashboard-style screen. It includes a branded report header, collection summary, customer/loan portfolio, monthly finance statement, cycle performance, collection trend, monthly activity and recovery position. The dedicated Download PDF button and jsPDF dependencies were removed. Use **Print Report** for a clean A4 print/save-to-PDF layout, or **Download CSV** for raw data.

## Phase 2.21 - Capital Management
CREDNIVO now includes a separate Capital module for business investment, partner contributions and capital withdrawals. Capital is intentionally kept separate from customer Payments. Available Capital is calculated from net capital + collections received - loan amounts disbursed - expenses, and monthly capital figures are included in Reports.
