// ═══ دفتر المقهى ═══ 12-init.js — ربط الأحداث وتشغيل التطبيق
// (مقسوم من app.js — الأسطر 5519-5929)

function wireEvents() {
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      state.view = tab.dataset.view;
      render();
    });
  });

  els.tablesGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-table]");
    if (button) selectTable(button.dataset.table);
  });

  els.newOrderButton.addEventListener("click", () => {
    state.openOrders[String(state.selectedTable)] = {
      id: uid("order"),
      tableId: state.selectedTable,
      customerId: null,
      customerName: "",
      customerPhone: "",
      items: [],
      discount: 0,
      paymentMethod: getLastPaymentMethod(),
      payments: { cash: 0, bank: 0, wallet: 0 },
      note: "",
      createdAt: new Date().toISOString()
    };
    render();
  });

  els.addTableButton.addEventListener("click", addTable);
  els.deleteTableButton.addEventListener("click", deleteSelectedTable);

  els.tableNameInput.addEventListener("input", () => {
    setTableLabel(state.selectedTable, els.tableNameInput.value);
    renderTables();
    saveState();
  });

  els.customerSelect.addEventListener("change", () => {
    const order = getOpenOrder();
    const customer = getCustomer(els.customerSelect.value);
    if (!customer) {
      order.customerId = null;
      order.customerName = "";
      order.customerPhone = "";
      els.customerNameInput.value = "";
      els.customerPhoneInput.value = "";
    } else {
      order.customerId = customer.id;
      order.customerName = customer.name;
      order.customerPhone = customer.phone || "";
      selectedCustomerId = customer.id;
    }
    render();
  });

  els.customerSuggestions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-suggest-customer]");
    if (button) chooseSuggestedCustomer(button.dataset.suggestCustomer);
  });

  els.saveCustomerButton.addEventListener("click", () => {
    const customer = upsertCustomer(els.customerNameInput.value, { phone: els.customerPhoneInput.value.trim() });
    if (!customer) {
      showToast("اكتب اسم العميل أولاً.");
      return;
    }
    const order = getOpenOrder();
    order.customerId = customer.id;
    order.customerName = customer.name;
    order.customerPhone = customer.phone || "";
    selectedCustomerId = customer.id;
  showToast("تم حفظ العميل في الطلب.");
    render();
  });

  window.addEventListener("beforeunload", saveState);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveState();
  });

  els.menuCategories.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    selectedCategory = button.dataset.category;
    renderMenu();
  });

  els.menuGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-menu-item]");
    if (button) addItem(button.dataset.menuItem);
  });

  els.orderItems.addEventListener("click", (event) => {
    const button = event.target.closest("[data-line-action]");
    if (button) updateLine(button.dataset.item, button.dataset.lineAction);
  });

  els.clearOrderButton.addEventListener("click", () => {
    const order = getOpenOrder();
    order.items = [];
    order.discount = 0;
    order.payments = { cash: 0, bank: 0, wallet: 0 };
    order.note = "";
    render();
  });

  const previewOrderChange = () => {
    syncOrderFields();
    renderStats();
    renderTables();
    renderOrderTotals();
    saveState();
  };

  els.customerNameInput.addEventListener("input", () => {
    syncCustomerFromNameInput();
    renderCustomerSuggestions();
    previewOrderChange();
  });

  els.customerNameInput.addEventListener("focus", renderCustomerSuggestions);

  document.addEventListener("click", (event) => {
    if (!event.target.closest("#customerNameInput") && !event.target.closest("#customerSuggestions")) {
      els.customerSuggestions.classList.remove("is-visible");
    }
  });

  [els.customerPhoneInput, els.discountInput, els.paymentAmountInput, els.noteInput].forEach((input) => {
    input.addEventListener("input", previewOrderChange);
  });
  els.paymentMethodInput.addEventListener("change", previewOrderChange);
  els.settlementMethodInput.addEventListener("change", () => {
    setLastPaymentMethod(els.settlementMethodInput.value);
    saveState();
  });
  els.purchaseMethodInput.addEventListener("change", () => {
    setLastPaymentMethod(els.purchaseMethodInput.value);
    saveState();
  });

  els.menuSearchInput.addEventListener("input", renderMenu);
  els.customItemForm.addEventListener("submit", addCustomItem);
  els.closeInvoiceButton.addEventListener("click", closeInvoice);
  els.quickPayFullButton.addEventListener("click", quickPayFillFull);
  els.printButton.addEventListener("click", printLastInvoice);
  els.customerAddForm.addEventListener("submit", addCustomerFromCustomersPage);
  els.customerSearchInput.addEventListener("input", renderCustomers);
  els.customerStatusFilter.addEventListener("change", renderCustomers);
  els.customerStatementButton.addEventListener("click", printCustomerStatement);
  if (els.customerExcelExportButton) els.customerExcelExportButton.addEventListener("click", exportCustomersExcel);
  if (els.customerExcelImportInput) els.customerExcelImportInput.addEventListener("change", (event) => importCustomersExcel(event.target.files[0]));
  els.customersList.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-remove-customer]");
    if (deleteButton) {
      deleteCustomer(deleteButton.dataset.removeCustomer);
      return;
    }

    const button = event.target.closest("[data-customer-card]");
    if (!button) return;
    selectedCustomerId = button.dataset.customerCard;
    render();
  });
  els.settlementForm.addEventListener("submit", recordSettlement);
  els.cpAddButton.addEventListener("click", () => {
    const itemId = els.cpItemSelect.value;
    const price = Number(els.cpPriceInput.value);
    if (!selectedCustomerId) { showToast("اختر عميل أولاً."); return; }
    if (!itemId) { showToast("اختر صنف."); return; }
    if (isNaN(price) || price < 0) { showToast("اكتب سعر صحيح."); return; }
    setCustomerItemPrice(selectedCustomerId, itemId, price);
    els.cpPriceInput.value = "";
    els.cpItemSelect.value = "";
    showToast("تم حفظ السعر الخاص.");
    saveState();
    renderCustomerPrices();
    renderMenu();
  });

  els.customerPricesList.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-cp-remove]");
    if (!btn || !selectedCustomerId) return;
    removeCustomerItemPrice(selectedCustomerId, btn.dataset.cpRemove);
    showToast("تم حذف السعر الخاص.");
    saveState();
    renderCustomerPrices();
    renderMenu();
  });

  els.ledgerList.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-customer-ledger]");
    if (editButton) {
      state.view = "invoices";
      render();
      startEditInvoice(editButton.dataset.editCustomerLedger);
      return;
    }

    const deleteButton = event.target.closest("[data-delete-customer-ledger]");
    if (deleteButton) deleteInvoice(deleteButton.dataset.deleteCustomerLedger);
  });

  els.settlementModePayment.addEventListener("click", () => {
    settlementDebtMode = false;
    applySettlementMode(getCustomer(selectedCustomerId));
  });
  els.settlementModeDebt.addEventListener("click", () => {
    settlementDebtMode = true;
    applySettlementMode(getCustomer(selectedCustomerId));
  });
  els.invoiceSearchInput.addEventListener("input", renderInvoices);
  els.invoiceStatusFilter.addEventListener("change", renderInvoices);
  els.invoiceDateFromInput.addEventListener("change", renderInvoices);
  els.invoiceDateToInput.addEventListener("change", renderInvoices);
  els.invoiceDateSortInput.addEventListener("change", renderInvoices);
  els.invoiceEditForm.addEventListener("submit", saveEditedInvoice);
  els.invoiceEditCancelButton.addEventListener("click", cancelInvoiceEdit);
  els.invoiceEditAddMenuItemButton.addEventListener("click", addInvoiceEditMenuItem);
  els.invoiceEditAddCustomButton.addEventListener("click", addInvoiceEditCustomItem);
  els.invoiceEditItemsList.addEventListener("input", (event) => {
    if (event.target.closest("[data-invoice-edit-name], [data-invoice-edit-qty], [data-invoice-edit-price]")) {
      updateInvoiceEditItemTotals(Boolean(event.target.closest("[data-invoice-edit-qty], [data-invoice-edit-price]")));
    }
  });
  els.invoiceEditItemsList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-invoice-edit-item]");
    if (button) removeInvoiceEditItem(button.dataset.removeInvoiceEditItem);
  });
  els.reportDateFromInput.addEventListener("change", () => { renderReports(); renderTopItemsAndPeakHours(); });
  els.reportDateToInput.addEventListener("change", () => { renderReports(); renderTopItemsAndPeakHours(); });
  els.dayReportButton.addEventListener("click", printDayReport);
  els.backupNowButton.addEventListener("click", exportData);
  els.backupLaterButton.addEventListener("click", snoozeBackupReminder);
  els.lowStockThresholdInput.addEventListener("change", () => {
    state.lowStockThreshold = Math.max(0, Number(els.lowStockThresholdInput.value || 0));
    saveState();
    renderLowStock();
  });
  els.expenseForm.addEventListener("submit", recordExpense);
  if (els.consumptionTypeToggle) {
    els.consumptionTypeToggle.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-consumption-type]");
      if (btn) setConsumptionMode(btn.dataset.consumptionType);
    });
  }
  els.workerItemInput.addEventListener("change", fillWorkerItemCost);
  els.expenseMethodInput.addEventListener("change", () => {
    setLastPaymentMethod(els.expenseMethodInput.value);
    saveState();
  });
  els.workerTransactionForm.addEventListener("submit", recordWorkerTransaction);
  els.workerTransactionTypeInput.addEventListener("change", () => {
    state.lastWorkerTransactionType = workerTransactionTypeLabels[els.workerTransactionTypeInput.value]
      ? els.workerTransactionTypeInput.value
      : WORKER_ADVANCE_TYPE;
    saveState();
    renderWorkerTransactionTypeState(workerMonthlyAccount(getWorker(selectedWorkerId)));
  });
  els.workerTransactionMethodInput.addEventListener("change", () => {
    setLastPaymentMethod(els.workerTransactionMethodInput.value);
    saveState();
  });
  els.workerAddForm.addEventListener("submit", addWorkerFromWorkersPage);
  els.workerSearchInput.addEventListener("input", renderExpenses);
  els.workerStatusFilter.addEventListener("change", renderExpenses);
  if (els.workerOwnPeriodInput) els.workerOwnPeriodInput.addEventListener("change", () => setWorkerOwnPeriod(els.workerOwnPeriodInput.value));
  if (els.workerOwnPeriodResetButton) els.workerOwnPeriodResetButton.addEventListener("click", resetWorkerOwnPeriod);
  els.workersList.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-remove-worker]");
    if (deleteButton) {
      deleteWorker(deleteButton.dataset.removeWorker);
      return;
    }

    const button = event.target.closest("[data-worker-card]");
    if (!button) return;
    selectedWorkerId = button.dataset.workerCard;
    render();
  });
  els.workerLedgerList.addEventListener("click", (event) => {
    const expenseButton = event.target.closest("[data-remove-expense]");
    if (expenseButton) {
      deleteExpense(expenseButton.dataset.removeExpense);
      return;
    }

    const transactionButton = event.target.closest("[data-remove-worker-transaction]");
    if (transactionButton) deleteWorkerTransaction(transactionButton.dataset.removeWorkerTransaction);
  });
  els.invoiceTableBody.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-invoice]");
    if (editButton) {
      startEditInvoice(editButton.dataset.editInvoice);
      return;
    }

    const printButton = event.target.closest("[data-print-invoice]");
    if (printButton) {
      printInvoiceById(printButton.dataset.printInvoice);
      return;
    }

    const button = event.target.closest("[data-delete-invoice]");
    if (!button) return;
    deleteInvoice(button.dataset.deleteInvoice);
  });
  els.invoiceExcelExportButton.addEventListener("click", exportInvoicesExcel);
  els.invoiceExcelImportInput.addEventListener("change", (event) => importInvoicesExcel(event.target.files[0]));
  els.menuExcelExportButton.addEventListener("click", exportMenuExcel);
  els.menuExcelImportInput.addEventListener("change", (event) => importMenuExcel(event.target.files[0]));

  // Period Close
  els.closePeriodFrom.addEventListener("change", onClosePeriodDateChange);
  els.closePeriodTo.addEventListener("change", onClosePeriodDateChange);
  els.closePeriodCalcButton.addEventListener("click", calcPeriodClose);
  els.closePayAllButton.addEventListener("click", closePayAll);
  if (els.confirmYesButton) els.confirmYesButton.addEventListener("click", () => resolveAppConfirm(true));
  if (els.confirmCancelButton) els.confirmCancelButton.addEventListener("click", () => resolveAppConfirm(false));
  if (els.confirmBackdrop) els.confirmBackdrop.addEventListener("click", () => resolveAppConfirm(false));
  if (els.mobileMoreButton) els.mobileMoreButton.addEventListener("click", openMoreSheet);
  if (els.mobileMoreBackdrop) els.mobileMoreBackdrop.addEventListener("click", closeMoreSheet);
  if (els.mobileMoreClose) els.mobileMoreClose.addEventListener("click", closeMoreSheet);
  if (els.mobileMoreSheet) els.mobileMoreSheet.addEventListener("click", (event) => {
    if (event.target.closest("[data-view]")) closeMoreSheet();
  });
  if (els.guideShareButton) els.guideShareButton.addEventListener("click", shareBackup);
  if (els.guideBackupButton) els.guideBackupButton.addEventListener("click", exportData);
  if (els.guideImportInput) els.guideImportInput.addEventListener("change", (event) => importData(event.target.files[0]));
  if (els.businessNameSaveButton) els.businessNameSaveButton.addEventListener("click", saveBusinessName);
  if (els.businessNameInput) els.businessNameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); saveBusinessName(); } });
  els.closeApproveButton.addEventListener("click", approvePeriodClose);
  if (els.closeWithdrawButton) els.closeWithdrawButton.addEventListener("click", recordCloseWithdrawal);
  if (els.closeWithdrawList) {
    els.closeWithdrawList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-withdrawal]");
      if (button) removeOwnerWithdrawal(button.dataset.removeWithdrawal);
    });
  }
  els.closeHistoryList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-period-close]");
    if (button) { removePeriodClose(button.dataset.removePeriodClose); return; }
    const head = event.target.closest("[data-toggle-close]");
    if (head) toggleCloseDetail(head.dataset.toggleClose);
  });
  els.closeGoInventoryButton.addEventListener("click", () => {
    state.view = "inventory";
    render();
  });

  els.exportButton.addEventListener("click", exportData);
  els.importInput.addEventListener("change", (event) => importData(event.target.files[0]));
  els.purchaseForm.addEventListener("submit", addPurchase);
  els.generalExpenseForm.addEventListener("submit", recordGeneralExpense);
  els.generalExpenseMethodInput.addEventListener("change", () => {
    setLastPaymentMethod(els.generalExpenseMethodInput.value);
    saveState();
  });
  els.purchaseMenuItemInput.addEventListener("change", syncPurchaseMenuItem);
  els.purchaseQtyInput.addEventListener("input", renderPurchaseUnitCost);
  els.purchaseUnitInput.addEventListener("input", renderPurchaseUnitCost);
  els.purchaseStockQtyInput.addEventListener("input", renderPurchaseUnitCost);
  els.purchaseStockUnitInput.addEventListener("input", renderPurchaseUnitCost);
  els.purchaseAmountInput.addEventListener("input", renderPurchaseUnitCost);
  els.savePurchaseInvoiceButton.addEventListener("click", savePurchaseInvoice);
  els.clearPurchaseInvoiceButton.addEventListener("click", clearPurchaseDraft);
  els.purchaseEditCancelButton.addEventListener("click", cancelPurchaseEdit);
  els.purchaseDraftList.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-purchase-draft]");
    if (editButton) {
      editPurchaseDraftLine(editButton.dataset.editPurchaseDraft);
      return;
    }
    const button = event.target.closest("[data-remove-purchase-draft]");
    if (button) removePurchaseDraftLine(button.dataset.removePurchaseDraft);
  });
  els.purchaseSearchInput.addEventListener("input", renderPurchases);
  els.purchasesList.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-purchase]");
    if (editButton) {
      startEditPurchase(editButton.dataset.editPurchase);
      return;
    }

    const button = event.target.closest("[data-remove-purchase]");
    if (button) removePurchase(button.dataset.removePurchase);
  });
  els.generalExpensesList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-general-expense]");
    if (button) removeGeneralExpense(button.dataset.removeGeneralExpense);
  });
  els.inventorySearchInput.addEventListener("input", renderInventory);
  els.inventoryScopeInput.addEventListener("change", renderInventory);
  els.inventoryFillButton.addEventListener("click", fillInventoryFromSystem);
  els.inventorySaveButton.addEventListener("click", saveInventoryCount);
  els.inventoryHistoryList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-inventory-count]");
    if (button) removeInventoryCount(button.dataset.removeInventoryCount);
  });
  els.inventoryList.addEventListener("input", (event) => {
    if (event.target.closest("[data-inventory-actual], [data-inventory-note]")) {
      updateInventoryCalculations();
    }
  });
  els.menuComponentAddButton.addEventListener("click", addMenuComponent);
  els.menuComponentsList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-component]");
    if (!button) return;
    menuComponentDraft = menuComponentDraft.filter((component) => component.id !== button.dataset.removeComponent);
    renderMenuComponentsEditor();
  });
  els.menuForm.addEventListener("submit", saveMenuItem);
  els.menuOperatingCostInput.addEventListener("input", renderMenuComponentsEditor);
  els.menuOperatingCostTypeInput.addEventListener("change", renderMenuComponentsEditor);
  els.menuCancelEditButton.addEventListener("click", () => {
    setMenuFormMode();
    render();
  });
  els.menuStatsDateFromInput.addEventListener("change", renderSettingsMenu);
  els.menuStatsDateToInput.addEventListener("change", renderSettingsMenu);
  els.settingsMenuSearchInput.addEventListener("input", renderSettingsMenu);
  els.settingsMenuList.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-menu]");
    if (editButton) {
      editMenuItem(editButton.dataset.editMenu);
      return;
    }
    const removeButton = event.target.closest("[data-remove-menu]");
    if (removeButton) removeMenuItem(removeButton.dataset.removeMenu);
  });
}

