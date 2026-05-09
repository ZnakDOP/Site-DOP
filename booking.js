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

  fetch("equipment.json", { cache: "no-store" })
    .then((r) => {
      if (!r.ok) throw new Error("Не удалось загрузить каталог");
      return r.json();
    })
    .then((data) => {
      if (!data.items || !Array.isArray(data.items)) throw new Error("Неверный формат каталога");
      catalog = data;
      pruneCart();
      els.loadError.hidden = true;
      renderCatalog();
      renderCart();
    })
    .catch(() => {
      els.loadError.hidden = false;
      els.loadError.textContent =
        "Не удалось загрузить equipment.json. Откройте сайт через локальный сервер или проверьте файл.";
    });
})();
