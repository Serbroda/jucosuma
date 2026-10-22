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

### Stage 2b — Management pages ✅

- [x] Dedicated pages with tables and add/edit dialogs: income, expenses, transfers, savings & goals, accounts, categories, persons; global month picker in the top bar; import/export moved to settings.
- [x] Categories with type (expense/income), colour and icon; colours follow the category in all charts.
- [x] Savings goals (target, date, current amount, owner, account) funded by transfers; progress and projection.
- [x] Accounts with IBAN (last 4 digits shown) and balance.

### Stage 2c — Contracts & insurances ✅

- [x] Entries reference their category by id (`contracts.category_id`); the name column stays as readable copy. Deleting a category moves its entries to "Other".
- [x] Contract term (auto-renewal in months) and notice period; computed term end and cancel-by date.
- [x] Explicit "is a contract" flag on entries (pre-set for housing, utilities, telecom and insurance categories); existing contracts were migrated.
- [x] Contracts page with insurance tab, yearly costs and upcoming cancellation deadlines; deadlines card on the overview.

### Stage 2d — Pots instead of percentages ✅

- [x] Money belongs to the pot of its account: shared accounts form the household cash, private accounts belong to their owner. Income is no longer split by shares.
- [x] Overview per pot (household cash / each person / total): income incl. transfers in, costs, savings, available; transfers between pots appear as contributions in the money flow.
- [x] "Pots" card with the available amount of every pot; transfers page shows contributions to and payouts from the household cash.
- [x] Expenses keep their assignment (household / private) for analysis only.

### Stage 3 — Monthly closing (plan vs. actual) ✅

- [x] Once a month: real account balances at month end, optional actual totals for variable cost categories; the first closing also asks for start balances.
- [x] Plan vs. actual per pot (planned account change in "due" mode vs. real balance change) and per variable category.
- [x] Closing page with the last 12 months, reminder on the overview for the previous month, plan-vs-actual card for closed months.
- [x] Saving the latest closing updates the account balances.
- [x] Account balances are optional; actual amounts of variable costs alone are enough.
- [x] Last 12 months view: shares, actual vs. plan per month, trend and suggested monthly budget per category.
- [ ] Bank statement import (ING CSV) with categorisation rules, if itemised actuals are needed.
- [ ] Asset history chart from closing balances.

### Stage 3b — Entry details ✅

- [x] Amount history per entry (amount valid from a date on); every month uses the amount valid then, incl. savings goal projections.
- [x] Earner for income, independent of the receiving account.
- [x] Website and editable links per entry (e.g. customer portal, documents in Paperless); only http(s) links.

### Stage 4 — Split key & settlement (idea, not needed with a joint account)

For households without a joint account – shared costs are paid from private accounts and split by a key –
and as a helper for households with one.

- [ ] Household setting for the split key of shared ("household") costs: equal, by income (from the earners
      of the income entries) or fixed (e.g. 70/30). Single entries can still use their own shares.
- [ ] Settlement per month: per person *paid* (account owner) minus *borne* (split key) → "Julia settles
      500 € with Danny". Shown as overview card only when it is not 0 (with a joint account typically 0, except
      when someone paid a shared cost privately).
- [ ] "Available per month" per person based on the borne instead of the paid costs when settling.
- [ ] Suggested contributions to a joint account from the split key (e.g. 61/39 of 2,000 € shared costs).
- Pots and the account logic stay unchanged; no separate household "mode".

### Later

- [x] Sankey diagram of money flows (income → joint account → expenses / savings / personal accounts) — data is already available via accounts and transfers.
- [x] German UI translation (i18next, language per user under Settings).
- [x] Translated predefined categories via stable `categories.key` (user-created categories keep their name); renaming a category updates its entries.
- [x] Private entries are visible only to their owner — also for admins (list, detail, export, documents, suggestions).
- [x] Income categories.
