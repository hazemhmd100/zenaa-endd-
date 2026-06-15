// ═══ دفتر المقهى ═══ 09-actions.js — التسديد، الطباعة، نسخ احتياطي، حفظ المشتريات والأصناف
// (مقسوم من app.js — الأسطر 4540-4987)

function recordSettlement(event) {
  event.preventDefault();
  const customer = getCustomer(selectedCustomerId);
  const amount = Math.max(Number(els.settlementAmountInput.value || 0), 0);
  const method = paymentMethods.includes(els.settlementMethodInput.value) ? els.settlementMethodInput.value : getLastPaymentMethod();
  const payoutMode = customer && Number(customer.balance || 0) < -0.001;
  const debtMode = settlementDebtMode && !payoutMode;
  const discount = !payoutMode && !debtMode ? Math.max(Number(els.settlementDiscountInput.value || 0), 0) : 0;
  const settlementValue = amount + discount;

  if (!customer) {
    showToast("اختر عميل أولاً.");
    return;
  }
  if ((debtMode || payoutMode) && amount <= 0) {
    showToast(debtMode ? "اكتب مبلغ الدين." : payoutMode ? "اكتب مبلغ الدفع للعميل." : "اكتب مبلغ الدفعة.");
    return;
  }
  if (!debtMode && !payoutMode && settlementValue <= 0) {
    showToast("اكتب مبلغ الدفعة أو الخصم.");
    return;
  }
  if (payoutMode && amount > Math.abs(Number(customer.balance || 0)) + 0.001) {
    showToast("المبلغ أكبر من رصيد العميل.");
    return;
  }
  if (!debtMode && !payoutMode && discount > 0 && settlementValue > Number(customer.balance || 0) + 0.001) {
    showToast("المبلغ مع الخصم أكبر من دين العميل.");
    return;
  }

  customer.updatedAt = new Date().toISOString();

  if (debtMode) {
    const note = els.settlementNoteInput.value.trim();
    customer.balance += amount;
    customer.totalBilled += amount;
    const invoice = {
      id: uid("debt"),
      number: nextInvoiceNumber(),
      type: "debt",
      customerId: customer.id,
      customerName: customer.name,
      tableLabel: "-",
      items: [],
      subtotal: amount,
      discount: 0,
      total: amount,
      paid: 0,
      delta: amount,
      payments: { cash: 0, bank: 0, wallet: 0 },
      status: "debt",
      note: note || "دين مضاف يدوياً",
      createdAt: new Date().toISOString()
    };
    state.invoices.unshift(invoice);
    lastClosedInvoice = invoice;
    els.settlementAmountInput.value = "";
    els.settlementNoteInput.value = "";
    showToast(`تم تسجيل دين ${money(amount)} على ${customer.name}.`);
    render();
    return;
  }

  setLastPaymentMethod(method);
  if (payoutMode) {
    customer.balance += amount;
    customer.totalPaid = Math.max(0, Number(customer.totalPaid || 0) - amount);
  } else {
    customer.balance -= settlementValue;
    customer.totalPaid += amount;
  }
  const invoice = {
    id: uid(payoutMode ? "payout" : "payment"),
    number: nextInvoiceNumber(),
    type: payoutMode ? "payout" : "payment",
    customerId: customer.id,
    customerName: customer.name,
    tableLabel: "-",
    items: [],
    subtotal: 0,
    discount: payoutMode ? 0 : discount,
    total: 0,
    paid: amount,
    delta: payoutMode ? amount : -settlementValue,
    payments: { cash: method === "cash" ? amount : 0, bank: method === "bank" ? amount : 0, wallet: method === "wallet" ? amount : 0 },
    status: payoutMode ? "payout" : "payment",
    note: payoutMode ? `دفع للعميل عبر ${paymentLabels[method]}` : `تسديد عبر ${paymentLabels[method]}`,
    createdAt: new Date().toISOString()
  };
  state.invoices.unshift(invoice);
  lastClosedInvoice = invoice;
  els.settlementAmountInput.value = "";
  els.settlementDiscountInput.value = "";
  els.settlementMethodInput.value = getLastPaymentMethod();
  showToast(payoutMode ? "تم تسجيل دفع الرصيد للعميل." : discount > 0 ? `تم تسجيل الدفعة مع خصم ${money(discount)}.` : "تم تسجيل الدفعة على الحساب.");
  render();
}

