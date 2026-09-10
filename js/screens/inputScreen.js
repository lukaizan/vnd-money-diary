import { categoriesForType } from "../lib/categories.js";
import { CURRENCIES, currencySymbol } from "../lib/currencies.js";
import { expenseRepository } from "../lib/storage.js";
import { getExchangeRate } from "../lib/exchangeRate.js";
import { formatByCurrency, formatKRW, todayISODate } from "../lib/format.js";
import { attachThousandsFormatting } from "../lib/numberInput.js";

// 환율 조회가 필요한 통화만 대상 (KRW는 그대로 입력하므로 환율이 필요 없음)
const RATE_BASED_CURRENCIES = CURRENCIES.map((c) => c.code).filter((code) => code !== "KRW");

export function renderInputScreen(container) {
  let selectedType = "expense"; // 앱을 처음 열었을 때 기본값
  let selectedCategory = categoriesForType(selectedType)[0].id;
  let selectedCurrency = "VND"; // 앱을 처음 열었을 때 기본값
  const amountValues = Object.fromEntries(CURRENCIES.map((c) => [c.code, 0]));
  const rates = {}; // { [currencyCode]: { rate, fetchedAt, fromCache, error? } }

  container.innerHTML = `
    <form id="expense-form" class="card">
      <div class="field">
        <label>종류</label>
        <div class="segmented" id="type-toggle">
          <button type="button" class="segmented-btn selected" data-type="expense">지출</button>
          <button type="button" class="segmented-btn" data-type="income">수입</button>
        </div>
      </div>

      <div class="field">
        <label>결제 금액</label>

        <div class="segmented" id="currency-toggle">
          ${CURRENCIES.map(
            (c) =>
              `<button type="button" class="segmented-btn${c.code === selectedCurrency ? " selected" : ""}" data-currency="${c.code}">${c.label}</button>`
          ).join("")}
        </div>

        ${CURRENCIES.map(
          (c) => `
          <div class="vnd-input-wrap" id="amount-field-${c.code}" ${c.code === selectedCurrency ? "" : "hidden"}>
            <input id="amount-input-${c.code}" type="text" inputmode="numeric" placeholder="0" autocomplete="off" />
            <span>${c.symbol}</span>
          </div>
        `
        ).join("")}

        <div class="krw-preview" id="krw-preview">
          환율 불러오는 중...
        </div>
      </div>

      <div class="field">
        <label for="expense-date">날짜</label>
        <input id="expense-date" type="date" value="${todayISODate()}" required />
      </div>

      <div class="field">
        <label>카테고리</label>
        <div class="category-grid" id="category-grid"></div>
      </div>

      <div class="field">
        <label for="expense-memo">메모 (선택)</label>
        <textarea id="expense-memo" placeholder="예: 반미, 그랩 택시 등"></textarea>
      </div>

      <button type="submit" class="btn-primary" id="save-btn">저장하기</button>
    </form>
  `;

  const typeToggle = container.querySelector("#type-toggle");
  const currencyToggle = container.querySelector("#currency-toggle");
  const krwPreview = container.querySelector("#krw-preview");
  const dateInput = container.querySelector("#expense-date");
  const memoInput = container.querySelector("#expense-memo");
  const categoryGrid = container.querySelector("#category-grid");
  const form = container.querySelector("#expense-form");

  function amountField(code) {
    return container.querySelector(`#amount-field-${code}`);
  }
  function amountInput(code) {
    return container.querySelector(`#amount-input-${code}`);
  }

  function renderCategoryGrid() {
    const categories = categoriesForType(selectedType);
    if (!categories.some((c) => c.id === selectedCategory)) {
      selectedCategory = categories[0].id;
    }
    categoryGrid.innerHTML = categories
      .map(
        (c) =>
          `<button type="button" class="category-btn${c.id === selectedCategory ? " selected" : ""}" data-category="${c.id}">${c.label}</button>`
      )
      .join("");
  }

  function updatePreview() {
    if (selectedCurrency === "KRW") {
      krwPreview.hidden = true;
      return;
    }
    krwPreview.hidden = false;

    const rateInfo = rates[selectedCurrency];
    if (!rateInfo || !rateInfo.rate) {
      krwPreview.textContent = rateInfo?.error
        ? `환율을 가져오지 못했어요: ${rateInfo.error}`
        : "환율 불러오는 중...";
      return;
    }

    const amount = amountValues[selectedCurrency];
    const krw = amount * rateInfo.rate;
    const symbol = currencySymbol(selectedCurrency);
    const warningNote = rateInfo.error
      ? ` · ⚠️ 갱신 실패, 이전 값 사용`
      : "";
    krwPreview.innerHTML = `≈ ${formatKRW(krw)}<span class="sub">1 ${symbol} = ${rateInfo.rate.toFixed(4)}원 · ${formatUpdatedAt(rateInfo.fetchedAt)} 기준${warningNote}</span>`;
  }

  renderCategoryGrid();

  CURRENCIES.forEach((c) => {
    attachThousandsFormatting(amountInput(c.code), (val) => {
      amountValues[c.code] = val;
      if (c.code === selectedCurrency) updatePreview();
    });
  });

  typeToggle.addEventListener("click", (e) => {
    const btn = e.target.closest(".segmented-btn");
    if (!btn) return;
    selectedType = btn.dataset.type;
    [...typeToggle.children].forEach((c) => c.classList.toggle("selected", c === btn));
    renderCategoryGrid();
  });

  currencyToggle.addEventListener("click", (e) => {
    const btn = e.target.closest(".segmented-btn");
    if (!btn) return;
    selectedCurrency = btn.dataset.currency;

    [...currencyToggle.children].forEach((c) => c.classList.toggle("selected", c === btn));
    CURRENCIES.forEach((c) => {
      amountField(c.code).hidden = c.code !== selectedCurrency;
    });
    updatePreview();

    amountInput(selectedCurrency).focus();
  });

  categoryGrid.addEventListener("click", (e) => {
    const btn = e.target.closest(".category-btn");
    if (!btn) return;
    selectedCategory = btn.dataset.category;
    [...categoryGrid.children].forEach((c) => c.classList.toggle("selected", c === btn));
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const saveBtn = container.querySelector("#save-btn");
    const amount = amountValues[selectedCurrency];

    if (!amount || amount <= 0) {
      amountInput(selectedCurrency).focus();
      return;
    }

    let record;
    if (selectedCurrency === "KRW") {
      record = {
        type: selectedType,
        date: dateInput.value,
        category: selectedCategory,
        inputCurrency: "KRW",
        amount,
        krwAmount: amount,
        rate: null,
        memo: memoInput.value.trim(),
      };
    } else {
      const rateInfo = rates[selectedCurrency];
      if (!rateInfo || !rateInfo.rate) return; // 환율 로딩 전에는 저장 방지

      record = {
        type: selectedType,
        date: dateInput.value,
        category: selectedCategory,
        inputCurrency: selectedCurrency,
        amount,
        krwAmount: amount * rateInfo.rate,
        rate: rateInfo.rate,
        memo: memoInput.value.trim(),
      };
    }

    saveBtn.disabled = true;
    await expenseRepository.add(record);

    showToast(`${formatByCurrency(record.amount, record.inputCurrency)} 저장했어요`);

    form.reset();
    dateInput.value = todayISODate();
    renderCategoryGrid();
    CURRENCIES.forEach((c) => {
      amountValues[c.code] = 0;
    });
    updatePreview();
    saveBtn.disabled = false;
  });

  // 환율 불러오기 (캐시가 있으면 즉시, 없으면 API 호출). 통화별로 독립적으로 진행됩니다.
  RATE_BASED_CURRENCIES.forEach((code) => {
    getExchangeRate(code)
      .then((result) => {
        rates[code] = result;
        if (code === selectedCurrency) updatePreview();
      })
      .catch((err) => {
        rates[code] = { rate: null, error: err.message };
        if (code === selectedCurrency) updatePreview();
      });
  });
}

function formatUpdatedAt(timestamp) {
  const d = new Date(timestamp);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1800);
}
