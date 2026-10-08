// Прайс і фото редагуються в адмінці (/admin) і віддаються через /api/content.
// Якщо API недоступне (локальний перегляд без Cloudflare) — беремо content/*.json.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

async function loadJSON(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(path);
  return res.json();
}

async function loadContent() {
  if (window.__CONTENT__) return window.__CONTENT__; // демо-файл (scripts/build-demo.py)
  try {
    return await loadJSON("/api/content");
  } catch {
    const [prices, photos] = await Promise.all([loadJSON("content/prices.json"), loadJSON("content/photos.json")]);
    return { prices, photos };
  }
}

// ---------- Калькулятор ----------
// Рахує з того ж прайсу, що й адмінка. Перше число в ціні — мінімальна ціна за
// одиницю: «400 грн / секція» → 400; «від 200 грн» і «400 – 600 грн» → від 400.
// Позиції без числа («уточнити») потрапляють у заявку без суми.
const calc = new Map(); // "група:позиція" → { name, price, unit, from, qty }

function parsePrice(text) {
  const t = String(text || "");
  const m = t.replace(/\s/g, "").match(/\d+/);
  if (!m) return { unit: null, from: false };
  return { unit: Number(m[0]), from: /від/i.test(t) || /\d\s*[–—-]\s*\d/.test(t) };
}

// Прайс показуємо повністю (без згортання): кожна група — картка в сітці.
function renderPrices(data) {
  calc.clear();
  document.getElementById("price").innerHTML = (data?.groups || []).map((g, gi) => `
    <article class="price__group">
      <h3>${esc(g.title)}</h3>
      <ul>${(g.items || []).map((it, ii) => {
        const key = `${gi}:${ii}`;
        calc.set(key, { name: it.name, price: it.price, ...parsePrice(it.price), qty: 0 });
        return `<li data-key="${key}"><span>${esc(it.name)}</span><b>${esc(it.price)}</b>
          <span class="qty"><button type="button" data-d="-1" aria-label="Менше: ${esc(it.name)}">−</button><output>0</output><button type="button" data-d="1" aria-label="Додати: ${esc(it.name)}">+</button></span></li>`;
      }).join("")}</ul>
    </article>`).join("");
}

const fmt = (n) => n.toLocaleString("uk-UA");
const plural = (n, one, few, many) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};

function calcState() {
  const picked = [...calc.values()].filter((c) => c.qty > 0);
  const priced = picked.filter((c) => c.unit != null);
  return {
    picked,
    count: picked.reduce((s, c) => s + c.qty, 0),
    total: priced.reduce((s, c) => s + c.unit * c.qty, 0),
    from: priced.some((c) => c.from),
    unknown: picked.filter((c) => c.unit == null).length,
  };
}

function renderCalc() {
  const st = calcState();
  const box = document.getElementById("calc");
  box.hidden = st.count === 0;
  if (!st.count) return;
  document.getElementById("calc-count").textContent = `Обрано ${st.count} ${plural(st.count, "позицію", "позиції", "позицій")}`;
  document.getElementById("calc-total").textContent = st.total ? `${st.from ? "від " : ""}${fmt(st.total)} грн` : "Ціну уточнимо";
  document.getElementById("calc-note").textContent = st.unknown
    ? `+ ${st.unknown} ${plural(st.unknown, "позиція", "позиції", "позицій")} з ціною «уточнити»`
    : "Орієнтовно, без урахування виїзду за місто";
}

document.getElementById("price").addEventListener("click", (e) => {
  const btn = e.target.closest(".qty button");
  if (!btn) return;
  const li = btn.closest("li");
  const item = calc.get(li.dataset.key);
  item.qty = Math.max(0, Math.min(99, item.qty + Number(btn.dataset.d)));
  li.querySelector("output").textContent = item.qty;
  li.classList.toggle("on", item.qty > 0);
  renderCalc();
});

document.getElementById("calc-reset").addEventListener("click", () => {
  calc.forEach((c) => (c.qty = 0));
  document.querySelectorAll("#price li.on").forEach((li) => {
    li.classList.remove("on");
    li.querySelector("output").textContent = "0";
  });
  renderCalc();
});

