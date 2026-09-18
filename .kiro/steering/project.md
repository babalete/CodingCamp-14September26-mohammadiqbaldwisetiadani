# Expense & Budget Visualizer — Project Steering

## Project Overview
A mobile-friendly, client-side web application for tracking daily expenses and income.
No backend, no build step — open `index.html` directly in any modern browser.

## Tech Stack
- **HTML** — `index.html` (single page, semantic markup)
- **CSS** — `css/style.css` (single stylesheet, CSS custom properties, responsive)
- **JavaScript** — `js/app.js` (single file, Vanilla JS, no frameworks)
- **Chart.js 4.4.0** — loaded via CDN for pie and bar charts
- **Storage** — Browser `localStorage` only (keys prefixed with `ebv_`)

## Folder Structure Rules
- Only **one** CSS file allowed in `css/`
- Only **one** JS file allowed in `js/`
- No additional HTML files — everything lives in `index.html`

## Features Implemented
### Core (MVP)
- Transaction input form (Item Name, Amount, Category, Date, Type: Expense/Income)
- Form validation — all required fields checked before submission
- Scrollable transaction list with per-item delete button
- Total Balance card — auto-updates on add/delete
- Pie chart (Chart.js) — expense breakdown by category, auto-updates

### Optional (all 5 implemented)
1. **Custom categories** — add via form or the Categories tab; stored in localStorage
2. **Monthly summary view** — dedicated tab with income/expense stats and a bar chart
3. **Sort transactions** — by date (newest/oldest), amount (high/low), category (A→Z)
4. **Highlight over-limit expenses** — items exceeding the set limit get a warning badge
5. **Dark / Light mode toggle** — persisted in localStorage

### Categories Tab
- Lists all categories; default three (Food, Transport, Fun) cannot be deleted
- Custom categories can be deleted; existing transactions keep their label

## Coding Conventions
- `'use strict'` at the top of `app.js`
- DOM references cached in a single `dom` object at startup
- State held in a single `state` object; persisted via dedicated `save*()` functions
- All user-facing strings sanitised through `escapeHtml()` before insertion via `innerHTML`
- CSS variables used for all colors and spacing — never hardcode hex values in component rules
- Dark mode driven entirely by `[data-theme="dark"]` attribute on `<html>`; no JS class toggling

## Default Categories
The following three categories are **protected** and must never be deletable:
- Food 🍔
- Transport 🚌
- Fun 🎮

## LocalStorage Keys
| Key | Purpose |
|---|---|
| `ebv_transactions` | JSON array of all transactions |
| `ebv_categories` | JSON array of category names |
| `ebv_expense_limit` | Per-transaction expense limit (number, 0 = off) |
| `ebv_theme` | `"light"` or `"dark"` |
| `ebv_sort` | Active sort option string |
