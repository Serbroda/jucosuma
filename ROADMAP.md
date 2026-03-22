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
