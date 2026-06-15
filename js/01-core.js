// ═══ دفتر المقهى ═══ 01-core.js — الإعدادات، الحالة، التخزين، النسخ الاحتياطي
// (مقسوم من app.js — الأسطر 1-514)

const STORAGE_KEY = "cafe-pos-ledger-v1";
const AUTO_BACKUP_KEY = "cafe-pos-ledger-v1-auto-backup";
const BACKUP_HISTORY_KEY = "cafe-pos-ledger-v1-backup-history";
const BACKUP_DB_NAME = "cafe-pos-ledger-backups";
const BACKUP_STORE_NAME = "snapshots";
const MAX_BACKUP_HISTORY = 10;
const DEFAULT_TABLE_COUNT = 14;
const ENABLE_LINKING = false;
const ENABLE_STOCK_COMPONENTS = true;

const defaultMenu = [
  { id: "coffee-arabic", name: "قهوة عربية", price: 8, category: "مشروبات" },
  { id: "coffee-turkish", name: "قهوة تركية", price: 10, category: "مشروبات" },
  { id: "tea", name: "شاي", price: 6, category: "مشروبات" },
  { id: "nescafe", name: "نسكافيه", price: 12, category: "مشروبات" },
  { id: "mint", name: "نعنع وليمون", price: 14, category: "بارد" },
  { id: "water", name: "ماء", price: 4, category: "بارد" },
  { id: "shisha-apple", name: "شيشة تفاحتين", price: 25, category: "شيشة" },
  { id: "shisha-mint", name: "شيشة نعنع", price: 25, category: "شيشة" },
  { id: "coal", name: "راس فحم", price: 5, category: "شيشة" },
  { id: "cake", name: "قطعة كيك", price: 16, category: "حلويات" },
  { id: "cookies", name: "بسكويت", price: 7, category: "حلويات" },
  { id: "sandwich", name: "سندويشة خفيفة", price: 18, category: "أكل" }
];

const paymentLabels = {
  cash: "كاش",
  bank: "تطبيق بنك",
  wallet: "محفظة"
};

const paymentMethods = Object.keys(paymentLabels);
const workerConsumptionTypeLabels = {
  free: "مجاني للعامل",
  worker_price: "سعر عامل",
  salary: "خصم من الراتب"
};
const FREE_WORKER_CONSUMPTION_TYPE = "free";
const SALARY_WORKER_CONSUMPTION_TYPE = "salary";
const workerTransactionTypeLabels = {
  advance: "سلفة",
  salary_payment: "قبضة / راتب"
};
const WORKER_ADVANCE_TYPE = "advance";
const WORKER_SALARY_PAYMENT_TYPE = "salary_payment";

let stateNeedsBackupRecovery = false;
let backupWriteTimer = null;
// تتعبى فعلياً في js/12-init.js بعد تحميل كل الملفات (loadState يحتاج دوال من 02-domain)
let state = null;
let selectedCategory = "الكل";
let selectedCustomerId = null;
let selectedWorkerId = null;
let lastClosedInvoice = null;
let purchaseDraftItems = [];
let inventoryDraft = {};
let menuComponentDraft = [];
let invoiceEditItemsDraft = [];
let editingMenuItemId = null;
let editingInvoiceId = null;
let editingPurchaseId = null;
let settlementDebtMode = false;
let workerConsumptionMode = "worker_price"; // worker_price | salary | free
let expandedCloseId = null;

const $ = (selector) => document.querySelector(selector);

