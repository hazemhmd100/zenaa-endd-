// ═══ دفتر المقهى ═══ 07-reports.js — التقارير
// (مقسوم من app.js — الأسطر 3968-4111)

const cashMethodMeta = [
  { key: "cash", label: "كاش", icon: "💵" },
  { key: "bank", label: "تطبيق بنك", icon: "🏦" },
  { key: "wallet", label: "محفظة", icon: "📱" }
];

function renderCashOnHand() {
  if (!els.cashOnHandBox) return;
  const c = cashOnHand();
  const cards = cashMethodMeta.map(({ key, label, icon }) => {
    const m = c.methods[key];
    return `
      <article class="cash-method-card ${m.current >= 0 ? "" : "is-negative"}">
        <div class="cash-method-head">
          <span>${icon} ${label}</span>
          <button class="cash-method-reconcile" type="button" data-reconcile-method="${key}" title="جرد ${label}">⚖</button>
        </div>
        <strong>${money(m.current)}</strong>
        <small>أساس ${money(m.opening)} + دخل ${money(m.inflow)} − طلع ${money(m.outflow)}${m.adjustments ? ` ${m.adjustments >= 0 ? "+" : "−"} تسوية ${money(Math.abs(m.adjustments))}` : ""}</small>
      </article>
    `;
  }).join("");

  els.cashOnHandBox.innerHTML = `
    <div class="cashbox-onhand-top">
      <div class="cashbox-onhand-total">
        <span>💰 إجمالي الفلوس اللي معك</span>
        <strong class="${c.total.current >= 0 ? "is-positive" : "is-negative"}">${money(c.total.current)}</strong>
      </div>
      <button class="secondary-button" id="setOpeningCashButton" type="button">✎ رأس المال</button>
    </div>
    <div class="cash-method-grid">${cards}</div>
  `;

  const setBtn = document.getElementById("setOpeningCashButton");
  if (setBtn) setBtn.addEventListener("click", setOpeningCash);
  els.cashOnHandBox.querySelectorAll("[data-reconcile-method]").forEach((btn) => {
    btn.addEventListener("click", () => reconcileCashMethod(btn.dataset.reconcileMethod));
  });
}

function setOpeningCash() {
  const opening = normalizeOpeningCash(state.openingCash);
  const next = { ...opening };
  for (const { key, label } of cashMethodMeta) {
    const raw = window.prompt(`رأس مال ${label} عند بداية استخدام البرنامج (اتركه فاضي للتخطي):`, String(opening[key] || 0));
    if (raw === null) return; // ألغى → نوقف بدون حفظ
    if (raw.trim() === "") continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) { showToast(`قيمة ${label} غير صحيحة.`); return; }
    next[key] = value;
  }
  state.openingCash = next;
  saveState();
  showToast("تم تحديث رأس المال.");
  render();
}

async function reconcileCashMethod(method) {
  const meta = cashMethodMeta.find((m) => m.key === method);
  if (!meta) return;
  const c = cashOnHand();
  const expected = c.methods[method].current;
  const raw = window.prompt(`عُدّ رصيد ${meta.label} فعلاً واكتب المبلغ.\nالمتوقع حسب البرنامج: ${money(expected)}`, String(Math.round(expected)));
  if (raw === null) return;
  const counted = Number(raw);
  if (!Number.isFinite(counted) || counted < 0) { showToast("اكتب رقم صحيح."); return; }
  const diff = counted - expected;
  if (Math.abs(diff) <= 0.001) { showToast(`${meta.label} مطابق ✓`); return; }
  const sign = diff > 0 ? "زيادة" : "نقص";
  const ok = await appConfirm(`${meta.label}: في ${sign} بقيمة ${money(Math.abs(diff))}.\nهل تثبّت المبلغ الفعلي (${money(counted)}) وتسجّل الفرق كتسوية؟`);
  if (!ok) return;
  state.cashAdjustments = state.cashAdjustments || [];
  state.cashAdjustments.push({
    id: uid("cashadj"),
    method,
    diff,
    counted,
    expected,
    createdAt: new Date().toISOString()
  });
  saveState();
  showToast(`تم تثبيت ${meta.label} على ${money(counted)} (${sign} ${money(Math.abs(diff))}).`);
  render();
}