// Розрахунок дописується на початок поля «Що зробити»; попередній розрахунок замінюється.
const CALC_HEAD = "Розрахунок з калькулятора:";
const CALC_BLOCK = /^Розрахунок з калькулятора:[\s\S]*?\nОрієнтовно:[^\n]*\n*/;

document.getElementById("calc-add").addEventListener("click", () => {
  const st = calcState();
  const lines = st.picked.map((c) => `— ${c.name} × ${c.qty}${c.unit != null ? ` (${c.from ? "від " : ""}${fmt(c.unit * c.qty)} грн)` : " (уточнити)"}`);
  const sum = st.total ? `${st.from ? "від " : ""}${fmt(st.total)} грн` : "уточнити";
  const block = [CALC_HEAD, ...lines, `Орієнтовно: ${sum}`].join("\n");
  const own = form.task.value.replace(CALC_BLOCK, "").trim();
  form.task.value = own ? `${block}\n\n${own}` : `${block}\n\n`;
  clearError(form.task);
  document.getElementById("zaiavka").scrollIntoView({ behavior: "smooth" });
  setTimeout(() => form.name.focus({ preventScroll: true }), 400);
});

function renderPhotos(data) {
  if (!data) return;
  document.getElementById("gallery").innerHTML = (data.gallery || []).map((p) => p.image
    ? `<figure class="shot"><img src="${esc(p.image)}" alt="${esc(p.caption || "Наша робота")}" loading="lazy">${p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : ""}</figure>`
    : `<div class="ph">${esc(p.caption || "Фото роботи")}</div>`).join("");
}

loadContent().then(({ prices, photos }) => {
  renderPrices(prices);
  renderPhotos(photos);
  renderCalc();
}).catch(() => {
  document.getElementById("price").innerHTML = '<p class="sub">Ціни уточнюйте за телефоном 000 000 00 00.</p>';
});

// ---------- Заявка ----------
// Форма → functions/api/lead.js → Telegram (docs/04-telegram-leads.md).
// Обов'язкові поля: ім'я, телефон (≥ 9 цифр), що зробити. Сервер перевіряє їх повторно.
const LEAD_ENDPOINT = "/api/lead";

const form = document.getElementById("lead-form");
const statusEl = document.getElementById("form-status");
const REQUIRED = ["name", "phone", "task"];

function clearError(field) {
  field.classList.remove("bad");
  form.querySelector(`.err[data-for="${field.name}"]`).classList.remove("show");
}
function showError(field) {
  field.classList.add("bad");
  form.querySelector(`.err[data-for="${field.name}"]`).classList.add("show");
}
function isFilled(field) {
  const v = field.value.trim();
  return field.name === "phone" ? v.replace(/\D/g, "").length >= 9 : v.length > 0;
}

REQUIRED.forEach((n) => form[n].addEventListener("input", () => clearError(form[n])));

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  statusEl.className = "status";
  statusEl.textContent = "";

  // Підсвічуємо всі незаповнені поля одразу, курсор — у перше з них.
  const missing = REQUIRED.map((n) => form[n]).filter((f) => !isFilled(f));
  if (missing.length) {
    missing.forEach(showError);
    missing[0].focus();
    return;
  }

  if (window.__DEMO__) {
    statusEl.className = "status ok";
    statusEl.textContent = "Демо-версія: заявку не надіслано. На робочому сайті вона одразу прийде в Telegram.";
    return;
  }

  const btn = form.querySelector("button[type=submit]");
  btn.disabled = true;
  btn.textContent = "Надсилаємо…";
  try {
    const res = await fetch(LEAD_ENDPOINT, { method: "POST", body: new FormData(form) });
    if (!res.ok) throw new Error(res.status);
    form.reset();
    document.getElementById("calc-reset").click();
    statusEl.className = "status ok";
    statusEl.textContent = "Дякуємо! Заявку отримано, передзвонимо найближчим часом.";
  } catch {
    statusEl.className = "status fail";
    statusEl.textContent = "Не вдалося надіслати. Подзвоніть, будь ласка: 000 000 00 00";
  } finally {
    btn.disabled = false;
    btn.textContent = "Надіслати заявку";
  }
});
