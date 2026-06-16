// ═══ دفتر المقهى ═══ 03-pos.js — شاشة البيع: الطاولات، الطلب، المنيو، مسودة المشتريات
// (مقسوم من app.js — الأسطر 1456-1963)

function render() {
  renderStats();
  renderTodayCashStrip();
  renderTabs();
  renderTables();
  renderCustomerSelect();
  renderOrder();
  renderMenu();
  renderPurchaseItemSelect();
  renderCustomers();
  renderCustomerDetail();
  renderInvoices();
  renderReports();
  renderExpenses();
  renderPurchaseDraft();
  renderPurchaseUnitCost();
  renderPurchases();
  renderInventory();
  renderMenuComponentsEditor();
  renderSettingsMenu();
  renderCloseInfo();
  renderLowStock();
  renderTopItemsAndPeakHours();
  renderBackupReminder();
  applyBusinessName();
  renderGuide();
  saveState();
}

function renderTabs() {
  els.tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === state.view));
  els.views.forEach((view) => view.classList.toggle("is-active", view.id === `view-${state.view || "pos"}`));
  const onInvoices = (state.view || "pos") === "invoices";
  els.statsStrip.hidden = !onInvoices;
  if (els.todayCashStrip) els.todayCashStrip.hidden = !onInvoices;
  if (typeof syncMobileMoreActive === "function") syncMobileMoreActive();
}

function renderTodayCashStrip() {
  if (!els.todayCashStrip) return;
  const box = todayCashBox();
  const cards = cashMethodMeta.map(({ key, label, icon }) => {
    const m = box.methods[key];
    return `
      <article class="today-cash-card ${m.net >= 0 ? "" : "is-negative"}">
        <span>${icon} ${label}</span>
        <strong>${money(m.in)}</strong>
        <small>صافي ${money(m.net)} | طلع ${money(m.out)}</small>
      </article>
    `;
  }).join("");
  els.todayCashStrip.innerHTML = `
    <article class="today-cash-card is-income">
      <span>💰 دخل اليوم فعلياً</span>
      <strong>${money(box.total.in)}</strong>
      <small>بيع ${money(box.total.saleIn)} + ديون ${money(box.total.debtIn)}${box.total.workerIn > 0.001 ? ` + عمال ${money(box.total.workerIn)}` : ""}</small>
    </article>
    <article class="today-cash-card is-total ${box.total.net >= 0 ? "" : "is-negative"}">
      <span>⚖ صافي صندوق اليوم</span>
      <strong>${money(box.total.net)}</strong>
      <small>دخل ${money(box.total.in)} − طلع ${money(box.total.out)}</small>
    </article>
    ${cards}`;
}

function renderStats() {
  const todayKey = todayDateInputValue();
  const todaySaleInvoices = state.invoices
    .filter((invoice) => invoice.type === "sale" && invoice.createdAt.slice(0, 10) === todayKey);
  const todaySales = todaySaleInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
  const todayPurchases = state.purchases
    .filter((purchase) => purchase.createdAt.slice(0, 10) === todayKey)
    .reduce((sum, purchase) => sum + purchaseAmount(purchase), 0);
  const todayGeneralExpenses = (state.expenses || [])
    .filter((expense) => expense.createdAt.slice(0, 10) === todayKey)
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const todayItemProfit = todaySaleInvoices.reduce((sum, invoice) => sum + invoiceItemProfit(invoice), 0);
  const todayWorkerSummary = workerConsumptionTotals((state.workerConsumptions || []).filter((entry) => {
    return entry.createdAt.slice(0, 10) === todayKey;
  }));
  const todayWorkerTransactionSummary = workerTransactionTotals(activeWorkerTransactions().filter((entry) => {
    return entry.createdAt.slice(0, 10) === todayKey;
  }));
  const todayNetProfit = todayItemProfit + todayWorkerSummary.net - todayWorkerTransactionSummary.advances - todayWorkerTransactionSummary.salaryPaid - todayGeneralExpenses;

  els.statTodaySales.textContent = money(todaySales);
  els.statTodayPurchases.textContent = money(todayPurchases);
  els.statItemProfit.textContent = money(todayItemProfit);
  els.statNetProfit.textContent = money(todayNetProfit);
  els.openOrdersBadge.textContent = Object.values(state.openOrders).filter((order) => order.items.length).length;
}