const els = {
  tabs: document.querySelectorAll(".tab-button"),
  views: document.querySelectorAll(".view"),
  statsStrip: $("#statsStrip"),
  tablesGrid: $("#tablesGrid"),
  newOrderButton: $("#newOrderButton"),
  addTableButton: $("#addTableButton"),
  deleteTableButton: $("#deleteTableButton"),
  orderSubtitle: $("#orderSubtitle"),
  tableNameInput: $("#tableNameInput"),
  orderStatus: $("#orderStatus"),
  customerNameInput: $("#customerNameInput"),
  customerSuggestions: $("#customerSuggestions"),
  customerPhoneInput: $("#customerPhoneInput"),
  customerSelect: $("#customerSelect"),
  saveCustomerButton: $("#saveCustomerButton"),
  menuSearchInput: $("#menuSearchInput"),
  customItemForm: $("#customItemForm"),
  customItemNameInput: $("#customItemNameInput"),
  customItemPriceInput: $("#customItemPriceInput"),
  menuCategories: $("#menuCategories"),
  menuGrid: $("#menuGrid"),
  orderItems: $("#orderItems"),
  clearOrderButton: $("#clearOrderButton"),
  discountInput: $("#discountInput"),
  paymentMethodInput: $("#paymentMethodInput"),
  paymentAmountInput: $("#paymentAmountInput"),
  noteInput: $("#noteInput"),
  subtotalValue: $("#subtotalValue"),
  totalValue: $("#totalValue"),
  profitWarning: $("#profitWarning"),
  balanceResult: $("#balanceResult"),
  closeInvoiceButton: $("#closeInvoiceButton"),
  printButton: $("#printButton"),
  customerAccountBox: $("#customerAccountBox"),
  statTodaySales: $("#statTodaySales"),
  statTodayPurchases: $("#statTodayPurchases"),
  statItemProfit: $("#statItemProfit"),
  statNetProfit: $("#statNetProfit"),
  openOrdersBadge: $("#openOrdersBadge"),
  customerTotalDebt: $("#customerTotalDebt"),
  customerTotalCredit: $("#customerTotalCredit"),
  customerAddForm: $("#customerAddForm"),
  customerAddNameInput: $("#customerAddNameInput"),
  customerAddPhoneInput: $("#customerAddPhoneInput"),
  customerSearchInput: $("#customerSearchInput"),
  customerStatusFilter: $("#customerStatusFilter"),
  customerExcelExportButton: $("#customerExcelExportButton"),
  customerExcelImportInput: $("#customerExcelImportInput"),
  customersList: $("#customersList"),
  customerDetailName: $("#customerDetailName"),
  customerDetailMeta: $("#customerDetailMeta"),
  customerStatementButton: $("#customerStatementButton"),
  customerKpis: $("#customerKpis"),
  cpItemSelect: $("#cpItemSelect"),
  cpPriceInput: $("#cpPriceInput"),
  cpAddButton: $("#cpAddButton"),
  customerPricesList: $("#customerPricesList"),
  settlementForm: $("#settlementForm"),
  settlementTitle: $("#settlementTitle"),
  settlementModeToggle: $("#settlementModeToggle"),
  settlementModePayment: $("#settlementModePayment"),
  settlementModeDebt: $("#settlementModeDebt"),
  settlementAmountInput: $("#settlementAmountInput"),
  settlementDiscountField: $("#settlementDiscountField"),
  settlementDiscountInput: $("#settlementDiscountInput"),
  settlementMethodInput: $("#settlementMethodInput"),
  settlementMethodField: $("#settlementMethodField"),
  settlementNoteField: $("#settlementNoteField"),
  settlementNoteInput: $("#settlementNoteInput"),
  settlementSubmitButton: $("#settlementSubmitButton"),
  ledgerList: $("#ledgerList"),
  invoiceSearchInput: $("#invoiceSearchInput"),
  invoiceStatusFilter: $("#invoiceStatusFilter"),
  invoiceDateFromInput: $("#invoiceDateFromInput"),
  invoiceDateToInput: $("#invoiceDateToInput"),
  invoiceDateSortInput: $("#invoiceDateSortInput"),
  invoiceNetTotal: $("#invoiceNetTotal"),
  invoiceNetCount: $("#invoiceNetCount"),
  invoiceEditForm: $("#invoiceEditForm"),
  invoiceEditTitle: $("#invoiceEditTitle"),
  invoiceEditCancelButton: $("#invoiceEditCancelButton"),
  invoiceEditCustomerInput: $("#invoiceEditCustomerInput"),
  invoiceEditPhoneInput: $("#invoiceEditPhoneInput"),
  invoiceEditDateInput: $("#invoiceEditDateInput"),
  invoiceEditTableInput: $("#invoiceEditTableInput"),
  invoiceEditTotalInput: $("#invoiceEditTotalInput"),
  invoiceEditPaidInput: $("#invoiceEditPaidInput"),
  invoiceEditDiscountField: $("#invoiceEditDiscountField"),
  invoiceEditDiscountInput: $("#invoiceEditDiscountInput"),
  invoiceEditMethodInput: $("#invoiceEditMethodInput"),
  invoiceEditItemsSection: $("#invoiceEditItemsSection"),
  invoiceEditSubtotalValue: $("#invoiceEditSubtotalValue"),
  invoiceEditMenuItemInput: $("#invoiceEditMenuItemInput"),
  invoiceEditAddMenuItemButton: $("#invoiceEditAddMenuItemButton"),
  invoiceEditCustomNameInput: $("#invoiceEditCustomNameInput"),
  invoiceEditCustomPriceInput: $("#invoiceEditCustomPriceInput"),
  invoiceEditAddCustomButton: $("#invoiceEditAddCustomButton"),
  invoiceEditItemsList: $("#invoiceEditItemsList"),
  invoiceEditNoteInput: $("#invoiceEditNoteInput"),
  invoiceTableBody: $("#invoiceTableBody"),
  invoiceExcelExportButton: $("#invoiceExcelExportButton"),
  invoiceExcelImportInput: $("#invoiceExcelImportInput"),
  reportDateFromInput: $("#reportDateFromInput"),
  reportDateToInput: $("#reportDateToInput"),
  reportRangeText: $("#reportRangeText"),
  reportSummaryGrid: $("#reportSummaryGrid"),
  cashOnHandBox: $("#cashOnHandBox"),
  todayCashStrip: $("#todayCashStrip"),
  reportPaymentsList: $("#reportPaymentsList"),
  reportItemsList: $("#reportItemsList"),
  reportCustomersList: $("#reportCustomersList"),
  reportInvoicesList: $("#reportInvoicesList"),
  reportPurchasesList: $("#reportPurchasesList"),
  reportGeneralExpensesList: $("#reportGeneralExpensesList"),
  reportInventoryList: $("#reportInventoryList"),
  reportExpensesList: $("#reportExpensesList"),
  reportWorkersList: $("#reportWorkersList"),
  expenseForm: $("#expenseForm"),
  expenseDateInput: $("#expenseDateInput"),
  expenseTitleInput: $("#expenseTitleInput"),
  expenseAmountInput: $("#expenseAmountInput"),
  workerItemInput: $("#workerItemInput"),
  workerQtyInput: $("#workerQtyInput"),
  expenseMethodInput: $("#expenseMethodInput"),
  expenseMethodField: $("#expenseMethodField"),
  expenseAmountField: $("#expenseAmountField"),
  expenseAmountLabel: $("#expenseAmountLabel"),
  consumptionTypeToggle: $("#consumptionTypeToggle"),
  expenseNoteInput: $("#expenseNoteInput"),
  generalExpenseForm: $("#generalExpenseForm"),
  generalExpenseDateInput: $("#generalExpenseDateInput"),
  generalExpenseTitleInput: $("#generalExpenseTitleInput"),
  generalExpenseAmountInput: $("#generalExpenseAmountInput"),
  generalExpenseMethodInput: $("#generalExpenseMethodInput"),
  generalExpenseNoteInput: $("#generalExpenseNoteInput"),
  generalExpenseTotalBox: $("#generalExpenseTotalBox"),
  generalExpensesList: $("#generalExpensesList"),
  workerAddForm: $("#workerAddForm"),
  workerAddNameInput: $("#workerAddNameInput"),
  workerAddPhoneInput: $("#workerAddPhoneInput"),
  workerAddSalaryInput: $("#workerAddSalaryInput"),
  workerSearchInput: $("#workerSearchInput"),
  workerStatusFilter: $("#workerStatusFilter"),
  workerTotalDue: $("#workerTotalDue"),
  workerTotalAdvance: $("#workerTotalAdvance"),
  workerTotalSalaryPaid: $("#workerTotalSalaryPaid"),
  workerTotalCharged: $("#workerTotalCharged"),
  workersList: $("#workersList"),
  workerDetailName: $("#workerDetailName"),
  workerDetailMeta: $("#workerDetailMeta"),
  workerKpis: $("#workerKpis"),
  workerPeriodRow: $("#workerPeriodRow"),
  workerOwnPeriodInput: $("#workerOwnPeriodInput"),
  workerOwnPeriodResetButton: $("#workerOwnPeriodResetButton"),
  workerTransactionForm: $("#workerTransactionForm"),
  workerTransactionDateInput: $("#workerTransactionDateInput"),
  workerTransactionTypeInput: $("#workerTransactionTypeInput"),
  workerTransactionAmountInput: $("#workerTransactionAmountInput"),
  workerTransactionMethodInput: $("#workerTransactionMethodInput"),
  workerTransactionNoteInput: $("#workerTransactionNoteInput"),
  workerTransactionSubmitButton: $("#workerTransactionSubmitButton"),
  workerLedgerList: $("#workerLedgerList"),
  exportButton: $("#exportButton"),
  importInput: $("#importInput"),
  purchaseForm: $("#purchaseForm"),
  purchaseMenuItemInput: $("#purchaseMenuItemInput"),
  purchaseItemInput: $("#purchaseItemInput"),
  purchaseSupplierInput: $("#purchaseSupplierInput"),
  purchaseQtyInput: $("#purchaseQtyInput"),
  purchaseUnitInput: $("#purchaseUnitInput"),
  purchaseStockQtyInput: $("#purchaseStockQtyInput"),
  purchaseStockUnitInput: $("#purchaseStockUnitInput"),
  purchaseAmountInput: $("#purchaseAmountInput"),
  purchaseUnitCostValue: $("#purchaseUnitCostValue"),
  purchaseMethodInput: $("#purchaseMethodInput"),
  purchaseNoteInput: $("#purchaseNoteInput"),
  purchaseDraftBox: $("#purchaseDraftBox"),
  purchaseDraftTitle: $("#purchaseDraftTitle"),
  purchaseDraftSubtitle: $("#purchaseDraftSubtitle"),
  purchaseDraftTotal: $("#purchaseDraftTotal"),
  purchaseDraftList: $("#purchaseDraftList"),
  savePurchaseInvoiceButton: $("#savePurchaseInvoiceButton"),
  clearPurchaseInvoiceButton: $("#clearPurchaseInvoiceButton"),
  purchaseEditCancelButton: $("#purchaseEditCancelButton"),
  purchaseSearchInput: $("#purchaseSearchInput"),
  purchaseTotalBox: $("#purchaseTotalBox"),
  purchasesList: $("#purchasesList"),
  inventorySearchInput: $("#inventorySearchInput"),
  inventoryScopeInput: $("#inventoryScopeInput"),
  inventoryNoteInput: $("#inventoryNoteInput"),
  inventoryFillButton: $("#inventoryFillButton"),
  inventorySaveButton: $("#inventorySaveButton"),
  inventoryStockSummary: $("#inventoryStockSummary"),
  inventoryStockList: $("#inventoryStockList"),
  inventorySummary: $("#inventorySummary"),
  inventoryList: $("#inventoryList"),
  inventoryHistoryList: $("#inventoryHistoryList"),
  menuForm: $("#menuForm"),
  menuFormTitle: $("#menuFormTitle"),
  menuNameInput: $("#menuNameInput"),
  menuPriceInput: $("#menuPriceInput"),
  menuCostInput: $("#menuCostInput"),
  menuCategoryInput: $("#menuCategoryInput"),
  menuComponentItemInput: $("#menuComponentItemInput"),
  menuComponentQtyInput: $("#menuComponentQtyInput"),
  menuComponentAddButton: $("#menuComponentAddButton"),
  menuComponentsList: $("#menuComponentsList"),
  menuSubmitButton: $("#menuSubmitButton"),
  menuCancelEditButton: $("#menuCancelEditButton"),
  settingsMenuSearchInput: $("#settingsMenuSearchInput"),
  menuStatsDateFromInput: $("#menuStatsDateFromInput"),
  menuStatsDateToInput: $("#menuStatsDateToInput"),
  menuStatsRangeText: $("#menuStatsRangeText"),
  menuStatsSummary: $("#menuStatsSummary"),
  settingsMenuList: $("#settingsMenuList"),
  menuExcelExportButton: $("#menuExcelExportButton"),
  menuExcelImportInput: $("#menuExcelImportInput"),
  closePeriodFrom: $("#closePeriodFrom"),
  closePeriodTo: $("#closePeriodTo"),
  closePeriodDays: $("#closePeriodDays"),
  closePeriodCalcButton: $("#closePeriodCalcButton"),
  closePeriodResult: $("#closePeriodResult"),
  closeWorkerSubtitle: $("#closeWorkerSubtitle"),
  closeWorkersTable: $("#closeWorkersTable"),
  closePayAllButton: $("#closePayAllButton"),
  closeGoInventoryButton: $("#closeGoInventoryButton"),
  closeInventorySubtitle: $("#closeInventorySubtitle"),
  closeInventoryInfo: $("#closeInventoryInfo"),
  closeSummary: $("#closeSummary"),
  lastCloseBanner: $("#lastCloseBanner"),
  closeApproveButton: $("#closeApproveButton"),
  closeOverlapWarning: $("#closeOverlapWarning"),
  closeHistoryList: $("#closeHistoryList"),
  closeWithdrawAmount: $("#closeWithdrawAmount"),
  closeWithdrawMethod: $("#closeWithdrawMethod"),
  closeWithdrawButton: $("#closeWithdrawButton"),
  closeWithdrawList: $("#closeWithdrawList"),
  backupReminderBanner: $("#backupReminderBanner"),
  backupNowButton: $("#backupNowButton"),
  backupLaterButton: $("#backupLaterButton"),
  dayReportButton: $("#dayReportButton"),
  reportTopItemsList: $("#reportTopItemsList"),
  reportHoursChart: $("#reportHoursChart"),
  lowStockPanel: $("#lowStockPanel"),
  lowStockList: $("#lowStockList"),
  lowStockThresholdInput: $("#lowStockThresholdInput"),
  quickPayFullButton: $("#quickPayFullButton"),
  brandTitle: $("#brandTitle"),
  brandMark: $("#brandMark"),
  businessNameInput: $("#businessNameInput"),
  businessNameSaveButton: $("#businessNameSaveButton"),
  guideLive: $("#guideLive"),
  guideBackupButton: $("#guideBackupButton"),
  guideShareButton: $("#guideShareButton"),
  guideImportInput: $("#guideImportInput"),
  guideBackupStatus: $("#guideBackupStatus"),
  mobileMoreButton: $("#mobileMoreButton"),
  mobileMoreSheet: $("#mobileMoreSheet"),
  mobileMoreBackdrop: $("#mobileMoreBackdrop"),
  mobileMoreClose: $("#mobileMoreClose"),
  confirmModal: $("#confirmModal"),
  confirmBackdrop: $("#confirmBackdrop"),
  confirmIcon: $("#confirmIcon"),
  confirmMessage: $("#confirmMessage"),
  confirmYesButton: $("#confirmYesButton"),
  confirmCancelButton: $("#confirmCancelButton"),
  toast: $("#toast"),
  printTemplate: $("#printTemplate")
};