function renderReports() {
  renderCashOnHand();
  const range = selectedReportRange();
  const data = reportData(range);
  const itemRows = reportItemRows(range);
  const customerRows = reportCustomerRows();
  const recentInvoices = data.invoices
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 8);
  const recentPurchases = data.purchases
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 8);
  const recentGeneralExpenses = data.expenses
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 8);
  const recentInventoryCounts = data.inventoryCounts
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 8);
  const recentWorkerConsumptions = data.workerConsumptions
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 8);
  const recentWorkerTransactions = data.workerTransactions
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 8);

  els.reportRangeText.textContent = rangeText(range);

  // ── حساب الصندوق: شو دخل وشو طلع ──
  const paymentsReceived = data.paymentInvoices.reduce((sum, invoice) => sum + Number(invoice.paid || 0), 0);
  const paymentDiscountTotal = Number(data.paymentDiscountTotal || 0);
  const payoutsPaid = data.payoutInvoices.reduce((sum, invoice) => sum + Number(invoice.paid || 0), 0);
  const workerDrinksPaid = paymentMethods.reduce((sum, method) => sum + Number(data.workerPayments[method] || 0), 0);
  const cashIn = data.paidTotal + paymentsReceived + workerDrinksPaid;
  const cashOut = data.purchasesTotal + data.expensesTotal + data.workerTransactionSummary.advances + data.workerTransactionSummary.salaryPaid + payoutsPaid;
  const cashNet = cashIn - cashOut;
  const cashInParts = [
    { label: "مقبوض البيع", amount: data.paidTotal },
    { label: "تسديد ديون", amount: paymentsReceived },
    { label: "مشروبات عمال", amount: workerDrinksPaid }
  ];
  const cashOutParts = [
    { label: "مشتريات", amount: data.purchasesTotal },
    { label: "مصروفات عامة", amount: data.expensesTotal },
    { label: "سلف عمال", amount: data.workerTransactionSummary.advances },
    { label: "قبضات عمال مدفوعة", amount: data.workerTransactionSummary.salaryPaid },
    { label: "دفعات لعملاء", amount: payoutsPaid }
  ];

  const inventoryNet = Number(data.inventorySummary.net || 0);
  const profitAfterInventory = data.profitWithWorkersPayrollAndInventory;

  const card = (label, value, tone = "") => `
    <article class="report-card ${tone ? `is-${tone}` : ""}">
      <span>${label}</span>
      <strong>${value}</strong>
    </article>
  `;
  const amountCard = (label, amount, tone = "") => Number(amount || 0) > 0.001 ? card(label, money(amount), tone) : "";
  const moneyPartsText = (parts, emptyText = "لا توجد حركة") => {
    const visible = parts.filter((part) => Number(part.amount || 0) > 0.001);
    return visible.length
      ? visible.map((part) => `${part.label} ${money(part.amount)}`).join(" + ")
      : emptyText;
  };

  els.reportSummaryGrid.innerHTML = `
    <div class="cashbox-card ${cashNet >= 0 ? "is-positive" : "is-negative"}">
      <div class="cashbox-main">
        <span>💰 المفروض زاد صندوقي هالفترة</span>
        <strong>${money(cashNet)}</strong>
        <small>اللي بالصندوق الآن = هذا الرقم + اللي كان موجود أول الفترة</small>
      </div>
      <div class="cashbox-breakdown">
        <div class="cashbox-flow cashbox-in">
          <strong>⬇ دخل: ${money(cashIn)}</strong>
          <small>${moneyPartsText(cashInParts, "لا يوجد دخل")}</small>
        </div>
        <div class="cashbox-flow cashbox-out">
          <strong>⬆ طلع: ${money(cashOut)}</strong>
          <small>${moneyPartsText(cashOutParts, "لا يوجد طالع")}</small>
        </div>
      </div>
    </div>

    <div class="report-group">
      <h4>🛒 المبيعات</h4>
      <div class="report-group-grid">
        ${card("عدد الفواتير", quantityText(data.saleInvoices.length))}
        ${card("إجمالي المبيعات", money(data.salesTotal), "sales")}
        ${card("المقبوض منها", money(data.paidTotal), "success")}
        ${card("الدين الحالي للعملاء", data.customerSummary.debt > 0.001 ? money(data.customerSummary.debt) : "لا يوجد", data.customerSummary.debt > 0.001 ? "danger" : "neutral")}
      </div>
    </div>

    <div class="report-group">
      <h4>📉 المصروفات والالتزامات</h4>
      <div class="report-group-grid">
        ${amountCard("مشتريات", data.purchasesTotal, "danger")}
        ${amountCard("مصروفات عامة", data.expensesTotal, "danger")}
        ${amountCard("سلف عمال", data.workerTransactionSummary.advances, "danger")}
        ${amountCard("قبضات عمال مدفوعة", data.workerTransactionSummary.salaryPaid, "danger")}
        ${amountCard("مستحق عمال غير مدفوع", data.workerDueTotal, "neutral")}
        ${Number(data.purchasesTotal || 0) <= 0.001 && Number(data.expensesTotal || 0) <= 0.001 && Number(data.workerTransactionSummary.advances || 0) <= 0.001 && Number(data.workerTransactionSummary.salaryPaid || 0) <= 0.001 && Number(data.workerDueTotal || 0) <= 0.001
          ? card("لا توجد مصروفات", "لا يوجد", "neutral")
          : ""}
      </div>
    </div>

    <div class="report-group">
      <h4>📦 الجرد (خسارة/زيادة البضاعة)</h4>
      <div class="report-group-grid">
        ${data.inventorySummary.count > 0
          ? card(inventoryNet < 0 ? "خسارة الجرد" : inventoryNet > 0 ? "ربح الجرد" : "صافي الجرد", money(Math.abs(inventoryNet)), inventoryNet < 0 ? "danger" : inventoryNet > 0 ? "success" : "neutral")
          : card("عمليات الجرد بالفترة", "لا يوجد جرد", "neutral")}
        ${card("قيمة الزيادة", money(data.inventorySummary.increase), "success")}
        ${card("قيمة النقص", money(data.inventorySummary.decrease), "danger")}
        ${card("عدد عمليات الجرد", quantityText(data.inventorySummary.count), "neutral")}
      </div>
    </div>

    <div class="report-group">
      <h4>📈 الربح</h4>
      <div class="report-group-grid">
        ${card("ربح الأصناف المباعة", money(data.itemProfit), data.itemProfit >= 0 ? "success" : "danger")}
        ${card("صافي استهلاك العمال", money(data.workerSummary.net), data.workerSummary.net >= 0 ? "success" : "danger")}
        ${card("خصومات تسديد العملاء", paymentDiscountTotal > 0.001 ? `-${money(paymentDiscountTotal)}` : money(0), paymentDiscountTotal > 0.001 ? "danger" : "neutral")}
        ${card("الربح قبل الجرد", money(data.profitWithWorkersAndPayroll), data.profitWithWorkersAndPayroll >= 0 ? "success" : "danger")}
        ${card("الربح الصافي النهائي", money(profitAfterInventory), profitAfterInventory >= 0 ? "success" : "danger")}
      </div>
    </div>

    <div class="report-group">
      <h4>👥 ديون العملاء</h4>
      <div class="report-group-grid">
        ${card("إلك عندهم الآن", data.customerSummary.debt > 0.001 ? money(data.customerSummary.debt) : "لا يوجد", data.customerSummary.debt > 0.001 ? "danger" : "neutral")}
        ${card("إلهم عندك الآن", data.customerSummary.credit > 0.001 ? money(data.customerSummary.credit) : "لا يوجد", data.customerSummary.credit > 0.001 ? "credit" : "neutral")}
        ${amountCard("دفعات عملاء بالفترة", paymentsReceived, "success")}
        ${amountCard("خصومات تسديد بالفترة", paymentDiscountTotal, paymentDiscountTotal > 0.001 ? "danger" : "neutral")}
        ${Number(paymentsReceived || 0) <= 0.001 && Number(data.customerSummary.debt || 0) <= 0.001 && Number(data.customerSummary.credit || 0) <= 0.001
          ? card("حسابات العملاء", "لا يوجد أرصدة حالية", "neutral")
          : ""}
      </div>
    </div>
  `;

  const saleMethodTotal = paymentMethods.reduce((sum, method) => sum + Number(data.salePayments[method] || 0), 0);
  els.reportPaymentsList.innerHTML = `
    <div class="pay-method-section">
      <h5>🛒 مقبوض البيع حسب الطريقة</h5>
      <div class="pay-method-grid">
        ${paymentMethods.map((method) => `
          <article class="pay-method-card">
            <span>${paymentLabels[method]}</span>
            <strong>${money(data.salePayments[method])}</strong>
            <small>${saleMethodTotal > 0 ? Math.round((Number(data.salePayments[method] || 0) / saleMethodTotal) * 100) : 0}%</small>
          </article>
        `).join("")}
      </div>
    </div>
    <div class="pay-method-section">
      <h5>📋 تفصيل كل الحركات حسب الطريقة</h5>
      ${paymentMethods.map((method) => `
        <article class="report-row">
          <div>
            <strong>${paymentLabels[method]}</strong>
            <small>${moneyPartsText([
              { label: "بيع", amount: data.salePayments[method] },
              { label: "تسديد ديون", amount: data.paymentPayments[method] },
              { label: "مشروبات عمال", amount: data.workerPayments[method] },
              { label: "سلف/قبضات مدفوعة", amount: data.workerTransactionPayments[method] },
              { label: "مصروفات عامة", amount: data.expensePayments[method] }
            ])}</small>
          </div>
          <span>${Number(data.purchasePayments[method] || 0) > 0.001 ? `مشتريات: ${money(data.purchasePayments[method])}` : ""}</span>
        </article>
      `).join("")}
    </div>`;

  els.reportItemsList.innerHTML = itemRows.length
    ? itemRows.map(({ item, stats }) => `
      <article class="report-row">
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <small>${escapeHtml(item.category)} | المباعة: ${quantityText(stats.qty)}</small>
        </div>
        <span>${money(stats.sales)} | ربح ${money(stats.profit)}</span>
      </article>
    `).join("")
    : '<div class="empty-state">لا توجد مبيعات أصناف ضمن الفترة.</div>';

  els.reportCustomersList.innerHTML = customerRows.length
    ? customerRows.map((customer) => `
      <article class="report-row ${Number(customer.balance || 0) > 0 ? "is-danger" : "is-credit"}">
        <div>
          <strong>${escapeHtml(customer.name)}</strong>
          <small>${customer.phone ? escapeHtml(customer.phone) : "بدون رقم جوال"}</small>
        </div>
        <span>${balanceText(Number(customer.balance || 0))}</span>
      </article>
    `).join("")
    : '<div class="empty-state">لا توجد أرصدة أو ديون حالية.</div>';

  els.reportInvoicesList.innerHTML = recentInvoices.length
    ? recentInvoices.map((invoice) => `
      <article class="report-row">
        <div>
          <strong>${escapeHtml(invoice.number || "فاتورة")}</strong>
          <small>${formatDate(invoice.createdAt)} | ${escapeHtml(invoice.customerName || "زبون نقدي")}</small>
        </div>
        <span>${money(invoice.total)} | ${statusText(invoice.status)}</span>
      </article>
    `).join("")
    : '<div class="empty-state">لا توجد فواتير ضمن الفترة.</div>';

  els.reportPurchasesList.innerHTML = recentPurchases.length
    ? recentPurchases.map((purchase) => {
      const lines = purchaseLines(purchase);
      const qty = lines.reduce((sum, line) => sum + Number(line.qty || 0), 0);
      const stockQty = lines.reduce((sum, line) => sum + purchaseLineStockQty(line), 0);
      return `
        <article class="report-row">
          <div>
            <strong>${escapeHtml(purchase.number || "فاتورة مشتريات")}</strong>
            <small>${formatDate(purchase.createdAt)}${purchase.supplier ? ` | ${escapeHtml(purchase.supplier)}` : ""}</small>
          </div>
          <span>${money(purchaseAmount(purchase))} | شراء ${quantityText(qty)} | مخزون ${quantityText(stockQty)}</span>
        </article>
      `;
    }).join("")
    : '<div class="empty-state">لا توجد مشتريات ضمن الفترة.</div>';

  els.reportGeneralExpensesList.innerHTML = recentGeneralExpenses.length
    ? recentGeneralExpenses.map((expense) => `
      <article class="report-row is-danger">
        <div>
          <strong>${escapeHtml(expense.title || "مصروف")}</strong>
          <small>${formatDate(expense.createdAt)} | ${paymentLabels[expense.method] || expense.method}${expense.note ? ` | ${escapeHtml(expense.note)}` : ""}</small>
        </div>
        <span>${money(expense.amount)}</span>
      </article>
    `).join("")
    : '<div class="empty-state">لا توجد مصروفات عامة ضمن الفترة.</div>';

  els.reportInventoryList.innerHTML = recentInventoryCounts.length
    ? recentInventoryCounts.map((record) => {
      const value = inventoryCountValue(record);
      const netLabel = value.net > 0.001 ? "ربح الجرد" : value.net < -0.001 ? "خسارة الجرد" : "صافي الجرد";
      const rowClass = value.net > 0.001 ? "is-credit" : value.net < -0.001 ? "is-danger" : "";
      return `
        <article class="report-row ${rowClass}">
          <div>
            <strong>${escapeHtml(record.number || "جرد")}</strong>
            <small>${formatDate(record.createdAt)}${record.note ? ` | ${escapeHtml(record.note)}` : ""} | فروقات: ${quantityText(record.changed || 0)}</small>
          </div>
          <span>${netLabel}: ${money(Math.abs(value.net))}</span>
        </article>
      `;
    }).join("")
    : '<div class="empty-state">لا توجد عمليات جرد ضمن الفترة.</div>';

  els.reportExpensesList.innerHTML = recentWorkerConsumptions.length
    ? recentWorkerConsumptions.map((entry) => `
      <article class="report-row ${entry.type === FREE_WORKER_CONSUMPTION_TYPE ? "is-danger" : "is-credit"}">
        <div>
          <strong>${escapeHtml(entry.workerName)} - ${escapeHtml(entry.itemName)}</strong>
          <small>${formatDate(entry.createdAt)} | ${workerConsumptionTypeLabel(entry.type)} | الكمية: ${quantityText(entry.qty)}</small>
        </div>
        <span>${entry.type === FREE_WORKER_CONSUMPTION_TYPE ? `تكلفة ${money(entry.costTotal)}` : money(entry.total)}</span>
      </article>
    `).join("")
    : '<div class="empty-state">لا يوجد استهلاك عمال ضمن الفترة.</div>';

  els.reportWorkersList.innerHTML = recentWorkerTransactions.length
    ? recentWorkerTransactions.map((entry) => {
      const isAdvance = entry.type === WORKER_ADVANCE_TYPE;
      return `
        <article class="report-row ${isAdvance ? "is-danger" : "is-credit"}">
          <div>
            <strong>${escapeHtml(entry.workerName)} - ${workerTransactionTypeLabel(entry.type)}</strong>
            <small>${formatDate(entry.createdAt)} | ${paymentLabels[entry.method] || entry.method}${entry.note ? ` | ${escapeHtml(entry.note)}` : ""}</small>
          </div>
          <span>${isAdvance ? "عليه " : "مدفوع له "}${money(entry.amount)}</span>
        </article>
      `;
    }).join("")
    : '<div class="empty-state">لا توجد سلف أو قبضات عمال ضمن الفترة.</div>';
}
