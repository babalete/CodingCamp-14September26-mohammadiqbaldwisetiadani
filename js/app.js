/* ============================================================
   Expense & Budget Visualizer — app.js
   Vanilla JS · No frameworks · LocalStorage
   ============================================================ */

'use strict';

/* ── 1. Constants & State ──────────────────────────────────── */

const STORAGE_KEYS = {
  transactions: 'ebv_transactions',
  categories:   'ebv_categories',
  limit:        'ebv_expense_limit',
  theme:        'ebv_theme',
  sort:         'ebv_sort',
};

const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun'];

// Category → emoji mapping (extended by user additions)
const CATEGORY_EMOJI = {
  Food:      '🍔',
  Transport: '🚌',
  Fun:       '🎮',
};

// Colours used for the pie chart (cycles if more categories added)
const CHART_COLORS = [
  '#4f46e5', '#059669', '#f59e0b', '#dc2626',
  '#0ea5e9', '#8b5cf6', '#ec4899', '#14b8a6',
  '#f97316', '#84cc16',
];

let state = {
  transactions: [],   // { id, name, amount, category, type, date }
  categories:   [],   // strings
  expenseLimit: 0,    // Rp; 0 means off
  sort:         'date-desc',
  filterCategory: 'all',
  viewMonth:    null, // Date object (1st of month) for summary view
};

let pieChart     = null;
let summaryChart = null;

/* ── 2. Persistence ───────────────────────────────────────── */

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEYS.transactions);
  state.transactions = raw ? JSON.parse(raw) : [];

  const cats = localStorage.getItem(STORAGE_KEYS.categories);
  state.categories = cats ? JSON.parse(cats) : [...DEFAULT_CATEGORIES];

  state.expenseLimit = parseFloat(localStorage.getItem(STORAGE_KEYS.limit) || '0') || 0;
  state.sort         = localStorage.getItem(STORAGE_KEYS.sort) || 'date-desc';
  state.viewMonth    = new Date(); // current month on load
  state.viewMonth.setDate(1);
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(state.transactions));
}

function saveCategories() {
  localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(state.categories));
}

function saveLimit() {
  localStorage.setItem(STORAGE_KEYS.limit, String(state.expenseLimit));
}

function saveSort() {
  localStorage.setItem(STORAGE_KEYS.sort, state.sort);
}

/* ── 3. DOM References ────────────────────────────────────── */

const $ = id => document.getElementById(id);

const dom = {
  // Theme
  themeIcon:      $('themeIcon'),
  themeToggle:    $('themeToggle'),

  // Tabs
  tabAdd:         $('tabAdd'),
  tabSummary:     $('tabSummary'),
  panelAdd:       $('panelAdd'),
  panelSummary:   $('panelSummary'),

  // Balance
  totalBalance:   $('totalBalance'),
  totalIncome:    $('totalIncome'),
  totalExpense:   $('totalExpense'),

  // Form
  form:           $('transactionForm'),
  typeHidden:     $('transactionType'),
  itemName:       $('itemName'),
  amount:         $('amount'),
  category:       $('category'),
  transDate:      $('transDate'),
  expenseLimit:   $('expenseLimit'),
  customCategory: $('customCategory'),
  addCategoryBtn: $('addCategoryBtn'),

  // Errors
  itemNameError:  $('itemNameError'),
  amountError:    $('amountError'),
  categoryError:  $('categoryError'),

  // Controls
  sortSelect:       $('sortSelect'),
  filterCategory:   $('filterCategory'),
  clearAllBtn:      $('clearAllBtn'),

  // List
  transactionList: $('transactionList'),
  txCount:          $('txCount'),
  emptyState:       $('emptyState'),
  limitWarning:     $('limitWarning'),
  limitWarningText: $('limitWarningText'),

  // Chart
  expenseChart:   $('expenseChart'),
  chartEmpty:     $('chartEmpty'),

  // Summary
  prevMonth:           $('prevMonth'),
  nextMonth:           $('nextMonth'),
  currentMonthLabel:   $('currentMonthLabel'),
  summaryStats:        $('summaryStats'),
  summaryList:         $('summaryList'),
  summaryChartEmpty:   $('summaryChartEmpty'),
  summaryChart:        $('summaryChart'),

  // Categories panel
  tabCategories:        $('tabCategories'),
  panelCategories:      $('panelCategories'),
  categoryPanelList:    $('categoryPanelList'),
  panelCustomCategory:  $('panelCustomCategory'),
  panelAddCategoryBtn:  $('panelAddCategoryBtn'),
};

