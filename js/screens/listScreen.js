import { expenseRepository } from "../lib/storage.js";
import { categoryLabel, categoryColor, categoryEmoji } from "../lib/categories.js";
import { formatByCurrency, formatDateKorean } from "../lib/format.js";
import { escapeHtml } from "../lib/html.js";
import { attachLongPress } from "../lib/longPress.js";

/**
 * @param {HTMLElement} container
 * @param {{ onEdit?: (expense: object) => void }} [options]
 */
export async function renderListScreen(container, { onEdit = null } = {}) {
  container.innerHTML = `<div class="card" id="list-card"><p class="empty-state">불러오는 중...</p></div>`;

  const listCard = container.querySelector("#list-card");
  const expenses = await expenseRepository.getAll();

  if (expenses.length === 0) {
    listCard.innerHTML = `<p class="empty-state">아직 저장된 내역이 없어요.<br />입력 화면에서 첫 지출을 기록해보세요.</p>`;
    return;
  }

  listCard.innerHTML = expenses
    .map((e) => {
      const type = e.type ?? "expense";
      // 입력 통화와 환산 통화가 같으면(환산 화폐로 직접 입력) 원본 금액을 따로 보여줄 필요가 없음
      const originalAmountHtml =
        e.inputCurrency !== e.convertedCurrency
          ? `<div class="original-amount">${formatByCurrency(e.amount, e.inputCurrency)}</div>`
          : "";
      const sign = type === "income" ? "+" : "-";
      const emoji = categoryEmoji(e.category);

      return `
      <div class="expense-item" data-id="${e.id}">
        <div>
          <span class="category-chip" style="background:${categoryColor(e.category)}">${emoji ? escapeHtml(emoji) + " " : ""}${escapeHtml(categoryLabel(e.category))}</span>
          <div>${formatDateKorean(e.date)}</div>
          ${e.memo ? `<div class="memo">${escapeHtml(e.memo)}</div>` : ""}
        </div>
        <div class="amounts ${type}">
          <div class="krw">${sign}${formatByCurrency(e.convertedAmount, e.convertedCurrency)}</div>
          ${originalAmountHtml}
          <div class="item-actions">
            <button type="button" class="edit-btn" data-id="${e.id}">수정</button>
            <button type="button" class="delete-btn" data-id="${e.id}">삭제</button>
          </div>
        </div>
      </div>
    `;
    })
    .join("");

  listCard.addEventListener("click", async (evt) => {
    const editBtn = evt.target.closest(".edit-btn");
    if (editBtn) {
      const expense = expenses.find((e) => e.id === editBtn.dataset.id);
      if (expense) onEdit?.(expense);
      return;
    }

    const deleteBtn = evt.target.closest(".delete-btn");
    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      if (!confirm("이 내역을 삭제할까요?")) return;
      await expenseRepository.remove(id);
      renderListScreen(container, { onEdit });
    }
  });

  // 항목을 길게 누르면(버튼 영역 제외) 캘린더 화면과 동일하게 수정 화면으로 이동
  attachLongPress(listCard, ".expense-item[data-id]", {
    canLongPress: (el, ev) => !ev.target.closest(".item-actions"),
    onLongPress: (el) => {
      const expense = expenses.find((e) => e.id === el.dataset.id);
      if (expense) onEdit?.(expense);
    },
  });
}
