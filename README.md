# 🌿 Parsley's Farm Manager

Farm management system for a 2.6-acre commercial vegetable farm in Kajiado County, Kenya.

## Features

- **Interactive SVG Map** — 290+ beds across 2 farms (A & B), 8 blocks, tap-to-select
- **Sales Tracking (Mauzo)** — Record sales by crop, buyer, farm, credit/cash, weekly/monthly summaries
- **Harvest & Storage** — Log harvests, track stored inventory, sell from storage
- **Activity Log (Shughuli)** — Spray, weed, till, observe — linked to beds with full history
- **Expenses (Matumizi)** — PIN-protected, 9 categories, monthly breakdown
- **Credit Tracking** — Buyer credit balances, payment recording
- **Bilingual** — English + Kiswahili throughout
- **Offline-First** — Works without internet, syncs when connected
- **Mobile-First** — Designed for phone use in the field

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript (no framework, no build step)
- **Storage:** IndexedDB (local) + Google Sheets API (cloud)
- **Auth:** Google Identity Services (OAuth 2.0)
- **Hosting:** GitHub Pages (free)
- **PWA:** Service worker + manifest for install-to-homescreen

## Setup

See [SETUP.md](SETUP.md) for complete deployment instructions.

## Data Architecture

| Google Sheet Tab | Contents |
|---|---|
| Beds | Crop assignments, planting dates, drip lines, notes |
| Sales | All sales with buyer, price, quantity, farm, payment method |
| Harvests | Harvest records linked to beds with destination (sell/store/home) |
| Expenses | Farm expenses by category |
| Activities | Spray/weed/till/observe logs linked to beds |
| CreditPayments | Credit payment records |
| Crops | Custom crop definitions |

## Farm Layout

- **Farm A:** 110m × 48m, Blocks A1-A4, 144 beds
- **Farm B:** 70m × 110m, Blocks B1-B4, 146 beds
- **Crops:** Onions, capsicum, okra, kale, spinach, and more
- **Irrigation:** Drip system with ball valves

## License

Private — Rod Parsley Mwangi, Kajiado County, Kenya
