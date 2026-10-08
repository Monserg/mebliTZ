// Бокове меню розділів на телефоні: тап по логотипу (там іконка ☰) відкриває панель зліва.
// Закривається кнопкою ✕, кліком по затемненню, по розділу або клавішею Esc.
// На комп'ютері (від 800 px) логотип — звичайне посилання з молотком, а <nav class="menu"> показується рядком (styles.css).
(() => {
  const nav = document.getElementById("menu");
  const logo = document.getElementById("menu-btn");
  const closeBtn = document.getElementById("menu-close");
  const veil = document.getElementById("menu-veil");
  if (!nav || !logo || !closeBtn || !veil) return;
  const mobile = window.matchMedia("(max-width: 799px)");

  const set = (on) => {
    document.body.classList.toggle("menu-open", on);
    logo.setAttribute("aria-expanded", String(on));
    (on ? closeBtn : logo).focus();
  };
  logo.addEventListener("click", (e) => {
    if (!mobile.matches) return; // на комп'ютері логотип веде на головну
    e.preventDefault();
    set(!document.body.classList.contains("menu-open"));
  });
  closeBtn.addEventListener("click", () => set(false));
  veil.addEventListener("click", () => set(false));
  nav.addEventListener("click", (e) => { if (e.target.closest("a")) set(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("menu-open")) set(false);
  });
  mobile.addEventListener("change", () => { if (!mobile.matches) set(false); });
})();
