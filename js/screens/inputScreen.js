import {
  categoriesForType,
  addCustomCategory,
  removeCustomCategory,
  isBuiltinCategory,
  findCategory,
  EMOJI_CHOICES,
} from "../lib/categories.js";
import { currencyMeta } from "../lib/currencies.js";
import { settingsStorage, effectiveCurrencies } from "../lib/settingsStorage.js";
import { expenseRepository } from "../lib/storage.js";
import { getExchangeRate } from "../lib/exchangeRate.js";
import { formatByCurrency, todayISODate } from "../lib/format.js";
import { attachThousandsFormatting, formatThousands } from "../lib/numberInput.js";
import { escapeHtml } from "../lib/html.js";
import { attachLongPress } from "../lib/longPress.js";

/**
 * @param {HTMLElement} container
 * @param {{
 *   editingExpense?: object|null,
 *   onDoneEditing?: () => void,
 *   initialDate?: string|null,
 *   onSavedNew?: (record: object) => void,
 * }} [options]
 *   editingExpense가 있으면 새로 추가하는 대신 그 내역을 수정하는 화면으로 동작합니다.
 *   initialDate는 새로 추가할 때(캘린더에서 날짜를 길게 눌러 들어온 경우 등) 날짜 칸의 기본값입니다.
 *   onSavedNew가 있으면, 새로 추가 저장한 뒤 폼을 초기화하고 계속 입력받는 대신 이 콜백을 호출합니다.
 */
