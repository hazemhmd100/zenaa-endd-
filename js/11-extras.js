// ═══ دفتر المقهى ═══ 11-extras.js — تذكير النسخ، تقرير اليوم، نقص المخزون، الأكثر مبيعاً
// (مقسوم من app.js — الأسطر 5342-5518)

// ─── End Period Close ───────────────────────────────────────────────────────

// ─── النسخ الاحتياطي: تذكير أسبوعي ──────────────────────────────────────────

const LAST_BACKUP_KEY = "cafe-pos-last-backup-at";
const BACKUP_SNOOZE_KEY = "cafe-pos-backup-snooze-until";

function markBackupDone() {
  localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
  els.backupReminderBanner.hidden = true;
}

function renderBackupReminder() {
  const hasData = state.invoices.length || (state.purchases || []).length;
  if (!hasData) { els.backupReminderBanner.hidden = true; return; }

  const snoozeUntil = localStorage.getItem(BACKUP_SNOOZE_KEY);
  if (snoozeUntil && new Date() < new Date(snoozeUntil)) {
    els.backupReminderBanner.hidden = true;
    return;
  }

  const last = localStorage.getItem(LAST_BACKUP_KEY);
  const days = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000) : null;
  const due = !last || days >= 7;
  els.backupReminderBanner.hidden = !due;
  if (due) {
    const text = document.getElementById("backupReminderText");
    if (text) {
      text.textContent = last
        ? `⚠️ آخر نسخة احتياطية قبل ${days} يوم — صدّر نسخة واحفظها على جوجل درايف أو ابعثها واتساب لنفسك!`
        : "⚠️ ما في ولا نسخة احتياطية — بياناتك كلها على هذا الجهاز فقط! صدّر نسخة الآن.";
    }
  }
}

function snoozeBackupReminder() {
  const tomorrow = new Date(Date.now() + 86400000);
  localStorage.setItem(BACKUP_SNOOZE_KEY, tomorrow.toISOString());
  els.backupReminderBanner.hidden = true;
}

// ─── تنقّل الجوال: قائمة المزيد ───────────────────────────────────────────────

const MOBILE_MORE_VIEWS = ["settings", "purchases", "inventory", "expenses", "close", "guide"];

function openMoreSheet() {
  if (els.mobileMoreSheet) els.mobileMoreSheet.hidden = false;
}

function closeMoreSheet() {
  if (els.mobileMoreSheet) els.mobileMoreSheet.hidden = true;
}

function syncMobileMoreActive() {
  if (!els.mobileMoreButton) return;
  els.mobileMoreButton.classList.toggle("is-active", MOBILE_MORE_VIEWS.includes(state.view));
}

// ─── اسم المحل + صفحة الدليل ─────────────────────────────────────────────────

function businessName() {
  return (state.businessName && state.businessName.trim()) || "دفتر المقهى";
}

function applyBusinessName() {
  const name = businessName();
  if (els.brandTitle) els.brandTitle.textContent = name;
  if (els.brandMark) els.brandMark.textContent = name.trim().charAt(0) || "د";
  document.title = `${name} | نظام طاولات وفواتير`;
}

function saveBusinessName() {
  const value = (els.businessNameInput.value || "").trim();
  if (!value) { showToast("اكتب اسم المحل."); return; }
  state.businessName = value;
  saveState();
  applyBusinessName();
  showToast("تم حفظ الاسم.");
}

function renderGuide() {
  if (els.businessNameInput && document.activeElement !== els.businessNameInput) {
    els.businessNameInput.value = businessName();
  }
  if (!els.guideLive) return;
  const cash = cashOnHand().total.current;
  const last = localStorage.getItem(LAST_BACKUP_KEY);
  const days = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000) : null;
  const backupText = last ? `آخر نسخة احتياطية قبل ${days} يوم` : "ما في نسخة احتياطية بعد ⚠️";
  const backupClass = (!last || days >= 7) ? "guide-live-warn" : "guide-live-ok";
  const lastClose = (state.periodCloses || []).slice().sort((a, b) => String(b.to).localeCompare(String(a.to)))[0];
  if (els.guideBackupStatus) {
    els.guideBackupStatus.textContent = last
      ? `آخر نسخة قبل ${days} يوم — ${days >= 7 ? "متأخرة، صدّر نسخة الآن" : "تمام"}`
      : "ما في نسخة بعد — صدّر نسخة واحفظها بمكان آمن";
  }
  els.guideLive.innerHTML = `
    <article class="guide-live-card"><span>💵 الكاش اللي معك الآن</span><strong>${money(cash)}</strong></article>
    <article class="guide-live-card ${backupClass}"><span>🛡️ النسخ الاحتياطي</span><strong>${backupText}</strong></article>
    <article class="guide-live-card"><span>🔒 آخر إغلاق</span><strong>${lastClose ? lastClose.to : "لا يوجد"}</strong></article>
  `;
}

// ─── تقرير نهاية اليوم (Z-Report) ───────────────────────────────────────────

