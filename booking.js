(function () {
  const __bookingScriptSrc =
    typeof document !== "undefined" && document.currentScript && document.currentScript.src
      ? document.currentScript.src
      : "";

  const CART_KEY = "site-dop-booking-cart";
  const email = "a@gorushkindop.ru";

  /**
   * @type {{
   *   currency: string,
   *   items: { id: string, name: string, category: string, pricePerShift: number, maxQty?: number, kit?: string }[],
   * } | null}
   */
  let catalog = null;
  /** @type {Record<string, number>} */
  let cart = loadCart();

  let calViewYear = new Date().getFullYear();
  let calViewMonth = new Date().getMonth();
  /** 0 — следующий тап задаёт начало (и конец = тот же день); 1 — следующий тап задаёт конец */
  let calRangePhase = 0;

  const els = {
    catalog: document.getElementById("catalog"),
    cartLines: document.getElementById("cart-lines"),
    cartEmpty: document.getElementById("cart-empty"),
    dateFrom: document.getElementById("date-from"),
    dateTo: document.getElementById("date-to"),
    calGrid: document.getElementById("cal-grid"),
    calMonthLabel: document.getElementById("cal-month-label"),
    calPrev: document.getElementById("cal-prev"),
    calNext: document.getElementById("cal-next"),
    calReadout: document.getElementById("cal-readout"),
    shiftsCount: document.getElementById("shifts-count"),
    total: document.getElementById("cart-total"),
    form: document.getElementById("reserve-form"),
    clientName: document.getElementById("client-name"),
    clientProject: document.getElementById("client-project"),
    clientContact: document.getElementById("client-contact"),
    clientDates: document.getElementById("client-dates"),
    btnSubmit: document.getElementById("btn-reserve"),
    btnXl: document.getElementById("btn-xl"),
    xlStatus: document.getElementById("xl-status"),
    loadError: document.getElementById("load-error"),
  };

  function yyyyMmDd(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  /** Рядом с booking.js (важно для GitHub Pages и нестандартных путей). */
  function resolveAssetUrl(filename) {
    const scriptEl =
      __bookingScriptSrc || document.querySelector('script[src*="booking.js"]')?.src || "";
    if (scriptEl) {
      try {
        return new URL(filename, scriptEl).href;
      } catch {
        /* use page URL */
      }
    }
    try {
      return new URL(filename, document.baseURI).href;
    } catch {
      return new URL(filename, window.location.href).href;
    }
  }

  /**
   * ExcelJS при spliceRows/insertRow ломает merge, если _merges не синхронизирован.
   * Снимаем каждое объединение по модели Range из _merges (надёжнее, чем один прямоугольник A1:Hn).
   */
  function stripAllMerges(worksheet) {
    for (let pass = 0; pass < 80; pass++) {
      const merges = worksheet._merges;
      if (!merges || typeof merges !== "object") break;
      const keys = Object.keys(merges);
      if (!keys.length) break;
      for (const k of keys) {
        const dim = merges[k];
        if (!dim) continue;
        const t = dim.top;
        const l = dim.left;
        const b = dim.bottom;
        const r = dim.right;
        if (typeof t === "number" && typeof l === "number" && typeof b === "number" && typeof r === "number") {
          try {
            worksheet.unMergeCells(t, l, b, r);
          } catch {
            try {
              const ref = typeof dim.range === "string" ? dim.range.replace(/^[^!]*!/, "") : "";
              if (ref) worksheet.unMergeCells(ref);
            } catch {
              /* */
            }
          }
        }
      }
    }
  }

  function assertXlsxZipBuffer(buf) {
    const u8 = new Uint8Array(buf);
    if (u8.length < 4 || u8[0] !== 0x50 || u8[1] !== 0x4b) {
      const snippet = new TextDecoder("utf-8", { fatal: false }).decode(u8.slice(0, 120));
      throw new Error(
        "Сервер отдал не .xlsx (нет сигнатуры ZIP). Часто это HTML-страница 404. URL: " +
          resolveAssetUrl("estimate-template.xlsx") +
          (snippet.includes("<!DOCTYPE") || snippet.includes("<html")
            ? " — в ответе похоже HTML."
            : ""),
      );
    }
  }

  function applyCellStyleSafe(cell, style) {
    if (!style) return;
    try {
      cell.style = style;
    } catch (e) {
      console.warn("applyCellStyleSafe", e);
    }
  }

  /**
   * В шаблоне формулы заданы как shared (один master + clone). После spliceRows/insertRow
   * ExcelJS при writeBuffer валится: «Shared Formula master must exist above…».
   * Превращаем каждую ячейку в обычную формулу с явным текстом.
   */
  function dissolveSharedFormulasInSheet(ws, ExcelRef) {
    const ValueType = ExcelRef.ValueType || { Formula: 6 };
    const FormulaType = ExcelRef.FormulaType || { Master: 1, Shared: 2, None: 0 };
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (cell.type !== ValueType.Formula) return;
        const ft = cell.formulaType;
        if (ft === FormulaType.None) return;
        const fText = cell.formula;
        if (typeof fText !== "string" || !fText) return;
        const res = cell.result;
        cell.value =
          res !== undefined && res !== null ? { formula: fText, result: res } : { formula: fText };
      });
    });
  }

  function initDates() {
    if (!els.dateFrom || !els.dateTo) return;
    const today = yyyyMmDd(new Date());
    if (!els.dateFrom.value) els.dateFrom.value = today;
    if (!els.dateTo.value) els.dateTo.value = els.dateFrom.value;
  }

  function loadCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }

  function formatMoney(n) {
    if (!catalog) return String(n);
    return new Intl.NumberFormat("ru-RU").format(n) + " " + catalog.currency;
  }

  function parseDateInput(v) {
    if (!v) return null;
    const d = new Date(v + "T00:00:00");
    return Number.isFinite(d.getTime()) ? d : null;
  }

  function getShifts() {
    if (!els.dateFrom || !els.dateTo) return 1;
    const from = parseDateInput(els.dateFrom.value);
    const to = parseDateInput(els.dateTo.value);
    if (!from || !to) return 1;
    const ms = to.getTime() - from.getTime();
    const days = Math.floor(ms / 86400000) + 1;
    return days >= 1 ? days : 1;
  }

  function syncDateRange() {
    if (!els.dateFrom || !els.dateTo || !els.shiftsCount) return;
    if (els.dateFrom.value && els.dateTo.value && els.dateTo.value < els.dateFrom.value) {
      els.dateTo.value = els.dateFrom.value;
    }
    if (els.dateFrom.value && !els.dateTo.value) {
      els.dateTo.value = els.dateFrom.value;
    }
    els.shiftsCount.textContent = String(getShifts());
  }

  function syncCalViewFromFrom() {
    if (!els.dateFrom || !els.dateFrom.value) return;
    const d = parseDateInput(els.dateFrom.value);
    if (d) {
      calViewYear = d.getFullYear();
      calViewMonth = d.getMonth();
    }
  }

  function updateCalendarReadout() {
    if (!els.calReadout || !els.dateFrom || !els.dateTo) return;
    const a = els.dateFrom.value;
    const b = els.dateTo.value;
    if (!a || !b) {
      els.calReadout.textContent = "";
      return;
    }
    const da = parseDateInput(a);
    const db = parseDateInput(b);
    if (!da || !db) return;
    if (a === b) {
      els.calReadout.textContent = da.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } else {
      els.calReadout.textContent =
        da.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) +
        " — " +
        db.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
    }
  }

  function renderCalendarWidget() {
    if (!els.calGrid || !els.calMonthLabel) return;
    const rawMonth = new Date(calViewYear, calViewMonth, 1).toLocaleDateString("ru-RU", {
      month: "long",
      year: "numeric",
    });
    els.calMonthLabel.textContent = rawMonth.replace(/^./, (ch) => ch.toUpperCase());

    const fromStr = els.dateFrom ? els.dateFrom.value : "";
    const toStr = els.dateTo ? els.dateTo.value : "";
    const todayStr = yyyyMmDd(new Date());

    els.calGrid.innerHTML = "";
    const first = new Date(calViewYear, calViewMonth, 1);
    const startPad = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();

    let dayNum = 1;
    for (let i = 0; i < 42; i++) {
      if (i < startPad || dayNum > daysInMonth) {
        const ph = document.createElement("div");
        ph.className = "calendar-cell calendar-cell--empty";
        ph.setAttribute("aria-hidden", "true");
        els.calGrid.appendChild(ph);
        continue;
      }

      const ymd = yyyyMmDd(new Date(calViewYear, calViewMonth, dayNum));
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "calendar-cell";
      btn.textContent = String(dayNum);
      btn.setAttribute("data-ymd", ymd);

      if (ymd < todayStr) {
        btn.classList.add("calendar-cell--muted");
        btn.disabled = true;
      }
      if (ymd === todayStr) btn.classList.add("calendar-cell--today");

      const isFrom = Boolean(fromStr && ymd === fromStr);
      const isTo = Boolean(toStr && ymd === toStr);
      const inRange = Boolean(
        fromStr && toStr && fromStr !== toStr && ymd > fromStr && ymd < toStr,
      );

      if (isFrom || isTo) {
        btn.classList.add("calendar-cell--endpoint");
      } else if (inRange) {
        btn.classList.add("calendar-cell--in-range");
      }

      if (!btn.disabled) {
        btn.addEventListener("click", () => onCalendarDayClick(ymd));
      }

      els.calGrid.appendChild(btn);
      dayNum++;
    }

    updateCalendarReadout();
  }

  function onCalendarDayClick(ymd) {
    if (!els.dateFrom || !els.dateTo) return;
    if (calRangePhase === 0) {
      els.dateFrom.value = ymd;
      els.dateTo.value = ymd;
      calRangePhase = 1;
    } else {
      const curFrom = els.dateFrom.value;
      if (ymd < curFrom) {
        els.dateTo.value = curFrom;
        els.dateFrom.value = ymd;
      } else {
        els.dateTo.value = ymd;
      }
      calRangePhase = 0;
    }
    syncDateRange();
    renderCart();
    renderCalendarWidget();
  }

  function bindCalendarNav() {
    if (els.calPrev) {
      els.calPrev.addEventListener("click", () => {
        calViewMonth -= 1;
        if (calViewMonth < 0) {
          calViewMonth = 11;
          calViewYear -= 1;
        }
        renderCalendarWidget();
      });
    }
    if (els.calNext) {
      els.calNext.addEventListener("click", () => {
        calViewMonth += 1;
        if (calViewMonth > 11) {
          calViewMonth = 0;
          calViewYear += 1;
        }
        renderCalendarWidget();
      });
    }
  }

  /** @param {{ maxQty?: number }} item */
  function getMaxQty(item) {
    return typeof item.maxQty === "number" && item.maxQty >= 1 ? item.maxQty : Number.POSITIVE_INFINITY;
  }

  function pruneCart() {
    if (!catalog) return;
    const ids = new Set(catalog.items.map((i) => i.id));
    let changed = false;
    for (const k of Object.keys(cart)) {
      if (!ids.has(k)) {
        delete cart[k];
        changed = true;
      }
    }
    for (const item of catalog.items) {
      const maxQ = getMaxQty(item);
      if ((cart[item.id] || 0) > maxQ) {
        cart[item.id] = maxQ;
        changed = true;
      }
    }
    if (changed) saveCart();
  }

  function renderCatalog() {
    if (!catalog || !els.catalog) return;
    const byCat = new Map();
    for (const item of catalog.items) {
      if (!byCat.has(item.category)) byCat.set(item.category, []);
      byCat.get(item.category).push(item);
    }

    els.catalog.innerHTML = "";
    for (const [category, items] of byCat) {
      const section = document.createElement("section");
      section.className = "booking-category";
      section.innerHTML = `<h2>${escapeHtml(category)}</h2>`;
      for (const item of items) {
        const row = document.createElement("div");
        row.className = "equipment-row";
        const kitBlock = item.kit
          ? `<div class="equipment-kit">${escapeHtml(item.kit)}</div>`
          : "";
        const stockNote =
          typeof item.maxQty === "number"
            ? `<div class="equipment-stock">До ${item.maxQty} шт. в парке</div>`
            : "";
        row.innerHTML = `
          <div class="equipment-cell-main">
            <div class="equipment-name">${escapeHtml(item.name)}</div>
            ${kitBlock}
            ${stockNote}
          </div>
          <div class="equipment-price">${formatMoney(item.pricePerShift)} / смена</div>
          <button type="button" class="btn-add" data-id="${escapeHtml(item.id)}">В корзину</button>
        `;
        section.appendChild(row);
        const btn = row.querySelector(".btn-add");
        const maxQ = getMaxQty(item);
        const q = cart[item.id] || 0;
        if (btn) btn.disabled = q >= maxQ;
      }
      els.catalog.appendChild(section);
    }

    els.catalog.querySelectorAll(".btn-add").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        if (!id || !catalog) return;
        const item = catalog.items.find((i) => i.id === id);
        if (!item) return;
        const maxQ = getMaxQty(item);
        const next = (cart[id] || 0) + 1;
        if (next > maxQ) return;
        cart[id] = next;
        saveCart();
        renderCatalog();
        renderCart();
      });
    });
  }

  function renderCart() {
    if (!catalog) return;
    const shifts = getShifts();
    let subtotal = 0;

    if (!Object.keys(cart).length) {
      els.cartEmpty.hidden = false;
      els.cartLines.innerHTML = "";
      els.total.textContent = formatMoney(0);
      els.btnSubmit.disabled = true;
      if (els.btnXl) els.btnXl.disabled = true;
      return;
    }

    els.cartEmpty.hidden = true;
    els.cartLines.innerHTML = "";

    for (const item of catalog.items) {
      const qty = cart[item.id] || 0;
      if (!qty) continue;
      const line = qty * item.pricePerShift * shifts;
      subtotal += line;
      const maxQ = getMaxQty(item);
      const atMax = qty >= maxQ;

      const row = document.createElement("div");
      row.className = "cart-line";
      row.innerHTML = `
        <div>
          <div class="cart-line-title">${escapeHtml(item.name)}</div>
          <div class="cart-line-meta">
            ${formatMoney(item.pricePerShift)} × ${qty} ед. × ${shifts} ${pluralShifts(shifts)}
          </div>
        </div>
        <div class="cart-qty">
          <button type="button" aria-label="Уменьшить" data-act="minus" data-id="${escapeHtml(item.id)}">−</button>
          <span>${qty}</span>
          <button type="button" aria-label="Добавить" data-act="plus" data-id="${escapeHtml(
            item.id,
          )}" ${atMax ? "disabled" : ""}>+</button>
        </div>
      `;
      els.cartLines.appendChild(row);
    }

    els.total.textContent = formatMoney(subtotal);
    els.btnSubmit.disabled = false;
    if (els.btnXl) els.btnXl.disabled = false;

    els.cartLines.querySelectorAll("button[data-act]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const act = btn.getAttribute("data-act");
        if (!id || !cart[id] || !catalog) return;
        const item = catalog.items.find((i) => i.id === id);
        if (!item) return;
        const maxQ = getMaxQty(item);
        if (act === "plus") {
          if (cart[id] >= maxQ) return;
          cart[id] += 1;
        }
        if (act === "minus") cart[id] -= 1;
        if (cart[id] <= 0) delete cart[id];
        saveCart();
        renderCatalog();
        renderCart();
      });
    });
  }

  function pluralShifts(n) {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return "смена";
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return "смены";
    return "смен";
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildMailBody() {
    const shifts = getShifts();
    const name = els.clientName.value.trim();
    const project = els.clientProject ? els.clientProject.value.trim() : "";
    const contact = els.clientContact.value.trim();
    const dates = els.clientDates.value.trim();
    const lines = [];
    lines.push("Заявка на бронирование техники");
    lines.push("");
    lines.push(`Съёмочных смен: ${shifts}`);
    lines.push(`Период аренды: ${els.dateFrom.value || "—"} — ${els.dateTo.value || "—"}`);
    lines.push(`Имя: ${name || "—"}`);
    lines.push(`Проект: ${project || "—"}`);
    lines.push(`Контакт: ${contact || "—"}`);
    lines.push(`Даты / площадка / комментарий: ${dates || "—"}`);
    lines.push("");
    lines.push("Состав:");
    let subtotal = 0;
    for (const item of catalog.items) {
      const qty = cart[item.id] || 0;
      if (!qty) continue;
      const line = qty * item.pricePerShift * shifts;
      subtotal += line;
      lines.push(`- ${item.name} × ${qty} — ${formatMoney(line)}`);
    }
    lines.push("");
    lines.push(`Итого: ${formatMoney(subtotal)}`);
    return lines.join("\n");
  }

  function buildCartRows() {
    if (!catalog) return [];
    const shifts = getShifts();
    const rows = [];
    for (const item of catalog.items) {
      const qty = cart[item.id] || 0;
      if (!qty) continue;
      const line = qty * item.pricePerShift * shifts;
      rows.push({
        name: item.name,
        qty,
        pricePerShift: item.pricePerShift,
        shifts,
        total: line,
      });
    }
    return rows;
  }

  /**
   * @returns {{ kind: "cat", name: string } | { kind: "item", item: { name: string, pricePerShift: number }, qty: number }}[]
   */
  function buildGroupedEstimateBlocks() {
    if (!catalog) return [];
    const byCat = new Map();
    for (const item of catalog.items) {
      const qty = cart[item.id] || 0;
      if (!qty) continue;
      if (!byCat.has(item.category)) byCat.set(item.category, []);
      byCat.get(item.category).push({ item, qty });
    }
    /** @type {{ kind: "cat", name: string } | { kind: "item", item: typeof catalog.items[0], qty: number }}[] */
    const blocks = [];
    for (const [catName, list] of byCat) {
      blocks.push({ kind: "cat", name: catName });
      for (const row of list) blocks.push({ kind: "item", item: row.item, qty: row.qty });
    }
    return blocks;
  }

  function setXlStatus(text, isError) {
    if (!els.xlStatus) return;
    els.xlStatus.hidden = false;
    els.xlStatus.textContent = text;
    els.xlStatus.style.color = isError ? "#7d1e1e" : "var(--muted)";
  }

  async function openCartInXl() {
    const blocks = buildGroupedEstimateBlocks();
    if (!blocks.length || !catalog) {
      setXlStatus("Добавьте позиции в корзину.", true);
      return;
    }

    const ExcelJSGlobal = window.ExcelJS;
    if (!ExcelJSGlobal) {
      setXlStatus("Не загрузилась библиотека Excel (ExcelJS). Проверьте интернет и обновите страницу.", true);
      return;
    }

    const projectTitle =
      (els.clientProject && els.clientProject.value.trim()) ||
      (els.clientName && els.clientName.value.trim()) ||
      "Смета Znak Rent";
    const shifts = getShifts();

    try {
      if (els.btnXl) els.btnXl.disabled = true;
      setXlStatus("Собираю смету в Excel…", false);

      const tplUrl = new URL(resolveAssetUrl("estimate-template.xlsx"));
      tplUrl.searchParams.set("v", "tochka-blog-1");
      const res = await fetch(tplUrl.href, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(
          `Шаблон estimate-template.xlsx не загрузился (HTTP ${res.status}). Проверьте, что файл в репозитории и попал в деплой.`,
        );
      }

      const buf = await res.arrayBuffer();
      assertXlsxZipBuffer(buf);

      let wb = new ExcelJSGlobal.Workbook();
      try {
        await wb.xlsx.load(buf);
      } catch {
        wb = new ExcelJSGlobal.Workbook();
        await wb.xlsx.load(new Uint8Array(buf));
      }

      const ws = wb.getWorksheet("Смета техника");
      if (!ws) {
        throw new Error('В шаблоне нет листа «Смета техника». Скачайте estimate-template.xlsx из репозитория.');
      }

      dissolveSharedFormulasInSheet(ws, ExcelJSGlobal);

      const srcCatRow = ws.getRow(4);
      const srcItemRow = ws.getRow(5);
      const styleCat = srcCatRow.getCell(1).style;
      /** @type {Record<number, object | undefined>} */
      const styleItemCells = {};
      srcItemRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        styleItemCells[colNumber] = cell.style;
      });
      const styleSumG = ws.getCell("G37").style;
      const styleSumH = ws.getCell("H37").style;

      let maxR = 3;
      ws.eachRow((row, rowNumber) => {
        if (rowNumber > maxR) maxR = rowNumber;
      });
      stripAllMerges(ws);

      if (maxR > 3) ws.spliceRows(4, maxR - 3);

      const totalInserted = blocks.length + 1;
      for (let i = 0; i < totalInserted; i++) {
        ws.insertRow(4);
      }

      ws.getCell("A1").value = projectTitle;
      try {
        ws.mergeCells("A1:H1");
        ws.mergeCells("A3:H3");
      } catch {
        /* шапка без merge — редкий случай */
      }

      let r = 4;
      for (const b of blocks) {
        const row = ws.getRow(r);
        if (b.kind === "cat") {
          try {
            ws.mergeCells(`A${r}:H${r}`);
          } catch {
            /* merge может уже существовать в редких случаях */
          }
          const a = row.getCell(1);
          a.value = b.name;
          applyCellStyleSafe(a, styleCat);
          if (srcCatRow.height) row.height = srcCatRow.height;
        } else {
          row.getCell(1).value = b.item.name;
          row.getCell(2).value = b.qty;
          row.getCell(3).value = b.item.pricePerShift;
          row.getCell(4).value = { formula: `B${r}*C${r}` };
          row.getCell(5).value = shifts;
          row.getCell(6).value = { formula: `D${r}*E${r}` };
          row.getCell(7).value = 30;
          row.getCell(8).value = { formula: `F${r}*(1-G${r}%)` };
          for (let c = 1; c <= 8; c++) {
            const st = styleItemCells[c];
            if (st) applyCellStyleSafe(row.getCell(c), st);
          }
          if (srcItemRow.height) row.height = srcItemRow.height;
        }
        r++;
      }

      const rSum = r;
      const sumRow = ws.getRow(rSum);
      sumRow.getCell(7).value = "Итог";
      applyCellStyleSafe(sumRow.getCell(7), styleSumG);
      sumRow.getCell(8).value = { formula: `SUM(H4:H${rSum - 1})` };
      applyCellStyleSafe(sumRow.getCell(8), styleSumH);

      dissolveSharedFormulasInSheet(ws, ExcelJSGlobal);

      const out = await wb.xlsx.writeBuffer();
      const blob = new Blob([out], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const nameSafe = projectTitle.replace(/[\\/:*?"<>|]/g, " ").trim().slice(0, 72) || "Znak-Rent";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `Смета ${nameSafe}.xlsx`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 60_000);

      setXlStatus("Файл сметы скачан — откройте его в Excel.", false);
    } catch (err) {
      const msg =
        err && typeof err.message === "string"
          ? err.message
          : "Неизвестная ошибка при сборке файла.";
      console.error("openCartInXl:", err);
      setXlStatus(
        msg.length > 220 ? msg.slice(0, 217) + "…" : msg,
        true,
      );
    } finally {
      renderCart();
    }
  }

  bindCalendarNav();

  if (els.btnXl) els.btnXl.addEventListener("click", openCartInXl);

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!catalog || !Object.keys(cart).length) return;
    const subject = encodeURIComponent(
      `Бронирование техники — ${getShifts()} ${pluralShifts(getShifts())}`,
    );
    const body = encodeURIComponent(buildMailBody());
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  });

  function detectDelimiter(s) {
    const line = s.split(/\r\n|\n|\r/, 1)[0] || "";
    const commas = (line.match(/,/g) || []).length;
    const semis = (line.match(/;/g) || []).length;
    return semis > commas ? ";" : ",";
  }

  function parseCsv(text) {
    const s = String(text).replace(/^\uFEFF/, "");
    const delim = detectDelimiter(s);
    const rows = [];
    let row = [];
    let field = "";
    let i = 0;
    let inQuotes = false;
    while (i < s.length) {
      const c = s[i];
      if (inQuotes) {
        if (c === '"') {
          if (s[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i++;
          continue;
        }
        field += c;
        i++;
        continue;
      }
      if (c === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (c === delim) {
        row.push(field);
        field = "";
        i++;
        continue;
      }
      if (c === "\r") {
        i++;
        continue;
      }
      if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        i++;
        continue;
      }
      field += c;
      i++;
    }
    row.push(field);
    if (row.length > 1 || (row.length === 1 && row[0] !== "")) rows.push(row);
    return rows;
  }

  function catalogFromCsvRows(rows) {
    if (!rows.length) throw new Error("Пустой CSV");
    const header = rows[0].map((h) =>
      String(h)
        .replace(/^\uFEFF/, "")
        .trim()
        .toLowerCase(),
    );
    const col = (name) => header.indexOf(name);
    const idx = {
      id: col("id"),
      name: col("name"),
      category: col("category"),
      pricePerShift: col("pricepershift"),
      maxQty: col("maxqty"),
      kit: col("kit"),
    };
    if (idx.id < 0 || idx.name < 0 || idx.category < 0 || idx.pricePerShift < 0) {
      throw new Error("В первой строке CSV нужны столбцы: id, name, category, pricePerShift");
    }
    const items = [];
    for (let r = 1; r < rows.length; r++) {
      const cells = rows[r];
      if (!cells || cells.every((c) => !String(c).trim())) continue;
      const name = String(cells[idx.name] ?? "").trim();
      if (!name) continue;
      let id = String(cells[idx.id] ?? "").trim();
      if (!id) id = "item-" + r;
      const category = String(cells[idx.category] ?? "").trim();
      if (!category) continue;
      const priceRaw = String(cells[idx.pricePerShift] ?? "")
        .trim()
        .replace(/\s/g, "")
        .replace(",", ".");
      const pricePerShift = parseFloat(priceRaw);
      if (!Number.isFinite(pricePerShift) || pricePerShift < 0) continue;
      /** @type {{ id: string, name: string, category: string, pricePerShift: number, maxQty?: number, kit?: string }} */
      const item = {
        id,
        name,
        category,
        pricePerShift: Math.round(pricePerShift),
      };
      if (idx.maxQty >= 0) {
        const mq = String(cells[idx.maxQty] ?? "").trim();
        if (mq !== "") {
          const n = parseInt(mq, 10);
          if (Number.isFinite(n) && n >= 1) item.maxQty = n;
        }
      }
      if (idx.kit >= 0) {
        const kit = String(cells[idx.kit] ?? "").trim();
        if (kit) item.kit = kit;
      }
      items.push(item);
    }
    const seen = new Set();
    for (const item of items) {
      let base = item.id;
      let id = base;
      let n = 0;
      while (seen.has(id)) {
        n += 1;
        id = base + "-" + n;
      }
      item.id = id;
      seen.add(id);
    }
    return { currency: "₽", items };
  }

  initDates();
  syncDateRange();
  syncCalViewFromFrom();
  calRangePhase = 0;
  renderCalendarWidget();

  const equipmentCsvUrl = new URL("equipment.csv", window.location.href);
  equipmentCsvUrl.searchParams.set("v", "znak-rent-pdf-60");
  fetch(equipmentCsvUrl.href, { cache: "no-store" })
    .then((r) => {
      if (!r.ok) throw new Error("HTTP " + r.status + " при загрузке equipment.csv");
      return r.text();
    })
    .then((text) => {
      const rows = parseCsv(text);
      const data = catalogFromCsvRows(rows);
      if (!data.items.length) throw new Error("В CSV нет строк с техникой");
      catalog = data;
      pruneCart();
      syncDateRange();
      if (els.loadError) els.loadError.hidden = true;
      renderCatalog();
      renderCart();
    })
    .catch((err) => {
      if (els.loadError) {
        els.loadError.hidden = false;
        els.loadError.textContent =
          "Не удалось загрузить каталог (equipment.csv). " +
          (err && err.message ? err.message : "") +
          " Убедитесь, что файл есть на сервере и страница открыта по http(s), не file://.";
      }
      if (els.catalog) {
        els.catalog.innerHTML =
          '<p class="catalog-fallback">Каталог не загрузился. Проверьте, что в корне сайта лежит файл equipment.csv и он попал в деплой.</p>';
      }
    });
})();