/* ── 4. Utilities ─────────────────────────────────────────── */

function formatRp(amount) {
  return 'Rp ' + Math.abs(amount).toLocaleString('id-ID');
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(dateStr) {
  // returns "YYYY-MM"
  return dateStr ? dateStr.slice(0, 7) : '';
}

function isSameMonth(dateStr, refDate) {
  return monthKey(dateStr) === `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}`;
}

function getCategoryEmoji(cat) {
  return CATEGORY_EMOJI[cat] || '📁';
}

/* ── 5. Theme ─────────────────────────────────────────────── */

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  dom.themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem(STORAGE_KEYS.theme, theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
  // Re-render charts with updated colours
  renderPieChart();
  if (!dom.panelSummary.classList.contains('hidden')) renderSummaryChart();
}

/* ── 6. Category Management ───────────────────────────────── */

function rebuildCategorySelects() {
  // Rebuild both selects (form + filter) from state.categories
  const formSel   = dom.category;
  const filterSel = dom.filterCategory;
  const currentFormVal   = formSel.value;
  const currentFilterVal = filterSel.value;

  // Clear & rebuild form select
  formSel.innerHTML = '<option value="">— Select category —</option>';
  state.categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = `${getCategoryEmoji(cat)} ${cat}`;
    formSel.appendChild(opt);
  });
  formSel.value = currentFormVal;

  // Clear & rebuild filter select
  filterSel.innerHTML = '<option value="all">All Categories</option>';
  state.categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = `${getCategoryEmoji(cat)} ${cat}`;
    filterSel.appendChild(opt);
  });
  filterSel.value = currentFilterVal;
}

function addCustomCategory() {
  const raw = dom.customCategory.value.trim();
  if (!raw) {
    alert('Please enter a category name.');
    return;
  }
  const name = raw.charAt(0).toUpperCase() + raw.slice(1);
  if (state.categories.includes(name)) {
    alert(`"${name}" already exists.`);
    return;
  }
  state.categories.push(name);
  saveCategories();
  rebuildCategorySelects();
  dom.customCategory.value = '';
  // Auto-select it in the form
  dom.category.value = name;
}

/* ── 7. Categories Panel ──────────────────────────────────── */

function renderCategoryPanel() {
  const container = dom.categoryPanelList;
  container.innerHTML = '';

  if (state.categories.length === 0) {
    container.innerHTML = '<p class="cat-panel-empty">No categories found.</p>';
    return;
  }

  state.categories.forEach(cat => {
    const isDefault = DEFAULT_CATEGORIES.includes(cat);
    const item = document.createElement('div');
    item.className = `cat-item${isDefault ? ' is-default' : ''}`;
    item.innerHTML = `
      <span class="cat-item-emoji">${getCategoryEmoji(cat)}</span>
      <span class="cat-item-name">${escapeHtml(cat)}</span>
      ${isDefault ? '<span class="cat-item-badge">DEFAULT</span>' : ''}
      <button
        class="cat-item-delete"
        data-cat="${escapeHtml(cat)}"
        aria-label="Delete category ${escapeHtml(cat)}"
        ${isDefault ? 'disabled' : ''}
      >🗑 Delete</button>
    `;
    container.appendChild(item);
  });
}

function deleteCategoryFromPanel(catName) {
  if (DEFAULT_CATEGORIES.includes(catName)) return;
  if (!confirm(`Delete the category "${catName}"?\nTransactions using it will keep their category label.`)) return;
  state.categories = state.categories.filter(c => c !== catName);
  saveCategories();
  rebuildCategorySelects();
  renderCategoryPanel();
}