function printDayReport() {
  const todayKey = todayDateInputValue();
  const range = { minDate: todayKey, maxDate: todayKey };
  const data = reportData(range);

  const paymentsReceived = data.paymentInvoices.reduce((sum, invoice) => sum + Number(invoice.paid || 0), 0);
  const methodRows = paymentMethods.map((method) => `
    <tr>
      <td>${paymentLabels[method]}</td>
      <td>${money(data.invoicePayments[method] || 0)}</td>
    </tr>
  `).join("");

  const host = document.createElement("div");
  host.className = "print-host";
  host.innerHTML = `
    <div class="print-invoice">
      <h1>🧾 تقرير نهاية اليوم — ${escapeHtml(businessName())}</h1>
      <p class="print-meta">${formatDate(new Date().toISOString())}</p>
      <table class="statement-table">
        <tr><th>عدد فواتير البيع</th><td>${quantityText(data.saleInvoices.length)}</td></tr>
        <tr><th>إجمالي المبيعات</th><td>${money(data.salesTotal)}</td></tr>
        <tr><th>المقبوض من البيع</th><td>${money(data.paidTotal)}</td></tr>
        <tr><th>الدين الحالي للعملاء</th><td>${data.customerSummary.debt > 0.001 ? money(data.customerSummary.debt) : "لا يوجد"}</td></tr>
        <tr><th>سداد ديون (دفعات عملاء)</th><td>${money(paymentsReceived)}</td></tr>
        <tr><th>المشتريات</th><td>${money(data.purchasesTotal)}</td></tr>
        <tr><th>ربح الأصناف</th><td>${money(data.itemProfit)}</td></tr>
      </table>
      <h1 style="font-size:14px;margin-top:14px;">حسب طريقة الدفع (بيع وتسديد)</h1>
      <table class="statement-table">${methodRows}</table>
      <p class="print-meta" style="margin-top:14px;">قارن المجموع مع الصندوق قبل الإغلاق ✍</p>
    </div>
  `;
  document.body.appendChild(host);
  window.print();
  host.remove();
}

// ─── تنبيه نقص المخزون ──────────────────────────────────────────────────────

function lowStockItems() {
  const threshold = Number(state.lowStockThreshold || 0);
  const purchaseItems = purchaseInventoryItems();
  const menuItems = state.menu.filter((item) => isStockTracked(item) && !menuItemComponents(item).length);
  return purchaseItems.concat(menuItems)
    .filter((item) => Number(item.stockQty || 0) <= threshold)
    .sort((a, b) => Number(a.stockQty || 0) - Number(b.stockQty || 0));
}

function renderLowStock() {
  if (!els.lowStockPanel) return;
  els.lowStockThresholdInput.value = state.lowStockThreshold;
  const items = lowStockItems();

  els.lowStockList.innerHTML = items.length
    ? items.map((item) => `
      <article class="low-stock-row ${Number(item.stockQty || 0) <= 0 ? "is-empty" : ""}">
        <strong>${escapeHtml(item.name)}</strong>
        <span>${quantityWithUnit(Number(item.stockQty || 0), itemUnit(item))}</span>
      </article>
    `).join("")
    : '<div class="empty-state">كل المخزون فوق حد التنبيه ✓</div>';

  // شارة على تبويب الجرد
  const inventoryTab = Array.from(els.tabs).find((tab) => tab.dataset.view === "inventory");
  if (inventoryTab) {
    let badge = inventoryTab.querySelector(".tab-alert-badge");
    if (items.length) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "tab-alert-badge";
        inventoryTab.appendChild(badge);
      }
      badge.textContent = items.length;
    } else if (badge) {
      badge.remove();
    }
  }
}

// ─── الأكثر مبيعاً + أوقات الذروة ───────────────────────────────────────────

function renderTopItemsAndPeakHours() {
  if (!els.reportTopItemsList) return;
  const range = selectedReportRange();
  const saleInvoices = state.invoices.filter((invoice) => invoice.type === "sale" && dateMatchesRange(invoice, range));

  // الأكثر مبيعاً
  const totals = new Map();
  saleInvoices.forEach((invoice) => {
    (invoice.items || []).forEach((line) => {
      const key = line.name;
      const entry = totals.get(key) || { name: line.name, qty: 0, sales: 0 };
      entry.qty += Number(line.qty || 0);
      entry.sales += Number(line.qty || 0) * Number(line.price || 0);
      totals.set(key, entry);
    });
  });
  const top = Array.from(totals.values()).sort((a, b) => b.qty - a.qty).slice(0, 10);
  const maxQty = top.length ? top[0].qty : 0;

  els.reportTopItemsList.innerHTML = top.length
    ? top.map((entry, index) => `
      <article class="top-item-row">
        <span class="top-item-rank">${index + 1}</span>
        <div class="top-item-info">
          <strong>${escapeHtml(entry.name)}</strong>
          <div class="top-item-bar"><div class="top-item-bar-fill" style="width:${maxQty ? Math.round((entry.qty / maxQty) * 100) : 0}%"></div></div>
        </div>
        <span class="top-item-figures">${quantityText(entry.qty)} | ${money(entry.sales)}</span>
      </article>
    `).join("")
    : '<div class="empty-state">لا توجد مبيعات ضمن الفترة.</div>';

  // أوقات الذروة
  const hours = new Array(24).fill(0);
  saleInvoices.forEach((invoice) => {
    const hour = new Date(invoice.createdAt).getHours();
    hours[hour] += Number(invoice.total || 0);
  });
  const maxHour = Math.max(...hours);

  els.reportHoursChart.innerHTML = maxHour > 0
    ? `<div class="peak-hours-bars">${hours.map((value, hour) => `
        <div class="peak-hour-col ${value === maxHour ? "is-peak" : ""}" title="الساعة ${hour}:00 — ${money(value)}">
          <div class="peak-hour-bar" style="height:${Math.max(Math.round((value / maxHour) * 100), value > 0 ? 4 : 0)}%"></div>
          <span class="peak-hour-label">${hour}</span>
        </div>
      `).join("")}</div>
      <p class="peak-hours-note">أعلى ذروة: الساعة ${hours.indexOf(maxHour)}:00 بمبيعات ${money(maxHour)}</p>`
    : '<div class="empty-state">لا توجد مبيعات ضمن الفترة.</div>';
}