let _confirmResolver = null;

function appConfirm(message, options = {}) {
  return new Promise((resolve) => {
    if (!els.confirmModal) { resolve(window.confirm(message)); return; }
    _confirmResolver = resolve;
    els.confirmMessage.textContent = message;
    els.confirmIcon.textContent = options.icon || "⚠️";
    els.confirmYesButton.textContent = options.yesLabel || "تأكيد";
    els.confirmCancelButton.textContent = options.cancelLabel || "إلغاء";
    els.confirmYesButton.classList.toggle("is-danger", options.danger !== false);
    els.confirmModal.hidden = false;
  });
}

function resolveAppConfirm(value) {
  if (els.confirmModal) els.confirmModal.hidden = true;
  const resolver = _confirmResolver;
  _confirmResolver = null;
  if (resolver) resolver(value);
}

function defaultState() {
  return {
    selectedTable: 1,
    tableCount: DEFAULT_TABLE_COUNT,
    tableNames: {},
    lastPaymentMethod: "cash",
    lastWorkerTransactionType: WORKER_ADVANCE_TYPE,
    lastWorkerConsumptionMode: "worker_price",
    menu: normalizeMenuItems(defaultMenu),
    customers: [],
    workers: [],
    openOrders: {},
    invoices: [],
    purchases: [],
    expenses: [],
    workerConsumptions: [],
    workerTransactions: [],
    inventoryCounts: [],
    purchaseInventoryAdjustments: {},
    customerPrices: [],
    periodCloses: [],
    lowStockThreshold: 5,
    openingCash: { cash: 0, bank: 0, wallet: 0 },
    cashAdjustments: [],
    ownerWithdrawals: [],
    businessName: "دفتر المقهى"
  };
}