function addCategoryFromPanel() {
  const raw = dom.panelCustomCategory.value.trim();
  if (!raw) { alert('Please enter a category name.'); return; }
  const name = raw.charAt(0).toUpperCase() + raw.slice(1);
  if (state.categories.includes(name)) { alert(`"${name}" already exists.`); return; }
  state.categories.push(name);
  saveCategories();
  rebuildCategorySelects();
  dom.panelCustomCategory.value = '';
  renderCategoryPanel();
}

/* ── 7. Form Validation ───────────────────────────────────── */

function clearErrors() {
  dom.itemNameError.textContent  = '';
  dom.amountError.textContent    = '';
  dom.categoryError.textContent  = '';
  dom.itemName.classList.remove('error');
  dom.amount.classList.remove('error');
  dom.category.classList.remove('error');
}

function validateForm() {
  clearErrors();
  let valid = true;

  if (!dom.itemName.value.trim()) {
    dom.itemNameError.textContent = 'Item name is required.';
    dom.itemName.classList.add('error');
    valid = false;
  }

  const amt = parseFloat(dom.amount.value);
  if (!dom.amount.value.trim() || isNaN(amt) || amt <= 0) {
    dom.amountError.textContent = 'Enter a valid amount greater than 0.';
    dom.amount.classList.add('error');
    valid = false;
  }

  if (!dom.category.value) {
    dom.categoryError.textContent = 'Please select a category.';
    dom.category.classList.add('error');
    valid = false;
  }

  return valid;
}

/* ── 8. Add / Delete Transactions ────────────────────────── */

function handleFormSubmit(e) {
  e.preventDefault();
  if (!validateForm()) return;

  // Persist limit from field
  const limitVal = parseFloat(dom.expenseLimit.value);
  state.expenseLimit = (!isNaN(limitVal) && limitVal >= 0) ? limitVal : 0;
  saveLimit();

  const tx = {
    id:       generateId(),
    name:     dom.itemName.value.trim(),
    amount:   parseFloat(parseFloat(dom.amount.value).toFixed(2)),
    category: dom.category.value,
    type:     dom.typeHidden.value,  // 'expense' | 'income'
    date:     dom.transDate.value || todayISO(),
  };

  state.transactions.unshift(tx);
  saveTransactions();

  // Reset all form fields after submission
  dom.itemName.value      = '';
  dom.amount.value        = '';
  dom.category.value      = '';
  dom.transDate.value     = '';
  dom.expenseLimit.value  = '';
  dom.customCategory.value = '';

  // Reset type toggle back to Expense
  dom.typeHidden.value = 'expense';
  document.querySelectorAll('.type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === 'expense');
  });

  clearErrors();

  renderAll();
}

function deleteTransaction(id) {
  state.transactions = state.transactions.filter(t => t.id !== id);
  saveTransactions();
  renderAll();
}

function clearAllTransactions() {
  if (!confirm('Delete ALL transactions? This cannot be undone.')) return;
  state.transactions = [];
  saveTransactions();
  renderAll();
}

/* ── 9. Sorting & Filtering ───────────────────────────────── */

function getSortedFiltered() {
  let list = [...state.transactions];

  // Filter
  if (state.filterCategory !== 'all') {
    list = list.filter(t => t.category === state.filterCategory);
  }

  // Sort
  switch (state.sort) {
    case 'date-desc':    list.sort((a, b) => b.date.localeCompare(a.date));   break;
    case 'date-asc':     list.sort((a, b) => a.date.localeCompare(b.date));   break;
    case 'amount-desc':  list.sort((a, b) => b.amount - a.amount);            break;
    case 'amount-asc':   list.sort((a, b) => a.amount - b.amount);            break;
    case 'category-asc': list.sort((a, b) => a.category.localeCompare(b.category)); break;
  }

  return list;
}

/* ── 10. Render: Balance ──────────────────────────────────── */

