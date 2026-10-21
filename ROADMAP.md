# Roadmap

## Bugs

- [x] **Next Billing list incomplete** — Fixed: was filtering out `cancelled` contracts that still have active billing. Now shows all non-expired contracts with a next billing date.

## Improvements

- [x] **Reuse uploaded logos** — New "Recent" tab in the icon chooser dialog shows all previously used icons for quick selection.
- [x] **Redirect to homepage after contract creation** — Now navigates to `/` instead of the contract detail page.
- [x] **Add sort by company** — Added "Company" as a sorting option in both desktop sort buttons and mobile sort dropdown.
- [x] **Company dropdown with suggestions** — Company field is now a combobox with suggestions from previously used company names (like contract holder).
- [x] **Re-evaluate required fields** — `Name` and `Start Date` are now marked as required with `*` labels and client-side validation.

## Features

- [x] **JSON export/import** — JSON export (`GET /api/contracts/export.json`) and import (`POST /api/contracts/import.json`) alongside existing CSV support. Export dropdown offers CSV or JSON. Import dialog accepts both `.csv` and `.json` files.

## Household budget (Haushaltsbuch)

Goal: a household finance overview — what comes in, what the household actually pays, and how money is split between shared costs, savings and personal budgets.

### Stage 1 — Household model & quick entry ✅

- [x] **Persons** — household members and external persons (e.g. friends sharing a family plan), managed on the Household page.
- [x] **Accounts** — joint/private checking, savings, depot, cash; each account is shared or owned by a person.
- [x] **Entry kinds** — every entry is an expense, income or transfer (`contracts.kind`). Transfers between own accounts are no expenses.
- [x] **Who pays vs. who carries** — "paid from" account plus cost shares per person (`contract_shares`, weights). Only the household's share counts as household cost; external shares are subtracted. Legacy `split_between` is used as fallback when no shares exist.
- [x] **Quick entry dialog** — name, amount, interval, account, category, split presets; remembers last used accounts; "Save & new".
- [x] **Monthly overview** — income, household costs, saving & investing, unallocated rest; breakdown by category, person and account; personal budgets. Toggle between monthly average and actually due amounts.
- [x] Full form reordered: money fields first, contract details/contact/documents collapsible.

### Stage 2 — Logins, personal view & savings ✅

- [x] **Persons ↔ logins** — a person can be linked to a user login (each login at most once).
- [x] **Personal overview** — toggle "Household | Me": own income, own share of costs and savings. Shares win; otherwise the account owner; unsplit shared entries are divided equally among household members.
- [x] **Whose income?** — incomes can be attributed to persons via shares.
- [x] **Only visible to me** — quick entry can create private entries.
- [x] **Savings page** — every account flagged "savings" (any type, e.g. a buffer checking account) with balance, monthly rate (recurring transfers), goal amount/date, progress and projection.
- [x] **Overview redesign** — sidebar navigation; greeting + month picker; KPI cards (household costs with delta vs. previous month, costs per person, shared costs); category donut; money-flow sankey (income → categories / savings / free pocket money / unallocated); recurring expenses table with split and filter; upcoming charges; accounts; quick add. Charts are hand-written SVG (no chart library) using a validated colour palette.
- [ ] Balance history per savings account (snapshots), interest/return assumptions.

### Stage 3 — Actual bookings (Ist-Buchungen)

- [ ] `transactions` table (date, amount, account, optional `contract_id` for planned entry, category) with `transaction_shares` analogous to `contract_shares`.
- [ ] Plan vs. actual per month; optional CSV bank import.

### Later

- [ ] Sankey diagram of money flows (income → joint account → expenses / savings / personal accounts) — data is already available via accounts and transfers.
- [x] German UI translation (i18next, language per user under Settings).
- [x] Translated predefined categories via stable `categories.key` (user-created categories keep their name); renaming a category updates its entries.
- [x] Private entries are visible only to their owner — also for admins (list, detail, export, documents, suggestions).
- [ ] Income categories.