function normalizeOpeningCash(value) {
  // ترحيل: لو كان رقم واحد قديم، نحطه كله كاش
  if (typeof value === "number") return { cash: value, bank: 0, wallet: 0 };
  const v = value && typeof value === "object" ? value : {};
  return {
    cash: Number(v.cash || 0),
    bank: Number(v.bank || 0),
    wallet: Number(v.wallet || 0)
  };
}

function normalizeState(parsed = {}) {
  const fallback = defaultState();
  const next = {
    ...fallback,
    ...parsed,
    tableCount: Number(parsed.tableCount || DEFAULT_TABLE_COUNT),
    tableNames: parsed.tableNames || {},
    lastPaymentMethod: paymentMethods.includes(parsed.lastPaymentMethod) ? parsed.lastPaymentMethod : "cash",
    lastWorkerTransactionType: workerTransactionTypeLabels[parsed.lastWorkerTransactionType] ? parsed.lastWorkerTransactionType : WORKER_ADVANCE_TYPE,
    lastWorkerConsumptionMode: ["worker_price", SALARY_WORKER_CONSUMPTION_TYPE, FREE_WORKER_CONSUMPTION_TYPE].includes(parsed.lastWorkerConsumptionMode) ? parsed.lastWorkerConsumptionMode : "worker_price",
    menu: normalizeMenuItems(parsed.menu?.length ? parsed.menu : defaultMenu),
    customers: Array.isArray(parsed.customers) ? parsed.customers : [],
    workers: Array.isArray(parsed.workers) ? parsed.workers.map(normalizeWorker) : [],
    openOrders: parsed.openOrders || {},
    invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [],
    purchases: Array.isArray(parsed.purchases) ? parsed.purchases : [],
    expenses: Array.isArray(parsed.expenses) ? parsed.expenses.map(normalizeExpense) : [],
    workerConsumptions: Array.isArray(parsed.workerConsumptions) ? parsed.workerConsumptions.map(normalizeWorkerConsumption) : [],
    workerTransactions: Array.isArray(parsed.workerTransactions) ? parsed.workerTransactions.map(normalizeWorkerTransaction) : [],
    inventoryCounts: Array.isArray(parsed.inventoryCounts) ? parsed.inventoryCounts : [],
    purchaseInventoryAdjustments: parsed.purchaseInventoryAdjustments && typeof parsed.purchaseInventoryAdjustments === "object" ? parsed.purchaseInventoryAdjustments : {},
    customerPrices: Array.isArray(parsed.customerPrices) ? parsed.customerPrices : [],
    periodCloses: Array.isArray(parsed.periodCloses) ? parsed.periodCloses : [],
    lowStockThreshold: Number.isFinite(Number(parsed.lowStockThreshold)) ? Number(parsed.lowStockThreshold) : 5,
    openingCash: normalizeOpeningCash(parsed.openingCash),
    cashAdjustments: Array.isArray(parsed.cashAdjustments) ? parsed.cashAdjustments : [],
    ownerWithdrawals: Array.isArray(parsed.ownerWithdrawals) ? parsed.ownerWithdrawals : [],
    businessName: (typeof parsed.businessName === "string" && parsed.businessName.trim()) ? parsed.businessName.trim() : "دفتر المقهى"
  };
  next.workers = reconcileWorkers(next.workers, next.workerConsumptions, next.workerTransactions);
  next.tableCount = Math.max(1, Math.floor(Number(next.tableCount || DEFAULT_TABLE_COUNT)));
  next.selectedTable = Math.min(Math.max(Number(next.selectedTable || 1), 1), next.tableCount);
  workerConsumptionMode = next.lastWorkerConsumptionMode;
  return next;
}

