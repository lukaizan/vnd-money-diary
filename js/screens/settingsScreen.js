import { CURRENCIES } from "../lib/currencies.js";
import { settingsStorage } from "../lib/settingsStorage.js";
import { getExchangeRate } from "../lib/exchangeRate.js";
import { expenseRepository } from "../lib/storage.js";

export async function renderSettingsScreen(container) {
  container.innerHTML = `<div class="card"><p class="empty-state">불러오는 중...</p></div>`;

  const settings = await settingsStorage.get();
  let mainCurrency = settings.mainCurrency;
  const subCurrencies = new Set(settings.subCurrencies);
  let targetCurrency = settings.targetCurrency;

  const renderButtons = (isSelected) =>
    CURRENCIES.map(
      (c) =>
        `<button type="button" class="category-btn${isSelected(c.code) ? " selected" : ""}" data-code="${c.code}">${c.code}</button>`
    ).join("");

  container.innerHTML = `
    <div class="card">
      <div class="section-label">메인 화폐</div>
      <div class="field-hint">지금 살고 있는 나라에서 주로 쓰는 화폐예요. 입력 화면에서 기본으로 선택됩니다.</div>
      <div class="category-grid" id="main-grid" style="margin-top:8px;">
        ${renderButtons((code) => code === mainCurrency)}
      </div>
    </div>

    <div class="card">
      <div class="section-label">서브 화폐</div>
      <div class="field-hint">가끔 입력할 일이 있는 다른 화폐예요. 여러 개 고를 수 있어요.</div>
      <div class="category-grid" id="sub-grid" style="margin-top:8px;">
        ${renderButtons((code) => subCurrencies.has(code))}
      </div>
    </div>

    <div class="card">
      <div class="section-label">환산 화폐</div>
      <div class="field-hint">모든 지출/수입을 최종적으로 환산해서 볼 화폐예요. 요약·캘린더·그래프 합계가 이 화폐 기준으로 계산됩니다.</div>
      <div class="category-grid" id="target-grid" style="margin-top:8px;">
        ${renderButtons((code) => code === targetCurrency)}
      </div>
    </div>

    <div class="card">
      <button type="button" class="btn-primary" id="save-settings-btn">저장</button>
      <p class="field-hint" style="margin-top:10px;">환산 화폐를 바꾸면, 이미 저장된 모든 내역의 환산 금액을 오늘 환율 기준으로 다시 계산해요.</p>
    </div>
  `;

  const mainGrid = container.querySelector("#main-grid");
  const subGrid = container.querySelector("#sub-grid");
  const targetGrid = container.querySelector("#target-grid");
  const saveBtn = container.querySelector("#save-settings-btn");

  mainGrid.addEventListener("click", (e) => {
    const btn = e.target.closest(".category-btn[data-code]");
    if (!btn) return;
    mainCurrency = btn.dataset.code;
    [...mainGrid.children].forEach((c) => c.classList.toggle("selected", c === btn));
  });

  subGrid.addEventListener("click", (e) => {
    const btn = e.target.closest(".category-btn[data-code]");
    if (!btn) return;
    const code = btn.dataset.code;
    if (subCurrencies.has(code)) {
      subCurrencies.delete(code);
    } else {
      subCurrencies.add(code);
    }
    btn.classList.toggle("selected", subCurrencies.has(code));
  });

  targetGrid.addEventListener("click", (e) => {
    const btn = e.target.closest(".category-btn[data-code]");
    if (!btn) return;
    targetCurrency = btn.dataset.code;
    [...targetGrid.children].forEach((c) => c.classList.toggle("selected", c === btn));
  });

  saveBtn.addEventListener("click", async () => {
    const originalLabel = saveBtn.textContent;
    const targetChanged = targetCurrency !== settings.targetCurrency;

    if (targetChanged) {
      const confirmed = confirm(
        `환산 화폐를 ${settings.targetCurrency}에서 ${targetCurrency}(으)로 바꿀까요?\n\n` +
          `이미 저장된 모든 지출/수입 내역의 환산 금액을 오늘 환율 기준으로 다시 계산해요. ` +
          `(원래 금액·날짜·카테고리·메모는 그대로 유지됩니다.)`
      );
      if (!confirmed) return;

      saveBtn.disabled = true;
      saveBtn.textContent = "환산 금액을 다시 계산하는 중...";
      try {
        await expenseRepository.reconvertAll(targetCurrency, async (fromCurrency) => {
          const result = await getExchangeRate(fromCurrency, targetCurrency);
          return result.rate;
        });
      } catch (err) {
        showToast(`환율을 가져오지 못해서 저장하지 못했어요: ${err.message}`);
        saveBtn.disabled = false;
        saveBtn.textContent = originalLabel;
        return;
      }
    }

    saveBtn.disabled = true;
    await settingsStorage.setAll({
      mainCurrency,
      subCurrencies: [...subCurrencies],
      targetCurrency,
    });

    showToast("설정을 저장했어요");
    renderSettingsScreen(container);
  });
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1800);
}
