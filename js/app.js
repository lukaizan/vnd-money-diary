import { renderCalendarScreen } from "./screens/calendarScreen.js";
import { renderInputScreen } from "./screens/inputScreen.js";
import { renderListScreen } from "./screens/listScreen.js";
import { renderSummaryScreen } from "./screens/summaryScreen.js";
import { renderSettingsScreen } from "./screens/settingsScreen.js";
import { mountBottomNav } from "./components/bottomNav.js";
import { getExchangeRate } from "./lib/exchangeRate.js";
import { settingsStorage } from "./lib/settingsStorage.js";
import { currencyMeta } from "./lib/currencies.js";

const root = document.getElementById("screen-root");
const nav = mountBottomNav(document.getElementById("bottom-nav"), (id) => showScreen(id));

function showScreen(id, params = {}) {
  root.innerHTML = "";

  if (id === "calendar") {
    renderCalendarScreen(root, {
      initialYearMonth: params.yearMonth ?? null,
      initialSelectedDate: params.selectedDate ?? null,
      onAddForDate: (dateStr) =>
        showScreen("input", {
          initialDate: dateStr,
          onSavedNew: () => showScreen("calendar", { yearMonth: dateStr.slice(0, 7), selectedDate: dateStr }),
        }),
      onEdit: (expense) =>
        showScreen("input", {
          editingExpense: expense,
          onDoneEditing: (updated) => {
            const finalDate = updated?.date ?? expense.date;
            showScreen("calendar", { yearMonth: finalDate.slice(0, 7), selectedDate: finalDate });
          },
        }),
    });
  } else if (id === "list") {
    renderListScreen(root, {
      onEdit: (expense) =>
        showScreen("input", { editingExpense: expense, onDoneEditing: () => showScreen("list") }),
    });
  } else if (id === "input") {
    renderInputScreen(root, {
      editingExpense: params.editingExpense ?? null,
      initialDate: params.initialDate ?? null,
      onSavedNew: params.onSavedNew ?? null,
      onDoneEditing: params.onDoneEditing ?? (() => showScreen("list")),
    });
  } else if (id === "settings") {
    renderSettingsScreen(root);
  } else {
    renderSummaryScreen(root);
  }

  nav.setActive(id);
}

showScreen("calendar");

// 헤더에 메인 화폐 -> 환산 화폐 환율을 표시 (입력 화면과는 별개로, 앱 어디서든 보이도록)
const rateIndicator = document.getElementById("rate-indicator");
async function updateHeaderRate() {
  try {
    const settings = await settingsStorage.get();
    const { mainCurrency, targetCurrency } = settings;

    if (mainCurrency === targetCurrency) {
      rateIndicator.textContent = `메인 화폐 = 환산 화폐 (${targetCurrency})`;
      return;
    }

    const mainSymbol = currencyMeta(mainCurrency).symbol;
    const targetSymbol = currencyMeta(targetCurrency).symbol;
    const { rate, fromCache, error } = await getExchangeRate(mainCurrency, targetCurrency);
    rateIndicator.textContent = error
      ? "환율 갱신 실패 (이전 값 사용 중)"
      : `1 ${mainSymbol} = ${rate.toFixed(4)} ${targetSymbol}${fromCache ? " (저장된 값)" : ""}`;
  } catch {
    rateIndicator.textContent = "환율을 가져올 수 없어요";
  }
}
updateHeaderRate();

// 서비스 워커 등록 (file:// 로 직접 열면 등록되지 않고, http(s) 서버로 접속해야 동작합니다)
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((err) => {
      console.warn("서비스 워커 등록 실패:", err);
    });
  });
}