function renderBalance() {
  let income  = 0;
  let expense = 0;

  state.transactions.forEach(t => {
    if (t.type === 'income')  income  += t.amount;
    else                      expense += t.amount;
  });

  const balance = income - expense;
  dom.totalBalance.textContent  = (balance < 0 ? '− ' : '') + formatRp(balance);
  dom.totalIncome.textContent   = formatRp(income);
  dom.totalExpense.textContent  = formatRp(expense);
}

/* ── 11. Render: Transaction List ────────────────────────── */

function renderTransactionList() {
  const list = getSortedFiltered();
  dom.txCount.textContent = state.transactions.length;

  // Limit warning
  const totalExpense = state.transactions
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);

  if (state.expenseLimit > 0 && totalExpense >= state.expenseLimit) {
    dom.limitWarning.classList.remove('hidden');
    dom.limitWarningText.textContent =
      `Total expenses (${formatRp(totalExpense)}) have reached your limit of ${formatRp(state.expenseLimit)}!`;
  } else {
    dom.limitWarning.classList.add('hidden');
  }

  // Empty state
  if (list.length === 0) {
    dom.transactionList.innerHTML = '';
    dom.emptyState.style.display = '';
    dom.transactionList.appendChild(dom.emptyState);
    return;
  }

  dom.emptyState.style.display = 'none';
  dom.transactionList.innerHTML = '';

  list.forEach(tx => {
    const isOverLimit = state.expenseLimit > 0
      && tx.type === 'expense'
      && tx.amount >= state.expenseLimit;

    const li = document.createElement('li');
    li.className = `tx-item${isOverLimit ? ' over-limit' : ''}`;
    li.dataset.id = tx.id;

    li.innerHTML = `
      <span class="tx-dot ${tx.type}"></span>
      <div class="tx-body">
        <div class="tx-name">
          ${escapeHtml(tx.name)}
          ${isOverLimit ? '<span class="over-limit-badge">LIMIT</span>' : ''}
        </div>
        <div class="tx-meta">
          <span class="tx-category-pill">${getCategoryEmoji(tx.category)} ${escapeHtml(tx.category)}</span>
          <span>${tx.date}</span>
        </div>
      </div>
      <span class="tx-amount ${tx.type}">${tx.type === 'income' ? '+' : '−'} ${formatRp(tx.amount)}</span>
      <button class="tx-delete" data-id="${tx.id}" title="Delete transaction" aria-label="Delete ${escapeHtml(tx.name)}">🗑</button>
    `;

    dom.transactionList.appendChild(li);
  });
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── 12. Render: Pie Chart ────────────────────────────────── */

