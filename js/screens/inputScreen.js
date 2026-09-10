import { categoriesForType } from "../lib/categories.js";
import { expenseRepository } from "../lib/storage.js";
import { getExchangeRate } from "../lib/exchangeRate.js";
import { formatKRW, formatVND, todayISODate } from "../lib/format.js";
import { attachThousandsFormatting } from "../lib/numberInput.js";

export function renderInputScreen(container) {
  let selectedType = "expense"; // 앱을 처음 열었을 때 기본값
  let selectedCategory = categoriesForType(selectedType)[0].id;
  let selectedCurrency = "VND"; // 앱을 처음 열었을 때 기본값
  let vndAmountValue = 0;
  let krwAmountValue = 0;
  let currentRate = null; // { rate, fetchedAt, fromCache }

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
          <button type="button" class="segmented-btn selected" data-currency="VND">VND</button>
          <button type="button" class="segmented-btn" data-currency="KRW">KRW</button>
        </div>

        <div class="vnd-input-wrap" id="vnd-field">
          <input id="vnd-amount" type="text" inputmode="numeric" placeholder="0" autocomplete="off" />
          <span>₫</span>
        </div>
        <div class="vnd-input-wrap" id="krw-field" hidden>
          <input id="krw-amount" type="text" inputmode="numeric" placeholder="0" autocomplete="off" />
          <span>원</span>
        </div>

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
  const vndField = container.querySelector("#vnd-field");
  const krwField = container.querySelector("#krw-field");
  const vndInput = container.querySelector("#vnd-amount");
  const krwInput = container.querySelector("#krw-amount");
  const krwPreview = container.querySelector("#krw-preview");
  const dateInput = container.querySelector("#expense-date");
  const memoInput = container.querySelector("#expense-memo");
  const categoryGrid = container.querySelector("#category-grid");
  const form = container.querySelector("#expense-form");

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
    if (selectedCurrency !== "VND") {
      krwPreview.hidden = true;
      return;
    }
    krwPreview.hidden = false;

    if (!currentRate) {
      krwPreview.textContent = "환율 불러오는 중...";
      return;
    }
    if (currentRate.error) {
      krwPreview.innerHTML = `환율을 새로 가져오지 못해 이전 값을 사용해요.<span class="sub">${escapeHtml(currentRate.error)}</span>`;
    }
    const krw = vndAmountValue * currentRate.rate;
    krwPreview.innerHTML = `≈ ${formatKRW(krw)}<span class="sub">1 ₫ = ${currentRate.rate.toFixed(4)}원 · ${formatUpdatedAt(currentRate.fetchedAt)} 기준</span>`;
  }

  renderCategoryGrid();

  attachThousandsFormatting(vndInput, (val) => {
    vndAmountValue = val;
    updatePreview();
  });
  attachThousandsFormatting(krwInput, (val) => {
    krwAmountValue = val;
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
    vndField.hidden = selectedCurrency !== "VND";
    krwField.hidden = selectedCurrency !== "KRW";
    updatePreview();

    (selectedCurrency === "VND" ? vndInput : krwInput).focus();
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
    let record;

    if (selectedCurrency === "VND") {
      if (!vndAmountValue || vndAmountValue <= 0) {
        vndInput.focus();
        return;
      }
      if (!currentRate) return; // 환율 로딩 전에는 저장 방지

      record = {
        type: selectedType,
        date: dateInput.value,
        category: selectedCategory,
        inputCurrency: "VND",
        vndAmount: vndAmountValue,
        krwAmount: vndAmountValue * currentRate.rate,
        rate: currentRate.rate,
        memo: memoInput.value.trim(),
      };
    } else {
      if (!krwAmountValue || krwAmountValue <= 0) {
        krwInput.focus();
        return;
      }

      record = {
        type: selectedType,
        date: dateInput.value,
        category: selectedCategory,
        inputCurrency: "KRW",
        vndAmount: null,
        krwAmount: krwAmountValue,
        rate: null,
        memo: memoInput.value.trim(),
      };
    }

    saveBtn.disabled = true;
    await expenseRepository.add(record);

    const savedAmountText = record.inputCurrency === "VND" ? formatVND(record.vndAmount) : formatKRW(record.krwAmount);
    showToast(`${savedAmountText} 저장했어요`);

    form.reset();
    dateInput.value = todayISODate();
    renderCategoryGrid();
    vndAmountValue = 0;
    krwAmountValue = 0;
    updatePreview();
    saveBtn.disabled = false;
  });

  // 환율 불러오기 (캐시가 있으면 즉시, 없으면 API 호출)
  getExchangeRate()
    .then((result) => {
      currentRate = result;
      updatePreview();
    })
    .catch((err) => {
      krwPreview.textContent = `환율을 가져오지 못했어요: ${err.message}`;
    });
}

function formatUpdatedAt(timestamp) {
  const d = new Date(timestamp);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1800);
}
