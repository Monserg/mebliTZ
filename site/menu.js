// Бокове меню розділів на телефоні: кнопка ☰ у шапці відкриває панель справа.
// Закривається кнопкою ✕, кліком по затемненню, по розділу або клавішею Esc.
// На комп'ютері (від 800 px) та сама <nav class="menu"> показується рядком у шапці (styles.css).
(() => {
  const nav = document.getElementById("menu");
  const openBtn = document.getElementById("menu-btn");
  const closeBtn = document.getElementById("menu-close");
  const veil = document.getElementById("menu-veil");
  if (!nav || !openBtn || !closeBtn || !veil) return;

  const set = (on) => {
    document.body.classList.toggle("menu-open", on);
    openBtn.setAttribute("aria-expanded", String(on));
    (on ? closeBtn : openBtn).focus();
  };
  openBtn.addEventListener("click", () => set(true));
  closeBtn.addEventListener("click", () => set(false));
  veil.addEventListener("click", () => set(false));
  nav.addEventListener("click", (e) => { if (e.target.closest("a")) set(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("menu-open")) set(false);
  });
})();