function parseBackupSnapshot(raw) {
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  return parsed?.payload ? JSON.parse(parsed.payload) : parsed;
}

function loadLocalBackupState() {
  try {
    const autoBackup = parseBackupSnapshot(localStorage.getItem(AUTO_BACKUP_KEY));
    if (autoBackup) return normalizeState(autoBackup);

    const history = JSON.parse(localStorage.getItem(BACKUP_HISTORY_KEY) || "[]");
    const latest = Array.isArray(history) ? history.find((entry) => entry?.payload) : null;
    return latest ? normalizeState(JSON.parse(latest.payload)) : null;
  } catch (error) {
    console.warn("Could not load backup data", error);
    return null;
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const backup = loadLocalBackupState();
      if (backup) return backup;
      stateNeedsBackupRecovery = true;
      return defaultState();
    }
    return normalizeState(JSON.parse(raw));
  } catch (error) {
    console.warn("Could not load saved data", error);
    const backup = loadLocalBackupState();
    if (backup) return backup;
    stateNeedsBackupRecovery = true;
    return defaultState();
  }
}

function saveState() {
  const serialized = JSON.stringify(state);
  try {
    localStorage.setItem(STORAGE_KEY, serialized);
    saveLocalBackup(serialized);
  } catch (error) {
    console.warn("Could not save browser storage", error);
  }
  if (!stateNeedsBackupRecovery || businessRecordCount(state) > 0) {
    queueDurableBackup(serialized);
  }
}

