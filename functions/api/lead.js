// POST /api/lead — заявка з форми сайту → повідомлення в Telegram.
// Секрети Cloudflare: TG_BOT_TOKEN, TG_CHAT_ID (docs/04-telegram-leads.md).
import { json } from "../../lib/util.js";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export async function onRequestPost({ request, env }) {
  let data;
  try {
    data = await request.formData();
  } catch {
    return json({ error: "Некоректний запит" }, 400);
  }

  // Пастка для ботів: справжні люди це поле не бачать і не заповнюють.
  if (data.get("website")) return json({ ok: true });

  const clip = (v, n) => String(v || "").trim().slice(0, n);
  const name = clip(data.get("name"), 80);
  const phone = clip(data.get("phone"), 30);
  const task = clip(data.get("task"), 2000); // разом з розрахунком із калькулятора
  // Ті самі обов'язкові поля, що й у браузері (site/main.js), щоб перевірку не можна було обійти.
  if (!name) return json({ error: "Вкажіть ім'я" }, 400);
  if (phone.replace(/\D/g, "").length < 9) return json({ error: "Вкажіть телефон" }, 400);
  if (!task) return json({ error: "Опишіть, що потрібно зробити" }, 400);

  // Секрети перевіряємо після полів: так форма отримує точну помилку навіть без бота.
  if (!env.TG_BOT_TOKEN || !env.TG_CHAT_ID) return json({ error: "Telegram не налаштовано" }, 503);

  const time = new Date().toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" });
  const text = [
    "🛠 Нова заявка з сайту",
    `Ім'я: ${name}`,
    `Телефон: ${phone}`,
    `Що зробити: ${task}`,
    `Час: ${time}`,
  ].join("\n");

  const api = `https://api.telegram.org/bot${env.TG_BOT_TOKEN}`;
  const sendMessage = () => fetch(`${api}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.TG_CHAT_ID, text }),
  });
  const sendPhoto = (photo, caption) => {
    const tg = new FormData();
    tg.append("chat_id", env.TG_CHAT_ID);
    tg.append("caption", caption);
    tg.append("photo", photo, photo.name || "photo.jpg");
    return fetch(`${api}/sendPhoto`, { method: "POST", body: tg });
  };

  const photo = data.get("photo");
  const hasPhoto = photo && typeof photo === "object" && photo.size > 0 && photo.size <= MAX_PHOTO_BYTES;
  let res;
  if (hasPhoto && text.length > 1000) {
    // Підпис до фото в Telegram — до 1024 символів; довгу заявку (з калькулятора) шлемо окремим повідомленням.
    res = await sendMessage();
    if (res.ok) res = await sendPhoto(photo, `📷 Фото до заявки, тел. ${phone}`);
  } else if (hasPhoto) {
    res = await sendPhoto(photo, text);
  } else {
    res = await sendMessage();
  }
  if (res.ok) return json({ ok: true });
  // Короткий опис відмови Telegram («chat not found», «Unauthorized») — у полі detail, щоб
  // власник міг знайти причину через curl; токена там немає. Сайт показує лише загальний текст.
  const detail = await res.json().then((b) => b.description).catch(() => "");
  console.error(`Telegram ${res.status}: ${detail || "без опису"}`);
  return json({ error: "Не вдалося надіслати в Telegram", detail: `${res.status} ${detail}`.trim() }, 502);
}