function printInvoice(invoice) {
  if (!invoice) {
    showToast("الفاتورة غير موجودة.");
    return;
  }

  const host = document.createElement("div");
  host.className = "print-host";
  const node = els.printTemplate.content.cloneNode(true);
  node.querySelector(".print-meta").textContent = `${invoice.number} | ${formatDate(invoice.createdAt)} | ${invoice.customerName}`;
  node.querySelector(".print-lines").innerHTML = invoice.items.length
    ? invoice.items.map((item) => `<p>${escapeHtml(item.name)} - ${item.qty} × ${money(item.price)} = ${money(item.qty * item.price)}</p>`).join("")
    : `<p>${escapeHtml(invoice.note || (invoice.type === "sale" ? "دين بدون أصناف" : "دفعة على الحساب"))}: ${money(invoice.type === "sale" ? invoice.total : invoice.paid)}</p>`;
  node.querySelector(".print-total").innerHTML = `
    <p>الصافي: ${money(invoice.total)}</p>
    <p>المدفوع: ${money(invoice.paid)}</p>
    <p>الحالة: ${statusText(invoice.status)}</p>
  `;
  host.appendChild(node);
  document.body.appendChild(host);
  window.print();
  host.remove();
}

function printLastInvoice() {
  if (!lastClosedInvoice) {
    showToast("لا توجد فاتورة مطبوعة بعد.");
    return;
  }

  printInvoice(lastClosedInvoice);
}

function printInvoiceById(invoiceId) {
  printInvoice(state.invoices.find((invoice) => invoice.id === invoiceId));
}

function backupPayload() {
  saveState();
  return JSON.stringify({
    ...state,
    exportedAt: new Date().toISOString(),
    backupNote: "نسخة احتياطية كاملة من دفتر المقهى"
  }, null, 2);
}

function backupFileName() {
  const name = (typeof businessName === "function" ? businessName() : "cafe-pos").replace(/[\\/:*?"<>|]/g, "").trim() || "cafe-pos";
  const now = new Date();
  const localDate = new Date(Date.now() - now.getTimezoneOffset() * 60000);
  const datePart = localDate.toISOString().slice(0, 10);
  const suffix = now.getHours() >= 12 ? "PM" : "AM";
  const hour = String(now.getHours() % 12 || 12).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");
  const timestamp = `${datePart}-${hour}-${minute}-${second}-${suffix}`;
  return `${name}-backup-${timestamp}.json`;
}

function downloadBackupFallback(payload, fileName) {
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    anchor.remove();
  }, 1000);
}

async function exportData() {
  const payload = backupPayload();
  const fileName = backupFileName();

  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{
          description: "ملف نسخة احتياطية JSON",
          accept: { "application/json": [".json"] }
        }]
      });
      const writable = await handle.createWritable();
      await writable.write(payload);
      await writable.close();
      showToast("تم حفظ النسخة الاحتياطية في المكان الذي اخترته.");
      markBackupDone();
      return;
    } catch (error) {
      if (error && error.name === "AbortError") return;
      console.warn("save picker failed", error);
      showToast("تعذر فتح اختيار المكان، تم تنزيل النسخة بدل ذلك.");
    }
  } else {
    showToast("متصفحك لا يدعم اختيار مكان الحفظ، تم تنزيل النسخة بدل ذلك.");
  }

  downloadBackupFallback(payload, fileName);
  markBackupDone();
}

async function shareBackup() {
  const payload = backupPayload();
  const fileName = backupFileName();
  const file = new File([payload], fileName, { type: "application/json" });

  // جرّب مشاركة الملف عبر نظام الجهاز (واتساب/درايف/...)
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: "نسخة احتياطية — دفتر المقهى",
        text: "نسخة احتياطية من بيانات المحل"
      });
      showToast("تم فتح المشاركة — اختر واتساب أو درايف.");
      markBackupDone();
      return;
    } catch (error) {
      if (error && error.name === "AbortError") return; // المستخدم ألغى
      console.warn("share failed", error);
    }
  }

  // الجهاز ما يدعم مشاركة الملفات → ننزّله عادي
  showToast("جهازك لا يدعم المشاركة المباشرة — تم تنزيل النسخة بدلاً من ذلك.");
  await exportData();
}

function importData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      state = {
        ...normalizeState(parsed),
        view: "invoices",
      };
      selectedCustomerId = state.customers[0]?.id || null;
      selectedWorkerId = state.workers[0]?.id || null;
      lastClosedInvoice = state.invoices[0] || null;
      showToast("تم استيراد النسخة.");
      render();
    } catch (error) {
      showToast("ملف النسخة غير صحيح.");
    }
  };
  reader.readAsText(file);
}

