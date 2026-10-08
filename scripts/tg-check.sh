#!/bin/sh
# Перевірка Telegram-бота для заявок (docs/04-telegram-leads.md).
#   sh scripts/tg-check.sh   → спитає токен і покаже chat_id усіх, хто писав боту; за бажанням надішле тест
# Токен передається лише змінною середовища, у файли і в чат з Claude не вставляти.
# Можна і без змінних: просто `sh scripts/tg-check.sh` — скрипт попросить вставити токен (ввід невидимий).
set -e
case "$TG_BOT_TOKEN" in ""|ВАШ_ТОКЕН|YOUR_TOKEN)
  printf "Вставте токен бота від @BotFather (вигляд 1234567890:AAE...), Enter: "
  stty -echo 2>/dev/null || true; read -r TG_BOT_TOKEN; stty echo 2>/dev/null || true; echo ;;
esac
case "$TG_BOT_TOKEN" in *:*) ;; *) echo "Це не схоже на токен (має містити двокрапку)"; exit 1 ;; esac
API="https://api.telegram.org/bot$TG_BOT_TOKEN"

echo "Бот:"
curl -s "$API/getMe" | python3 -I -c 'import json,sys; r=json.load(sys.stdin); b=r.get("result") or {}; print("  @%s (%s)" % (b.get("username"), b.get("first_name")) if r.get("ok") else "  помилка: %s" % r.get("description"))'

echo "Чати, з яких боту писали (натисніть Start у боті, якщо список порожній):"
curl -s "$API/getUpdates" | python3 -I -c '
import json,sys
r = json.load(sys.stdin)
seen = {}
for u in r.get("result", []):
    m = u.get("message") or u.get("my_chat_member") or {}
    c = m.get("chat") or {}
    if c.get("id"): seen[c["id"]] = c.get("title") or c.get("username") or c.get("first_name") or ""
for cid, name in seen.items(): print("  chat_id=%s  %s" % (cid, name))
if not seen: print("  (порожньо)")
'

if [ -z "$TG_CHAT_ID" ]; then
  printf "chat_id для тестового повідомлення (Enter — пропустити): "; read -r TG_CHAT_ID
fi
if [ -n "$TG_CHAT_ID" ]; then
  echo "Тестове повідомлення в chat_id=$TG_CHAT_ID:"
  curl -s -X POST "$API/sendMessage" -d "chat_id=$TG_CHAT_ID" --data-urlencode "text=✅ Тест: бот заявок підключено" \
    | python3 -I -c 'import json,sys; r=json.load(sys.stdin); print("  надіслано" if r.get("ok") else "  помилка: %s" % r.get("description"))'
fi