function renderTables() {
  els.tablesGrid.innerHTML = "";
  const tableCount = getTableCount();
  if (state.selectedTable > tableCount) state.selectedTable = tableCount;
  for (let tableId = 1; tableId <= tableCount; tableId += 1) {
    const order = getExistingOrder(tableId);
    const math = order ? orderMath(order) : { total: 0, delta: 0 };
    const tableLabel = getTableLabel(tableId);
    const customerName = getOrderCustomerName(order);
    const button = document.createElement("button");
    button.className = "table-button";
    button.type = "button";
    button.dataset.table = String(tableId);
    button.classList.toggle("is-active", state.selectedTable === tableId);
    button.classList.toggle("has-order", Boolean(order?.items.length));
    button.classList.toggle("has-debt", Boolean(order?.items.length && math.delta > 0));
    button.innerHTML = `
      <strong>${escapeHtml(tableLabel)}</strong>
      ${customerName ? `<span class="table-customer">الزبون: ${escapeHtml(customerName)}</span>` : ""}
      <span class="table-meta">${order?.items.length ? `${order.items.length} أصناف | ${money(math.total)}` : "جاهزة"}</span>
    `;
    els.tablesGrid.appendChild(button);
  }
}

function renderCustomerSelect() {
  const order = getOpenOrder();
  const options = ['<option value="">بدون عميل محفوظ</option>']
    .concat(state.customers.map((customer) => {
      const phone = customer.phone ? ` - ${escapeHtml(customer.phone)}` : "";
      return `<option value="${customer.id}">${escapeHtml(customer.name)}${phone}</option>`;
    }));
  els.customerSelect.innerHTML = options.join("");
  els.customerSelect.value = order.customerId || "";
}

function renderCustomerSuggestions() {
  const query = els.customerNameInput.value.trim().toLowerCase();
  if (!query) {
    els.customerSuggestions.classList.remove("is-visible");
    els.customerSuggestions.innerHTML = "";
    return;
  }

  const matches = state.customers
    .filter((customer) => {
      return customer.name.toLowerCase().startsWith(query) || customer.phone?.toLowerCase().startsWith(query);
    })
    .slice(0, 6);

  if (!matches.length) {
    els.customerSuggestions.classList.remove("is-visible");
    els.customerSuggestions.innerHTML = "";
    return;
  }

  els.customerSuggestions.innerHTML = matches.map((customer) => `
    <button type="button" data-suggest-customer="${customer.id}">
      <strong>${escapeHtml(customer.name)}</strong>
      ${customer.phone ? `<small>${escapeHtml(customer.phone)}</small>` : ""}
    </button>
  `).join("");
  els.customerSuggestions.classList.add("is-visible");
}

function chooseSuggestedCustomer(customerId) {
  const customer = getCustomer(customerId);
  if (!customer) return;

  const order = getOpenOrder();
  order.customerId = customer.id;
  order.customerName = customer.name;
  order.customerPhone = customer.phone || "";
  selectedCustomerId = customer.id;
  els.customerSuggestions.classList.remove("is-visible");
  render();
}

function renderOrder() {
  const order = getOpenOrder();
  const customer = getCustomer(order.customerId);
  const tableLabel = getTableLabel();
  const payment = getOrderPayment(order);

  els.orderSubtitle.textContent = `رقم الطاولة ${state.selectedTable}`;
  els.tableNameInput.value = tableLabel;
  els.orderStatus.textContent = order.items.length ? `${order.items.length} أصناف` : "فارغ";
  els.customerNameInput.value = order.customerName || customer?.name || "";
  els.customerPhoneInput.value = order.customerPhone || customer?.phone || "";

  // شارة قسم العميل المطوي
  const customerHint = document.getElementById("customerCollapseHint");
  if (customerHint) {
    const name = order.customerName || customer?.name || "";
    customerHint.textContent = name || "بدون عميل";
    customerHint.classList.toggle("has-customer", Boolean(name));
  }
  els.discountInput.value = inputNumberValue(order.discount);
  els.paymentMethodInput.value = payment.method;
  els.paymentAmountInput.value = inputNumberValue(payment.amount);
  els.noteInput.value = order.note || "";

  renderOrderTotals(order);

  if (!order.items.length) {
    els.orderItems.innerHTML = '<div class="empty-state">اضغط على صنف من القائمة لإضافته للطلب.</div>';
    return;
  }

  els.orderItems.innerHTML = order.items.map((item) => `
    <article class="order-item">
      <div class="line-title">
        <strong>${escapeHtml(item.name)}</strong>
        <span>${money(item.price)} × ${item.qty} = ${money(item.price * item.qty)}</span>
      </div>
      <div class="qty-controls" aria-label="تعديل كمية ${escapeHtml(item.name)}">
        <button type="button" data-line-action="inc" data-item="${item.id}" aria-label="زيادة">+</button>
        <output>${item.qty}</output>
        <button type="button" data-line-action="dec" data-item="${item.id}" aria-label="تنقيص">-</button>
        <button class="remove-line" type="button" data-line-action="remove" data-item="${item.id}" aria-label="حذف">×</button>
      </div>
    </article>
  `).join("");
}