export async function renderInputScreen(
  container,
  { editingExpense = null, onDoneEditing = null, initialDate = null, onSavedNew = null } = {}
) {
  container.innerHTML = `<div class="card"><p class="empty-state">불러오는 중...</p></div>`;

  const settings = await settingsStorage.get();
  const targetCurrency = settings.targetCurrency;

  // 설정에서 고른 메인+서브+환산 화폐를 입력 화면 통화 목록으로 씀 (중복 제거).
  // 수정 중인 내역의 통화가 지금은 설정에서 빠져 있더라도(그 사이에 서브 화폐를
  // 뺐다거나) 그 내역을 정상적으로 수정할 수 있도록 목록에 포함시켜 둡니다.
  let activeCurrencyCodes = effectiveCurrencies(settings);
  if (editingExpense && !activeCurrencyCodes.includes(editingExpense.inputCurrency)) {
    activeCurrencyCodes = [...activeCurrencyCodes, editingExpense.inputCurrency];
  }
  const activeCurrencies = activeCurrencyCodes.map(currencyMeta);
  const targetSymbol = currencyMeta(targetCurrency).symbol;

  // 환율 조회가 필요한 통화만 대상 (환산 화폐는 그대로 입력하므로 환율이 필요 없음)
  const rateBasedCurrencies = activeCurrencyCodes.filter((code) => code !== targetCurrency);

  const isEditing = editingExpense !== null;

  let selectedType = editingExpense?.type ?? "expense"; // 앱을 처음 열었을 때 기본값
  let selectedCategory = editingExpense?.category ?? categoriesForType(selectedType)[0].id;
  let selectedCurrency = editingExpense?.inputCurrency ?? settings.mainCurrency; // 앱을 처음 열었을 때 기본값
  const amountValues = Object.fromEntries(activeCurrencyCodes.map((code) => [code, 0]));
  if (isEditing) {
    amountValues[selectedCurrency] = editingExpense.amount;
  }
  const rates = {}; // { [currencyCode]: { rate, fetchedAt, fromCache, error? } }
  let formSelectedEmoji = EMOJI_CHOICES[0];

  container.innerHTML = `
    <form id="expense-form" class="card">
      ${isEditing ? `<div class="edit-banner">내역을 수정하고 있어요</div>` : ""}

      <div class="field">
        <label>종류</label>
        <div class="segmented" id="type-toggle">
          <button type="button" class="segmented-btn${selectedType === "expense" ? " selected" : ""}" data-type="expense">지출</button>
          <button type="button" class="segmented-btn${selectedType === "income" ? " selected" : ""}" data-type="income">수입</button>
        </div>
      </div>

      <div class="field">
        <label>결제 금액</label>

        <div class="segmented" id="currency-toggle">
          ${activeCurrencies
            .map(
              (c) =>
                `<button type="button" class="segmented-btn${c.code === selectedCurrency ? " selected" : ""}" data-currency="${c.code}">${c.code}</button>`
            )
            .join("")}
        </div>

        ${activeCurrencies
          .map(
            (c) => `
          <div class="vnd-input-wrap" id="amount-field-${c.code}" ${c.code === selectedCurrency ? "" : "hidden"}>
            <input id="amount-input-${c.code}" type="text" inputmode="numeric" placeholder="0" autocomplete="off"
              value="${isEditing && c.code === selectedCurrency ? formatThousands(editingExpense.amount) : ""}" />
            <span>${c.symbol}</span>
          </div>
        `
          )
          .join("")}

        <div class="krw-preview" id="krw-preview">
          환율 불러오는 중...
        </div>
      </div>

      <div class="field">
        <label for="expense-date">날짜</label>
        <input id="expense-date" type="date" value="${editingExpense?.date ?? initialDate ?? todayISODate()}" required />
      </div>

      <div class="field">
        <label>카테고리 <span class="field-hint">(커스텀 카테고리는 길게 누르면 삭제)</span></label>
        <div class="category-grid" id="category-grid"></div>
        <div class="category-form" id="category-form" hidden></div>
      </div>

      <div class="field">
        <label for="expense-memo">메모 (선택)</label>
        <textarea id="expense-memo" placeholder="예: 반미, 그랩 택시 등">${escapeHtml(editingExpense?.memo ?? "")}</textarea>
      </div>

      <button type="submit" class="btn-primary" id="save-btn">${isEditing ? "수정 완료" : "저장하기"}</button>
      ${isEditing ? `<button type="button" class="btn-secondary" id="cancel-edit-btn">취소</button>` : ""}
    </form>
  `;

  const typeToggle = container.querySelector("#type-toggle");
  const currencyToggle = container.querySelector("#currency-toggle");
  const krwPreview = container.querySelector("#krw-preview");
  const dateInput = container.querySelector("#expense-date");
  const memoInput = container.querySelector("#expense-memo");
  const categoryGrid = container.querySelector("#category-grid");
  const categoryForm = container.querySelector("#category-form");
  const form = container.querySelector("#expense-form");
  const cancelEditBtn = container.querySelector("#cancel-edit-btn");

  function amountField(code) {
    return container.querySelector(`#amount-field-${code}`);
  }
  function amountInput(code) {
    return container.querySelector(`#amount-input-${code}`);
  }

  function renderCategoryGrid() {
    const categories = categoriesForType(selectedType);
    if (!categories.some((c) => c.id === selectedCategory)) {
      selectedCategory = categories[0]?.id ?? null;
    }
    categoryGrid.innerHTML =
      categories
        .map((c) => {
          const emojiPrefix = c.emoji ? `${escapeHtml(c.emoji)} ` : "";
          return `<button type="button" class="category-btn${c.id === selectedCategory ? " selected" : ""}" data-category="${c.id}">${emojiPrefix}${escapeHtml(c.label)}</button>`;
        })
        .join("") +
      `<button type="button" class="category-btn add-category-btn" id="add-category-btn">+ 새 카테고리</button>`;
  }

  function openCategoryForm() {
    formSelectedEmoji = EMOJI_CHOICES[0];
    categoryForm.innerHTML = `
      <input type="text" id="category-name-input" class="category-name-input" placeholder="카테고리 이름 (예: 데이트)" maxlength="12" autocomplete="off" />
      <div class="emoji-grid" id="emoji-grid">
        ${EMOJI_CHOICES.map(
          (e) => `<button type="button" class="emoji-btn${e === formSelectedEmoji ? " selected" : ""}" data-emoji="${e}">${e}</button>`
        ).join("")}
      </div>
      <div class="category-form-actions">
        <button type="button" class="btn-secondary" id="category-form-cancel">취소</button>
        <button type="button" class="btn-primary" id="category-form-save">추가</button>
      </div>
    `;
    categoryForm.hidden = false;
    categoryForm.querySelector("#category-name-input").focus();
  }

  function closeCategoryForm() {
    categoryForm.hidden = true;
    categoryForm.innerHTML = "";
  }

  function updatePreview() {
    if (selectedCurrency === targetCurrency) {
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
    const converted = amount * rateInfo.rate;
    const symbol = currencyMeta(selectedCurrency).symbol;
    const warningNote = rateInfo.error
      ? ` · ⚠️ 갱신 실패, 이전 값 사용`
      : "";
    krwPreview.innerHTML = `≈ ${formatByCurrency(converted, targetCurrency)}<span class="sub">1 ${symbol} = ${rateInfo.rate.toFixed(4)} ${targetSymbol} · ${formatUpdatedAt(rateInfo.fetchedAt)} 기준${warningNote}</span>`;
  }

  renderCategoryGrid();

  activeCurrencyCodes.forEach((code) => {
    attachThousandsFormatting(amountInput(code), (val) => {
      amountValues[code] = val;
      if (code === selectedCurrency) updatePreview();
    });
  });

  typeToggle.addEventListener("click", (e) => {
    const btn = e.target.closest(".segmented-btn");
    if (!btn) return;
    selectedType = btn.dataset.type;
    [...typeToggle.children].forEach((c) => c.classList.toggle("selected", c === btn));
    closeCategoryForm();
    renderCategoryGrid();
  });

  currencyToggle.addEventListener("click", (e) => {
    const btn = e.target.closest(".segmented-btn");
    if (!btn) return;
    selectedCurrency = btn.dataset.currency;

    [...currencyToggle.children].forEach((c) => c.classList.toggle("selected", c === btn));
    activeCurrencyCodes.forEach((code) => {
      amountField(code).hidden = code !== selectedCurrency;
    });
    updatePreview();

    amountInput(selectedCurrency).focus();
  });

  // "+ 새 카테고리" 열기 (롱프레스 대상이 아닌 별도 버튼이라 따로 처리)
  categoryGrid.addEventListener("click", (e) => {
    if (e.target.closest("#add-category-btn")) {
      openCategoryForm();
    }
  });

  // 카테고리 버튼: 짧게 탭하면 선택, 커스텀 카테고리를 길게 누르면 삭제
  attachLongPress(categoryGrid, ".category-btn[data-category]", {
    canLongPress: (btn) => !isBuiltinCategory(btn.dataset.category),
    onLongPress: (btn) => handleDeleteCustomCategory(btn.dataset.category),
    onTap: (btn) => {
      selectedCategory = btn.dataset.category;
      [...categoryGrid.querySelectorAll(".category-btn")].forEach((c) => c.classList.toggle("selected", c === btn));
    },
  });

  function handleDeleteCustomCategory(categoryId) {
    const category = findCategory(categoryId);
    if (!category) return;
    const confirmed = confirm(
      `"${category.label}" 카테고리를 삭제할까요?\n이미 저장된 내역은 그대로 남아있어요.`
    );
    if (!confirmed) return;
    removeCustomCategory(categoryId);
    if (selectedCategory === categoryId) {
      selectedCategory = null; // renderCategoryGrid가 알아서 첫 항목으로 다시 채워줌
    }
    renderCategoryGrid();
  }

  categoryForm.addEventListener("click", (e) => {
    const emojiBtn = e.target.closest(".emoji-btn");
    if (emojiBtn) {
      formSelectedEmoji = emojiBtn.dataset.emoji;
      categoryForm
        .querySelectorAll(".emoji-btn")
        .forEach((b) => b.classList.toggle("selected", b.dataset.emoji === formSelectedEmoji));
      return;
    }

    if (e.target.closest("#category-form-cancel")) {
      closeCategoryForm();
      return;
    }

    if (e.target.closest("#category-form-save")) {
      const nameInput = categoryForm.querySelector("#category-name-input");
      const label = nameInput.value.trim();
      if (!label) {
        nameInput.focus();
        return;
      }
      const newCategory = addCustomCategory({ type: selectedType, label, emoji: formSelectedEmoji });
      selectedCategory = newCategory.id;
      closeCategoryForm();
      renderCategoryGrid();
    }
  });

  if (cancelEditBtn) {
    cancelEditBtn.addEventListener("click", () => {
      onDoneEditing?.();
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const saveBtn = container.querySelector("#save-btn");
    const amount = amountValues[selectedCurrency];

    if (!amount || amount <= 0) {
      amountInput(selectedCurrency).focus();
      return;
    }

    let record;
    if (selectedCurrency === targetCurrency) {
      record = {
        type: selectedType,
        date: dateInput.value,
        category: selectedCategory,
        inputCurrency: targetCurrency,
        amount,
        convertedAmount: amount,
        convertedCurrency: targetCurrency,
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
        convertedAmount: amount * rateInfo.rate,
        convertedCurrency: targetCurrency,
        rate: rateInfo.rate,
        memo: memoInput.value.trim(),
      };
    }

    saveBtn.disabled = true;

    if (isEditing) {
      const updated = await expenseRepository.update(editingExpense.id, record);
      showToast(`${formatByCurrency(record.amount, record.inputCurrency)}로 수정했어요`);
      onDoneEditing?.(updated);
      return;
    }

    const saved = await expenseRepository.add(record);
    showToast(`${formatByCurrency(record.amount, record.inputCurrency)} 저장했어요`);

    if (onSavedNew) {
      onSavedNew(saved);
      return;
    }

    form.reset();
    dateInput.value = todayISODate();
    renderCategoryGrid();
    activeCurrencyCodes.forEach((code) => {
      amountValues[code] = 0;
    });
    updatePreview();
    saveBtn.disabled = false;
  });

  // 환율 불러오기 (캐시가 있으면 즉시, 없으면 API 호출). 통화별로 독립적으로 진행됩니다.
  rateBasedCurrencies.forEach((code) => {
    getExchangeRate(code, targetCurrency)
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