function businessRecordCount(data = state) {
  const openOrderCount = Object.values(data.openOrders || {}).filter((order) => order.items?.length).length;
  return Number(data.customers?.length || 0)
    + Number(data.workers?.length || 0)
    + Number(data.invoices?.length || 0)
    + Number(data.purchases?.length || 0)
    + Number(data.workerConsumptions?.length || 0)
    + Number(data.workerTransactions?.length || 0)
    + Number(data.inventoryCounts?.length || 0)
    + openOrderCount;
}

function backupSnapshot(serialized) {
  return {
    createdAt: new Date().toISOString(),
    payload: serialized,
    recordCount: businessRecordCount(state)
  };
}

function saveLocalBackup(serialized) {
  try {
    const snapshot = backupSnapshot(serialized);
    localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(snapshot));

    const history = JSON.parse(localStorage.getItem(BACKUP_HISTORY_KEY) || "[]");
    const nextHistory = Array.isArray(history) ? history : [];
    const last = nextHistory[0];
    const lastTime = last?.createdAt ? new Date(last.createdAt).getTime() : 0;
    const now = new Date(snapshot.createdAt).getTime();

    if (!last || last.payload !== serialized) {
      if (now - lastTime < 10 * 60 * 1000) nextHistory[0] = snapshot;
      else nextHistory.unshift(snapshot);
    }

    localStorage.setItem(BACKUP_HISTORY_KEY, JSON.stringify(nextHistory.slice(0, MAX_BACKUP_HISTORY)));
  } catch (error) {
    console.warn("Could not save local backup", error);
  }
}

function openBackupDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    const request = indexedDB.open(BACKUP_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(BACKUP_STORE_NAME)) {
        database.createObjectStore(BACKUP_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function writeDurableBackup(snapshot) {
  const database = await openBackupDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(BACKUP_STORE_NAME, "readwrite");
    const store = transaction.objectStore(BACKUP_STORE_NAME);
    store.put({ id: "latest", ...snapshot });
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

function queueDurableBackup(serialized) {
  clearTimeout(backupWriteTimer);
  backupWriteTimer = setTimeout(() => {
    writeDurableBackup(backupSnapshot(serialized)).catch((error) => {
      console.warn("Could not save durable backup", error);
    });
  }, 250);
}

async function readDurableBackup() {
  const database = await openBackupDatabase();
  const snapshot = await new Promise((resolve, reject) => {
    const transaction = database.transaction(BACKUP_STORE_NAME, "readonly");
    const request = transaction.objectStore(BACKUP_STORE_NAME).get("latest");
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return snapshot;
}

async function recoverFromDurableBackup() {
  if (!stateNeedsBackupRecovery) return;

  try {
    const snapshot = await readDurableBackup();
    if (!snapshot?.payload) {
      stateNeedsBackupRecovery = false;
      return;
    }

    const recoveredState = normalizeState(JSON.parse(snapshot.payload));
    if (businessRecordCount(recoveredState) <= businessRecordCount(state)) {
      stateNeedsBackupRecovery = false;
      return;
    }

    state = recoveredState;
    stateNeedsBackupRecovery = false;
    selectedCustomerId = state.customers[0]?.id || null;
    selectedWorkerId = state.workers[0]?.id || null;
    lastClosedInvoice = state.invoices[0] || null;
    setLastPaymentMethod(getLastPaymentMethod());
    showToast("تم استعادة بياناتك من نسخة احتياطية تلقائياً.");
    render();
  } catch (error) {
    stateNeedsBackupRecovery = false;
    console.warn("Could not recover durable backup", error);
  }
}