function renderOrderTotals(order = getOpenOrder()) {
  const math = orderMath(order);
  const customer = getCustomer(order.customerId);

  els.subtotalValue.textContent = money(math.subtotal);
  els.totalValue.textContent = money(math.total);
  const isLosingSale = order.items.length && math.profit < -0.001;
  els.profitWarning.hidden = !isLosingSale;
  if (isLosingSale) {
    els.profitWarning.innerHTML = `<span>بيع مخسر</span><strong>الخسارة ${money(Math.abs(math.profit))}</strong>`;
  }

  const needsCustomerForCredit = math.delta < -0.001 && !customer && !order.customerName?.trim();
  const resultLabel = math.delta > 0
    ? "المتبقي دين"
    : math.delta < 0
      ? needsCustomerForCredit ? "زيادة كرصيد - سجل اسم العميل" : "زيادة كرصيد"
      : "مدفوع كامل";
  els.balanceResult.className = "balance-result";
  els.balanceResult.classList.add(
    needsCustomerForCredit ? "is-credit-warning" : math.delta > 0 ? "is-debt" : math.delta < 0 ? "is-credit" : "is-paid"
  );
  els.balanceResult.innerHTML = `<span>${resultLabel}</span><strong>${money(Math.abs(math.delta))}</strong>`;

  if (customer) {
    els.customerAccountBox.innerHTML = `<span>حساب ${escapeHtml(customer.name)}</span><strong>${balanceText(customer.balance)}</strong>`;
  } else {
    els.customerAccountBox.innerHTML = "<span>حساب العميل</span><strong>لا يوجد عميل محدد</strong>";
  }
}

