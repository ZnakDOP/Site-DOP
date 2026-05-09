(function () {
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

  const els = {
    catalog: document.getElementById("catalog"),
    cartLines: document.getElementById("cart-lines"),
    cartEmpty: document.getElementById("cart-empty"),
    shifts: document.getElementById("shifts"),
    total: document.getElementById("cart-total"),
    form: document.getElementById("reserve-form"),
    clientName: document.getElementById("client-name"),
    clientContact: document.getElementById("client-contact"),
    clientDates: document.getElementById("client-dates"),
    btnSubmit: document.getElementById("btn-reserve"),
    loadError: document.getElementById("load-error"),
  };

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

  function getShifts() {
    const v = parseInt(String(els.shifts.value), 10);
    return Number.isFinite(v) && v >= 1 ? v : 1;
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
    const contact = els.clientContact.value.trim();
    const dates = els.clientDates.value.trim();
    const lines = [];
    lines.push("Заявка на бронирование техники");
    lines.push("");
    lines.push(`Съёмочных смен: ${shifts}`);
    lines.push(`Имя: ${name || "—"}`);
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

  els.shifts.addEventListener("input", () => renderCart());

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
    const header = rows[0].map((h) => String(h).trim().toLowerCase());
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

  fetch("equipment.csv", { cache: "no-store" })
    .then((r) => {
      if (!r.ok) throw new Error("Не удалось загрузить каталог");
      return r.text();
    })
    .then((text) => {
      const rows = parseCsv(text);
      const data = catalogFromCsvRows(rows);
      if (!data.items.length) throw new Error("В CSV нет строк с техникой");
      catalog = data;
      pruneCart();
      els.loadError.hidden = true;
      renderCatalog();
      renderCart();
    })
    .catch(() => {
      els.loadError.hidden = false;
      els.loadError.textContent =
        "Не удалось загрузить equipment.csv. Проверьте файл или откройте сайт через локальный сервер (не file://).";
    });
})();