function renderPieChart() {
  const expenseOnly = state.transactions.filter(t => t.type === 'expense');

  if (expenseOnly.length === 0) {
    dom.chartEmpty.style.display = '';
    dom.expenseChart.style.display = 'none';
    if (pieChart) { pieChart.destroy(); pieChart = null; }
    return;
  }

  dom.chartEmpty.style.display = 'none';
  dom.expenseChart.style.display = '';

  // Aggregate by category
  const catMap = {};
  expenseOnly.forEach(t => {
    catMap[t.category] = (catMap[t.category] || 0) + t.amount;
  });

  const labels = Object.keys(catMap);
  const data   = Object.values(catMap);
  const colors = labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

  if (pieChart) {
    pieChart.data.labels          = labels;
    pieChart.data.datasets[0].data   = data;
    pieChart.data.datasets[0].backgroundColor = colors;
    pieChart.update();
  } else {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    pieChart = new Chart(dom.expenseChart, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderColor: isDark ? '#1e293b' : '#fff',
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: isDark ? '#f1f5f9' : '#1a202c',
              padding: 14,
              font: { size: 12, weight: '600' },
            },
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.label}: ${formatRp(ctx.raw)} (${((ctx.raw / data.reduce((a,b)=>a+b,0))*100).toFixed(1)}%)`,
            },
          },
        },
      },
    });
  }
}

/* ── 13. Render: Monthly Summary ─────────────────────────── */

function renderMonthlySummary() {
  const ref   = state.viewMonth;
  const label = ref.toLocaleString('default', { month: 'long', year: 'numeric' });
  dom.currentMonthLabel.textContent = label;

  const monthTx = state.transactions.filter(t => isSameMonth(t.date, ref));

  const income  = monthTx.filter(t=>t.type==='income') .reduce((s,t)=>s+t.amount, 0);
  const expense = monthTx.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount, 0);
  const balance = income - expense;

  dom.summaryStats.innerHTML = `
    <div class="summary-stat-box income-box">
      <span class="stat-label">Income</span>
      <span class="stat-value">${formatRp(income)}</span>
    </div>
    <div class="summary-stat-box expense-box">
      <span class="stat-label">Expense</span>
      <span class="stat-value">${formatRp(expense)}</span>
    </div>
    <div class="summary-stat-box balance-box">
      <span class="stat-label">Balance</span>
      <span class="stat-value">${formatRp(balance)}</span>
    </div>
  `;

  // Summary list
  if (monthTx.length === 0) {
    dom.summaryList.innerHTML = '<li class="empty-state">No transactions this month.</li>';
  } else {
    // Sort by date desc for summary
    const sorted = [...monthTx].sort((a,b) => b.date.localeCompare(a.date));
    dom.summaryList.innerHTML = '';
    sorted.forEach(tx => {
      const li = document.createElement('li');
      li.className = 'tx-item';
      li.innerHTML = `
        <span class="tx-dot ${tx.type}"></span>
        <div class="tx-body">
          <div class="tx-name">${escapeHtml(tx.name)}</div>
          <div class="tx-meta">
            <span class="tx-category-pill">${getCategoryEmoji(tx.category)} ${escapeHtml(tx.category)}</span>
            <span>${tx.date}</span>
          </div>
        </div>
        <span class="tx-amount ${tx.type}">${tx.type==='income' ? '+' : '−'} ${formatRp(tx.amount)}</span>
      `;
      dom.summaryList.appendChild(li);
    });
  }

  renderSummaryChart(monthTx);
}

function renderSummaryChart(monthTx) {
  if (!monthTx) {
    monthTx = state.transactions.filter(t => isSameMonth(t.date, state.viewMonth));
  }

  const expTx = monthTx.filter(t => t.type === 'expense');

  if (expTx.length === 0) {
    dom.summaryChartEmpty.style.display = '';
    dom.summaryChart.style.display = 'none';
    if (summaryChart) { summaryChart.destroy(); summaryChart = null; }
    return;
  }

  dom.summaryChartEmpty.style.display = 'none';
  dom.summaryChart.style.display = '';

  const catMap = {};
  expTx.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });

  const labels = Object.keys(catMap);
  const data   = Object.values(catMap);
  const colors = labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  if (summaryChart) {
    summaryChart.data.labels = labels;
    summaryChart.data.datasets[0].data = data;
    summaryChart.data.datasets[0].backgroundColor = colors;
    summaryChart.update();
  } else {
    summaryChart = new Chart(dom.summaryChart, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Expenses (Rp)',
          data,
          backgroundColor: colors,
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: ctx => ` ${formatRp(ctx.raw)}` },
          },
        },
        scales: {
          x: {
            ticks: { color: isDark ? '#94a3b8' : '#718096', font: { size: 11 } },
            grid:  { color: isDark ? '#334155' : '#e2e8f0' },
          },
          y: {
            ticks: {
              color: isDark ? '#94a3b8' : '#718096',
              font: { size: 11 },
              callback: v => 'Rp ' + v.toLocaleString('id-ID'),
            },
            grid: { color: isDark ? '#334155' : '#e2e8f0' },
          },
        },
      },
    });
  }
}

/* ── 14. Master Render ────────────────────────────────────── */

function renderAll() {
  renderBalance();
  renderTransactionList();
  renderPieChart();
  if (!dom.panelSummary.classList.contains('hidden')) {
    renderMonthlySummary();
  }
}

/* ── 15. Tab Helper ───────────────────────────────────────── */

function activateTab(name) {
  // Buttons
  dom.tabAdd.classList.toggle('active', name === 'add');
  dom.tabSummary.classList.toggle('active', name === 'summary');
  dom.tabCategories.classList.toggle('active', name === 'categories');

  dom.tabAdd.setAttribute('aria-selected', name === 'add' ? 'true' : 'false');
  dom.tabSummary.setAttribute('aria-selected', name === 'summary' ? 'true' : 'false');
  dom.tabCategories.setAttribute('aria-selected', name === 'categories' ? 'true' : 'false');

  // Panels
  dom.panelAdd.classList.toggle('hidden', name !== 'add');
  dom.panelSummary.classList.toggle('hidden', name !== 'summary');
  dom.panelCategories.classList.toggle('hidden', name !== 'categories');
}

/* ── 16. Event Listeners ──────────────────────────────────── */

function initEventListeners() {

  // Theme toggle
  dom.themeToggle.addEventListener('click', toggleTheme);

  // Tabs
  dom.tabAdd.addEventListener('click', () => {
    activateTab('add');
  });

  dom.tabSummary.addEventListener('click', () => {
    activateTab('summary');
    renderMonthlySummary();
  });

  dom.tabCategories.addEventListener('click', () => {
    activateTab('categories');
    renderCategoryPanel();
  });

  // Type toggle buttons
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      dom.typeHidden.value = btn.dataset.type;
    });
  });

  // Form submit
  dom.form.addEventListener('submit', handleFormSubmit);

  // Add custom category (form panel)
  dom.addCategoryBtn.addEventListener('click', addCustomCategory);
  dom.customCategory.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addCustomCategory(); }
  });

  // Categories panel — delete (event delegation)
  dom.categoryPanelList.addEventListener('click', e => {
    const btn = e.target.closest('.cat-item-delete');
    if (!btn || btn.disabled) return;
    deleteCategoryFromPanel(btn.dataset.cat);
  });

  // Categories panel — add new category
  dom.panelAddCategoryBtn.addEventListener('click', addCategoryFromPanel);
  dom.panelCustomCategory.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addCategoryFromPanel(); }
  });

  // Sort
  dom.sortSelect.addEventListener('change', () => {
    state.sort = dom.sortSelect.value;
    saveSort();
    renderTransactionList();
  });

  // Filter
  dom.filterCategory.addEventListener('change', () => {
    state.filterCategory = dom.filterCategory.value;
    renderTransactionList();
  });

  // Delete (event delegation on list)
  dom.transactionList.addEventListener('click', e => {
    const btn = e.target.closest('.tx-delete');
    if (!btn) return;
    const id = btn.dataset.id;
    if (confirm('Delete this transaction?')) deleteTransaction(id);
  });

  // Clear all
  dom.clearAllBtn.addEventListener('click', clearAllTransactions);

  // Monthly summary nav
  dom.prevMonth.addEventListener('click', () => {
    state.viewMonth.setMonth(state.viewMonth.getMonth() - 1);
    renderMonthlySummary();
  });

  dom.nextMonth.addEventListener('click', () => {
    state.viewMonth.setMonth(state.viewMonth.getMonth() + 1);
    renderMonthlySummary();
  });

  // Expense limit: live update from input (save only on submit)
  dom.expenseLimit.addEventListener('change', () => {
    const v = parseFloat(dom.expenseLimit.value);
    state.expenseLimit = (!isNaN(v) && v >= 0) ? v : 0;
    saveLimit();
    renderTransactionList();
  });
}

/* ── 16. Initialise ───────────────────────────────────────── */

function init() {
  loadState();

  // Restore theme
  const savedTheme = localStorage.getItem(STORAGE_KEYS.theme) || 'light';
  applyTheme(savedTheme);

  // Restore sort select
  dom.sortSelect.value = state.sort;

  // Restore expense limit in field
  if (state.expenseLimit > 0) dom.expenseLimit.value = state.expenseLimit;

  // Set today's date as default in form
  dom.transDate.value = todayISO();

  // Populate category selects from saved categories
  rebuildCategorySelects();

  // Wire up all events
  initEventListeners();

  // First render
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);
