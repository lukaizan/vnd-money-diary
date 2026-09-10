export function mountBottomNav(navEl, onChange) {
  const buttons = [...navEl.querySelectorAll(".nav-btn")];

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      onChange(btn.dataset.screen);
    });
  });

  return {
    setActive(screenId) {
      buttons.forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.screen === screenId);
      });
    },
  };
}