// تهيئة الحالة (كانت في أول app.js — انتقلت هنا لأن loadState يحتاج دوال من كل الملفات)
state = loadState();
selectedCustomerId = state.customers[0]?.id || null;
selectedWorkerId = state.workers[0]?.id || null;
lastClosedInvoice = state.invoices[0] || null;

wireEvents();
state.view = state.view || "pos";
setLastPaymentMethod(getLastPaymentMethod());
getOpenOrder();
render();
recoverFromDurableBackup();

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  navigator.serviceWorker.register("./service-worker.js", { updateViaCache: "none" })
    .then((registration) => {
      registration.update();

      if (registration.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }

      registration.addEventListener("updatefound", () => {
        const nextWorker = registration.installing;
        if (!nextWorker) return;

        nextWorker.addEventListener("statechange", () => {
          if (nextWorker.state === "installed" && navigator.serviceWorker.controller) {
            nextWorker.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });
    })
    .catch(() => {});
}

// ─── حارس التبويب الواحد: منع فتح البرنامج بتبويبين ─────────────────────────

if (typeof BroadcastChannel !== "undefined") {
  const tabGuardChannel = new BroadcastChannel("cafe-pos-tab-guard");
  let tabGuardBlocked = false;

  function showTabGuardOverlay() {
    if (document.getElementById("tabGuardOverlay")) return;
    tabGuardBlocked = true;
    const overlay = document.createElement("div");
    overlay.id = "tabGuardOverlay";
    overlay.className = "tab-guard-overlay";
    overlay.innerHTML = `
      <div class="tab-guard-box">
        <div class="tab-guard-icon">⚠️</div>
        <h2>البرنامج مفتوح في مكان آخر</h2>
        <p>دفتر المقهى مفتوح في تبويب أو نافذة ثانية. الشغل على نسختين بنفس الوقت بيخرب البيانات — آخر نسخة بتحفظ بتمسح تعديلات الثانية.</p>
        <p><strong>أغلق هذا التبويب واشتغل على التبويب الأول.</strong></p>
        <button class="tab-guard-force" type="button">أعرف المخاطر — استخدم هذا التبويب</button>
      </div>
    `;
    overlay.querySelector(".tab-guard-force").addEventListener("click", () => {
      tabGuardBlocked = false;
      overlay.remove();
    });
    document.body.appendChild(overlay);
  }

  tabGuardChannel.onmessage = (event) => {
    if (event.data === "hello" && !tabGuardBlocked) {
      // في تبويب جديد فتح — أعلمه إني موجود
      tabGuardChannel.postMessage("taken");
    } else if (event.data === "taken") {
      // في تبويب أقدم شغال — احجب هذا التبويب
      showTabGuardOverlay();
    }
  };

  tabGuardChannel.postMessage("hello");
}