function renderMenu() {
  const categories = ["الكل", ...new Set(state.menu.map((item) => item.category))];
  if (!categories.includes(selectedCategory)) selectedCategory = "الكل";

  els.menuCategories.innerHTML = categories.map((category) => `
    <button class="category-button ${category === selectedCategory ? "is-active" : ""}" type="button" data-category="${escapeAttr(category)}">${escapeHtml(category)}</button>
  `).join("");

  const query = els.menuSearchInput.value.trim().toLowerCase();
  const items = state.menu.filter((item) => {
    const matchesCategory = selectedCategory === "الكل" || item.category === selectedCategory;
    const matchesSearch = !query || item.name.toLowerCase().includes(query) || item.category.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  const activeOrderCustomerId = getOpenOrder()?.customerId || null;
  els.menuGrid.innerHTML = items.length
    ? items.map((item) => {
      const stock = menuItemDisplayStock(item);
      const customPrice = getCustomerItemPrice(activeOrderCustomerId, item.id);
      const hasCustom = customPrice !== null;
      return `
        <button class="menu-item ${hasCustom ? "has-custom-price" : ""}" type="button" data-menu-item="${item.id}">
          <strong>${escapeHtml(item.name)}</strong>
          ${hasCustom
            ? `<span class="custom-price-tag">${money(customPrice)}</span><small class="original-price">${money(item.price)}</small>`
            : `<span>${money(item.price)}</span>`
          }
          ${stock.tracked ? `<small class="menu-stock ${stock.isLow ? "is-low" : ""}">المخزون: ${escapeHtml(stock.text)}</small>` : ""}
        </button>
      `;
    }).join("")
    : '<div class="empty-state">لا توجد أصناف مطابقة.</div>';
}

function renderPurchaseItemSelect() {
  if (!ENABLE_LINKING) {
    els.purchaseMenuItemInput.value = "";
    return;
  }
  const selected = els.purchaseMenuItemInput.value;
  els.purchaseMenuItemInput.innerHTML = ['<option value="">بدون ربط بصنف</option>']
    .concat(state.menu.map((item) => `<option value="${item.id}">${escapeHtml(item.name)} - ${escapeHtml(item.category)}</option>`))
    .join("");
  els.purchaseMenuItemInput.value = state.menu.some((item) => item.id === selected) ? selected : "";
}

function purchaseComponentOptions(ownerId = "") {
  if (!ENABLE_STOCK_COMPONENTS) return [];
  return purchaseInventoryItems().map((item) => ({
    itemId: item.id,
    purchaseItemName: item.name,
    linkedItemName: item.name,
    unit: item.stockUnit || "",
    disabled: false,
    value: JSON.stringify({ itemId: item.id, purchaseItemName: item.name, unit: item.stockUnit || "" }),
    label: `${item.name}${item.stockUnit ? ` - ${item.stockUnit}` : ""} | المتوفر: ${quantityWithUnit(item.stockQty, item.stockUnit)}`
  })).sort((a, b) => {
    return a.label.localeCompare(b.label, "ar");
  });
}

function parsePurchaseComponentOption(value) {
  try {
    const parsed = JSON.parse(value || "{}");
    if (!parsed.itemId) return null;
    return {
      itemId: parsed.itemId,
      purchaseItemName: String(parsed.purchaseItemName || "").trim(),
      unit: normalizeUnit(parsed.unit || "")
    };
  } catch (error) {
    return null;
  }
}

function renderMenuComponentSelect() {
  const selected = els.menuComponentItemInput.value;
  const ownerId = editingMenuItemId || "";
  const options = purchaseComponentOptions(ownerId);
  els.menuComponentItemInput.innerHTML = ['<option value="">اختر من المخزون</option>']
    .concat(options.length
      ? options.map((option) => `<option value="${escapeAttr(option.value)}"${option.disabled ? " disabled" : ""}>${escapeHtml(option.label)}</option>`)
      : ['<option value="" disabled>لا يوجد مخزون مشتريات بعد</option>'])
    .join("");
  els.menuComponentItemInput.value = options.some((option) => option.value === selected) ? selected : "";
}

function renderMenuComponentsEditor() {
  if (!ENABLE_STOCK_COMPONENTS) {
    menuComponentDraft = [];
    els.menuComponentsList.innerHTML = "";
    return;
  }
  renderMenuComponentSelect();
  menuComponentDraft = normalizeMenuComponents(menuComponentDraft, editingMenuItemId || "");
  const operatingCost = Math.max(Number(els.menuOperatingCostInput?.value || 0), 0);
  const operatingCostType = operatingCostTypes.includes(els.menuOperatingCostTypeInput?.value)
    ? els.menuOperatingCostTypeInput.value
    : "other";
  const operatingLine = operatingCost > 0 ? `
        <article class="menu-component-line menu-operating-line">
          <div>
            <strong>تكلفة تشغيل للوحدة</strong>
            <small>${escapeHtml(operatingCostLabels[operatingCostType] || operatingCostLabels.other)} محملة على كل عملية بيع</small>
          </div>
          <span>${money(operatingCost)}</span>
        </article>
      ` : "";
  const componentLines = menuComponentDraft.length
    ? menuComponentDraft.map((component) => {
      const item = inventoryItemById(component.itemId);
      const unit = component.unit || itemUnit(item);
      return `
        <article class="menu-component-line">
          <div>
            <strong>${escapeHtml(component.purchaseItemName || item?.name || "مكون غير موجود")}</strong>
            <small>${item ? `من المخزون: ${escapeHtml(item.name)} | ` : ""}كمية الاستهلاك لكل بيع: ${quantityWithUnit(component.qty, unit)} | حق الوحدة: ${item ? money(item.cost) : "-"}</small>
          </div>
          <span>${item ? money(Number(item.cost || 0) * Number(component.qty || 0)) : "-"}</span>
          <button type="button" data-remove-component="${component.id}">حذف</button>
        </article>
      `;
    }).join("")
    : "";
  els.menuComponentsList.innerHTML = componentLines || operatingLine
    ? `${componentLines}${operatingLine}`
    : '<div class="empty-state">لا توجد مكونات. الصنف سيستخدم سعر الشراء المكتوب وتكلفة التشغيل فقط حتى تضيف مواد من المخزون.</div>';
}

function addMenuComponent() {
  if (!ENABLE_STOCK_COMPONENTS) {
    showToast("مكونات الصنف غير مفعلة.");
    return;
  }
  const option = parsePurchaseComponentOption(els.menuComponentItemInput.value);
  const itemId = option?.itemId || "";
  const qty = Number(els.menuComponentQtyInput.value || 0);
  if (!itemId || qty <= 0) {
    showToast("اختر صنف من المخزون واكتب كمية الاستهلاك لكل بيع.");
    return;
  }
  if (itemId === editingMenuItemId) {
    showToast("لا يمكن ربط الصنف بنفسه كمكون.");
    return;
  }

  const purchaseItemName = option.purchaseItemName || inventoryItemById(itemId)?.name || "";
  const unit = option.unit || itemUnit(inventoryItemById(itemId));
  const existing = menuComponentDraft.find((component) => {
    return component.itemId === itemId
      && String(component.purchaseItemName || "").trim() === purchaseItemName
      && normalizeUnit(component.unit || "") === normalizeUnit(unit);
  });
  if (existing) existing.qty += qty;
  else menuComponentDraft.push({ id: uid("component"), itemId, purchaseItemName, qty, unit });

  els.menuComponentItemInput.value = "";
  els.menuComponentQtyInput.value = "";
  renderMenuComponentsEditor();
}

function syncPurchaseMenuItem() {
  if (!ENABLE_LINKING) return;
  const item = findMenuItem(els.purchaseMenuItemInput.value);
  if (!item) return;
  if (!els.purchaseItemInput.value.trim()) {
    els.purchaseItemInput.value = item.name;
  }
  if (!els.purchaseUnitInput.value.trim() && itemUnit(item)) {
    els.purchaseUnitInput.value = itemUnit(item);
  }
  renderPurchaseUnitCost();
}

function currentPurchaseUnitCost() {
  const purchaseQty = Number(els.purchaseQtyInput.value || 0);
  const stockPerUnit = Number(els.purchaseStockQtyInput.value || 0);
  const stockQty = stockPerUnit > 0 ? purchaseQty * stockPerUnit : purchaseQty;
  const amount = Number(els.purchaseAmountInput.value || 0);
  return stockQty > 0 && amount > 0 ? amount / stockQty : 0;
}

function renderPurchaseUnitCost() {
  const unit = normalizeUnit(els.purchaseStockUnitInput.value || els.purchaseUnitInput.value);
  els.purchaseUnitCostValue.textContent = `${money(currentPurchaseUnitCost())}${unit ? ` / ${unit}` : ""}`;
}

function purchaseDraftTotal() {
  return purchaseDraftItems.reduce((sum, line) => sum + Number(line.amount || 0), 0);
}

function purchaseLineStockQty(line = {}) {
  const qty = Number(line.qty || 0);
  const stockPerUnit = purchaseLineStockPerUnit(line);
  const value = Number(line.stockQty ?? line.inventoryQty ?? line.outputQty ?? (stockPerUnit > 0 && qty > 0 ? qty * stockPerUnit : qty));
  return value > 0 ? value : 0;
}

function purchaseLineStockPerUnit(line = {}) {
  const value = Number(line.stockPerUnit ?? line.stockUnitsPerPurchase ?? line.unitsPerPurchase ?? 0);
  if (value > 0) return value;
  const qty = Number(line.qty || 0);
  const stockQty = Number(line.stockQty ?? line.inventoryQty ?? line.outputQty ?? 0);
  return qty > 0 && stockQty > 0 ? stockQty / qty : 0;
}

function purchaseLineStockUnit(line = {}) {
  return normalizeUnit(line.stockUnit || line.inventoryUnit || line.outputUnit || line.unit || "");
}

function purchaseLineUnitCost(line = {}) {
  const stockQty = purchaseLineStockQty(line);
  return Number(line.unitCost ?? line.stockUnitCost ?? (stockQty ? Number(line.amount || 0) / stockQty : 0));
}

function purchaseLineStockText(line = {}) {
  return quantityWithUnit(purchaseLineStockQty(line), purchaseLineStockUnit(line));
}

function purchaseLineStockPerUnitText(line = {}) {
  const stockPerUnit = purchaseLineStockPerUnit(line);
  if (stockPerUnit <= 0) return "";
  const purchaseUnit = normalizeUnit(line.unit || "");
  const stockText = quantityWithUnit(stockPerUnit, purchaseLineStockUnit(line));
  return purchaseUnit ? `كل ${purchaseUnit}: ${stockText}` : `لكل وحدة شراء: ${stockText}`;
}

function renderPurchaseDraft() {
  const total = purchaseDraftTotal();
  const editingPurchase = editingPurchaseId ? state.purchases.find((purchase) => purchase.id === editingPurchaseId) : null;
  if (editingPurchaseId && !editingPurchase) editingPurchaseId = null;
  const isEditing = Boolean(editingPurchase);

  els.purchaseDraftBox.classList.toggle("is-editing", isEditing);
  els.purchaseDraftTitle.textContent = isEditing ? `تعديل ${editingPurchase.number || "فاتورة مشتريات"}` : "فاتورة المشتريات الحالية";
  els.purchaseDraftSubtitle.textContent = isEditing ? "عدّل البنود ثم احفظ التعديل لتحديث مخزون الجرد" : "أضف الأصناف ثم سجل الفاتورة";
  els.purchaseDraftTotal.textContent = money(total);
  els.savePurchaseInvoiceButton.disabled = !purchaseDraftItems.length;
  els.clearPurchaseInvoiceButton.disabled = !purchaseDraftItems.length;
  els.savePurchaseInvoiceButton.textContent = isEditing ? "حفظ تعديل فاتورة المشتريات" : "تسجيل فاتورة المشتريات";
  els.clearPurchaseInvoiceButton.textContent = isEditing ? "تفريغ بنود التعديل" : "تفريغ الفاتورة";
  els.purchaseEditCancelButton.hidden = !isEditing;

  els.purchaseDraftList.innerHTML = purchaseDraftItems.length
    ? purchaseDraftItems.map((line) => `
        <article class="purchase-draft-line">
          <div>
            <strong>${escapeHtml(line.item)}</strong>
            <small>${ENABLE_LINKING && purchaseLinkedItemText(line) ? `${purchaseLinkedItemText(line)} | ` : ""}الشراء: ${quantityWithUnit(line.qty, line.unit)} | ${purchaseLineStockPerUnitText(line)} | يدخل المخزون: ${purchaseLineStockText(line)} | حق وحدة المخزون: ${money(purchaseLineUnitCost(line))}</small>
          </div>
        <span>${money(line.amount)}</span>
        <button class="purchase-draft-edit" type="button" data-edit-purchase-draft="${line.id}">تعديل</button>
        <button type="button" data-remove-purchase-draft="${line.id}">حذف</button>
      </article>
    `).join("")
    : '<div class="empty-state">لا توجد أصناف في الفاتورة الحالية.</div>';
}

function removePurchaseDraftLine(lineId) {
  purchaseDraftItems = purchaseDraftItems.filter((line) => line.id !== lineId);
  render();
}

function editPurchaseDraftLine(lineId) {
  const line = purchaseDraftItems.find((entry) => entry.id === lineId);
  if (!line) return;

  els.purchaseItemInput.value = line.item || "";
  if (ENABLE_LINKING) els.purchaseMenuItemInput.value = line.menuItemId || "";
  els.purchaseQtyInput.value = inputNumberValue(line.qty);
  els.purchaseUnitInput.value = line.unit || "";
  els.purchaseStockQtyInput.value = inputNumberValue(line.stockPerUnit);
  els.purchaseStockUnitInput.value = line.stockUnit || "";
  els.purchaseAmountInput.value = inputNumberValue(line.amount);

  purchaseDraftItems = purchaseDraftItems.filter((entry) => entry.id !== lineId);
  showToast("عدّل الأرقام ثم اضغط إضافة لإرجاع الصنف للفاتورة.");
  render();
  renderPurchaseUnitCost();
  els.purchaseQtyInput.focus();
  els.purchaseQtyInput.select();
}

function clearPurchaseDraft() {
  purchaseDraftItems = [];
  showToast(editingPurchaseId ? "تم تفريغ بنود التعديل." : "تم تفريغ فاتورة المشتريات الحالية.");
  render();
}

function resetPurchaseLineInputs() {
  els.purchaseMenuItemInput.value = "";
  els.purchaseItemInput.value = "";
  els.purchaseQtyInput.value = "";
  els.purchaseUnitInput.value = "";
  els.purchaseStockQtyInput.value = "";
  els.purchaseStockUnitInput.value = "";
  els.purchaseAmountInput.value = "";
  renderPurchaseUnitCost();
}

function cancelPurchaseEdit() {
  editingPurchaseId = null;
  purchaseDraftItems = [];
  els.purchaseSupplierInput.value = "";
  els.purchaseNoteInput.value = "";
  els.purchaseMethodInput.value = getLastPaymentMethod();
  resetPurchaseLineInputs();
  showToast("تم إلغاء تعديل فاتورة المشتريات.");
  render();
}