function addPurchase(event) {
  event.preventDefault();
  const menuItemId = ENABLE_LINKING ? els.purchaseMenuItemInput.value || "" : "";
  const typedItem = els.purchaseItemInput.value.trim();
  const menuItem = ENABLE_LINKING ? menuItemId ? findMenuItem(menuItemId) : findMenuItemByName(typedItem) : null;
  const item = typedItem || "";
  const qty = Number(els.purchaseQtyInput.value || 0);
  const unit = normalizeUnit(els.purchaseUnitInput.value || (ENABLE_LINKING ? itemUnit(menuItem) : ""));
  const stockPerUnit = Number(els.purchaseStockQtyInput.value || 0);
  const stockQty = stockPerUnit > 0 ? qty * stockPerUnit : qty;
  const stockUnit = normalizeUnit(els.purchaseStockUnitInput.value || unit);
  const amount = Number(els.purchaseAmountInput.value || 0);
  const unitCost = stockQty > 0 ? amount / stockQty : 0;

  if (!item || amount <= 0 || qty <= 0 || stockQty <= 0) {
    showToast("اكتب اسم الصنف والكمية والمبلغ وكمية المخزون.");
    return;
  }

  purchaseDraftItems.push({
    id: uid("purchase-line"),
    menuItemId: ENABLE_LINKING ? menuItem?.id || null : null,
    linkedItemName: ENABLE_LINKING ? menuItem?.name || "" : "",
    item,
    qty,
    unit,
    stockPerUnit: stockPerUnit > 0 ? stockPerUnit : 1,
    stockQty,
    stockUnit,
    unitCost,
    amount
  });

  resetPurchaseLineInputs();
  showToast("تمت إضافة الصنف لفاتورة المشتريات.");
  render();
}

function purchaseDraftLineFromStoredLine(line) {
  const qty = Number(line.qty || 0);
  const amount = Number(line.amount || 0);
  const stockQty = purchaseLineStockQty(line) || qty;
  const stockPerUnit = purchaseLineStockPerUnit(line) || 1;
  const stockUnit = purchaseLineStockUnit(line) || normalizeUnit(line.unit || "");
  return {
    id: line.id || uid("purchase-line"),
    menuItemId: ENABLE_LINKING ? line.menuItemId || null : null,
    linkedItemName: ENABLE_LINKING ? line.linkedItemName || purchaseLinkedItemName(line) : "",
    item: line.item || "مشتريات",
    qty,
    unit: normalizeUnit(line.unit || (ENABLE_LINKING ? itemUnit(findMenuItem(line.menuItemId)) : "")),
    stockPerUnit,
    stockQty,
    stockUnit,
    unitCost: Number(line.unitCost ?? (stockQty ? amount / stockQty : 0)),
    amount
  };
}

function revertPurchaseStock(purchase) {
  if (!ENABLE_LINKING) return;
  purchaseLines(purchase).forEach((line) => {
    if (line.menuItemId && purchaseLineStockQty(line) > 0) {
      adjustMenuStock(line.menuItemId, -purchaseLineStockQty(line));
    }
  });
}

function applyPurchaseLinesToStock(lines) {
  if (!ENABLE_LINKING) {
    return lines.map((line) => ({
      ...line,
      menuItemId: null,
      linkedItemName: "",
      stockAfter: null
    }));
  }
  return lines.map((line) => {
    const stockQty = purchaseLineStockQty(line);
    const stockUnit = purchaseLineStockUnit(line);
    const stockItem = line.menuItemId ? adjustMenuStock(line.menuItemId, stockQty) : null;
    if (stockItem && stockUnit) {
      stockItem.stockUnit = stockUnit;
    }
    if (stockItem && purchaseLineUnitCost(line) > 0) {
      stockItem.cost = purchaseLineUnitCost(line);
    }
    return {
      ...line,
      stockAfter: stockItem ? stockItem.stockQty : null
    };
  });
}

function resetPurchaseInvoiceForm() {
  editingPurchaseId = null;
  purchaseDraftItems = [];
  els.purchaseSupplierInput.value = "";
  els.purchaseNoteInput.value = "";
  els.purchaseMethodInput.value = getLastPaymentMethod();
  resetPurchaseLineInputs();
}

function savePurchaseInvoice() {
  if (!purchaseDraftItems.length) {
    showToast("أضف صنف واحد على الأقل لفاتورة المشتريات.");
    return;
  }

  const editingPurchase = editingPurchaseId ? state.purchases.find((purchase) => purchase.id === editingPurchaseId) : null;
  if (editingPurchaseId && !editingPurchase) {
    resetPurchaseInvoiceForm();
    showToast("فاتورة المشتريات غير موجودة.");
    render();
    return;
  }

  const method = paymentMethods.includes(els.purchaseMethodInput.value) ? els.purchaseMethodInput.value : getLastPaymentMethod();
  const supplier = els.purchaseSupplierInput.value.trim();
  const note = els.purchaseNoteInput.value.trim();
  setLastPaymentMethod(method);

  if (editingPurchase) revertPurchaseStock(editingPurchase);

  const items = applyPurchaseLinesToStock(purchaseDraftItems);
  const amount = items.reduce((sum, line) => sum + Number(line.amount || 0), 0);
  const invoice = editingPurchase || {
    id: uid("purchase"),
    number: nextPurchaseNumber()
  };

  Object.assign(invoice, {
    type: "purchase-invoice",
    supplier,
    items,
    qty: items.reduce((sum, line) => sum + Number(line.qty || 0), 0),
    stockQty: items.reduce((sum, line) => sum + purchaseLineStockQty(line), 0),
    amount,
    method,
    note,
    createdAt: editingPurchase?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  if (!editingPurchase) state.purchases.unshift(invoice);
  state.purchases.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  resetPurchaseInvoiceForm();
  if (editingPurchase) {
    showToast(`تم حفظ تعديل فاتورة المشتريات ${invoice.number} وتحديث مخزون الجرد.`);
  } else {
    showToast(`تم تسجيل فاتورة المشتريات ${invoice.number} وإضافتها لمخزون الجرد.`);
  }
  render();
}

async function startEditPurchase(purchaseId) {
  const purchase = state.purchases.find((entry) => entry.id === purchaseId);
  if (!purchase) return;
  if (!guardClosedPeriod(purchase.createdAt, "تعديل فاتورة المشتريات")) return;
  if (purchaseDraftItems.length && editingPurchaseId !== purchaseId) {
    const confirmed = await appConfirm("استبدال فاتورة المشتريات الحالية ببيانات الفاتورة المختارة للتعديل؟");
    if (!confirmed) return;
  }

  editingPurchaseId = purchase.id;
  purchaseDraftItems = purchaseLines(purchase).map(purchaseDraftLineFromStoredLine);
  els.purchaseSupplierInput.value = purchase.supplier || "";
  els.purchaseMethodInput.value = paymentMethods.includes(purchase.method) ? purchase.method : getLastPaymentMethod();
  els.purchaseNoteInput.value = purchase.note || "";
  resetPurchaseLineInputs();
  render();
  els.purchaseDraftBox.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function removePurchase(id) {
  const purchase = state.purchases.find((entry) => entry.id === id);
  if (!purchase) return;
  if (!guardClosedPeriod(purchase.createdAt, "حذف فاتورة المشتريات")) return;
  const confirmed = await appConfirm(`حذف فاتورة المشتريات ${purchase.number || ""} بقيمة ${money(purchaseAmount(purchase))}؟`);
  if (!confirmed) return;
  revertPurchaseStock(purchase);
  state.purchases = state.purchases.filter((purchase) => purchase.id !== id);
  if (editingPurchaseId === id) resetPurchaseInvoiceForm();
  showToast("تم حذف فاتورة المشتريات.");
  render();
}

function recordGeneralExpense(event) {
  event.preventDefault();
  const title = els.generalExpenseTitleInput.value.trim();
  const amount = Math.max(Number(els.generalExpenseAmountInput.value || 0), 0);
  const method = paymentMethods.includes(els.generalExpenseMethodInput.value)
    ? els.generalExpenseMethodInput.value
    : getLastPaymentMethod();
  const createdAt = invoiceDateFromInput(els.generalExpenseDateInput.value);

  if (!title) {
    showToast("اكتب اسم المصروف.");
    els.generalExpenseTitleInput.focus();
    return;
  }
  if (amount <= 0) {
    showToast("اكتب مبلغ المصروف.");
    els.generalExpenseAmountInput.focus();
    return;
  }
  if (!guardClosedPeriod(createdAt, "تسجيل مصروف ضمن فترة مغلقة")) return;

  const expense = normalizeExpense({
    id: uid("expense"),
    type: "general",
    title,
    amount,
    method,
    note: els.generalExpenseNoteInput.value.trim(),
    createdAt
  });

  state.expenses = state.expenses || [];
  state.expenses.unshift(expense);
  setLastPaymentMethod(method);
  els.generalExpenseForm.reset();
  els.generalExpenseDateInput.value = todayDateInputValue();
  els.generalExpenseMethodInput.value = getLastPaymentMethod();
  showToast(`تم تسجيل مصروف ${expense.title}: ${money(expense.amount)}.`);
  render();
}

async function removeGeneralExpense(expenseId) {
  const expense = (state.expenses || []).find((entry) => entry.id === expenseId);
  if (!expense) return;
  if (!guardClosedPeriod(expense.createdAt, "حذف مصروف ضمن فترة مغلقة")) return;
  const confirmed = await appConfirm(`حذف مصروف "${expense.title}" بقيمة ${money(expense.amount)}؟`);
  if (!confirmed) return;

  state.expenses = (state.expenses || []).filter((entry) => entry.id !== expenseId);
  showToast("تم حذف المصروف العام.");
  render();
}

function setMenuFormMode(item = null) {
  editingMenuItemId = item?.id || null;
  els.menuFormTitle.textContent = item ? "تعديل صنف" : "إضافة صنف";
  els.menuSubmitButton.textContent = item ? "حفظ التعديل" : "إضافة الصنف";
  els.menuCancelEditButton.hidden = !item;

  if (!item) {
    menuComponentDraft = [];
    els.menuForm.reset();
    renderMenuComponentsEditor();
    return;
  }

  menuComponentDraft = normalizeMenuComponents(item.components || [], item.id);
  els.menuNameInput.value = item.name || "";
  els.menuPriceInput.value = inputNumberValue(item.price);
  els.menuCostInput.value = inputNumberValue(item.cost);
  els.menuCategoryInput.value = item.category || "";
  renderMenuComponentsEditor();
  els.menuNameInput.focus();
}

function editMenuItem(itemId) {
  const item = findMenuItem(itemId);
  if (!item) return;
  setMenuFormMode(item);
  render();
}

function saveMenuItem(event) {
  event.preventDefault();
  const name = els.menuNameInput.value.trim();
  const price = Number(els.menuPriceInput.value || 0);
  const costInput = els.menuCostInput.value.trim();
  const cost = costInput === "" ? 0 : Number(costInput);
  const category = els.menuCategoryInput.value.trim();
  const components = normalizeMenuComponents(menuComponentDraft, editingMenuItemId || "");
  if (!name || !category || price <= 0 || cost < 0 || (!components.length && costInput === "")) {
    showToast("أكمل بيانات الصنف أو أضف مكونات من المخزون.");
    return;
  }

  if (editingMenuItemId) {
    const item = findMenuItem(editingMenuItemId);
    if (!item) {
      showToast("الصنف غير موجود.");
      setMenuFormMode();
      render();
      return;
    }

    Object.assign(item, { name, price, cost, category, components });
    setMenuFormMode();
    showToast("تم حفظ تعديل الصنف.");
    render();
    return;
  }

  state.menu.push({ id: uid("item"), name, price, cost, category, components });
  setMenuFormMode();
  showToast("تمت إضافة الصنف.");
  render();
}

async function removeMenuItem(itemId) {
  const usedInOpenOrder = Object.values(state.openOrders).some((order) => order.items.some((item) => item.id === itemId));
  if (usedInOpenOrder) {
    showToast("الصنف موجود في طلب مفتوح، احذفه من الطلب أولاً.");
    return;
  }
  const usedAsComponent = state.menu.some((item) => item.id !== itemId && menuItemComponents(item).some((component) => component.itemId === itemId));
  if (usedAsComponent) {
    showToast("الصنف مستخدم كمكون في صنف آخر. احذفه من المكونات أولاً.");
    return;
  }
  const item = findMenuItem(itemId);
  const confirmed = await appConfirm(`حذف صنف "${item ? item.name : ""}" من المنيو؟`);
  if (!confirmed) return;
  state.menu = state.menu.filter((item) => item.id !== itemId);
  if (editingMenuItemId === itemId) setMenuFormMode();
  showToast("تم حذف الصنف.");
  render();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
