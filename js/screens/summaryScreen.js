import { expenseRepository } from "../lib/storage.js";
import { budgetStorage } from "../lib/budgetStorage.js";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "../lib/categories.js";
import { formatKRW, currentYearMonth } from "../lib/format.js";
import { exportExpensesAsCsv } from "../lib/csvExport.js";
import { attachThousandsFormatting, formatThousands } from "../lib/numberInput.js";
import { sumKrw, splitByType } from "../lib/monthlyStats.js";

export async function renderSummaryScreen(container) {
  container.innerHTML = `<div class="card"><p class="empty-state">불러오는 중...</p></div>`;

  const yearMonth = currentYearMonth();
  const monthRecords = (await expenseRepository.getAll()).filter((e) =>
    e.date.startsWith(yearMonth)
  );
  const budgets = await budgetStorage.getAll();

  const { expenseRecords, incomeRecords } = splitByType(monthRecords);

  const totalExpenseKrw = sumKrw(expenseRecords);
  const totalIncomeKrw = sumKrw(incomeRecords);
  const net = totalIncomeKrw - totalExpenseKrw;

  const expenseSubtotals = subtotalsByCategory(EXPENSE_CATEGORIES, expenseRecords);
  const incomeSubtotals = subtotalsByCategory(INCOME_CATEGORIES, incomeRecords);
  const spentByCategory = Object.fromEntries(expenseSubtotals.map((s) => [s.id, s.total]));

  const [year, month] = yearMonth.split("-");

  container.innerHTML = `
    <div class="card">
      <div style="margin-bottom: 8px; font-size: 13px; color: var(--color-text-muted);">
        ${year}년 ${Number(month)}월
      </div>
      <div class="summary-line">
        <span class="label">이번 달 수입 합계</span>
        <span class="amount income">+${formatKRW(totalIncomeKrw)}</span>
      </div>
      <div class="summary-line">
        <span class="label">이번 달 지출 합계</span>
        <span class="amount expense">-${formatKRW(totalExpenseKrw)}</span>
      </div>
      <div class="summary-line net">
        <span class="label">순수지출 (수입 - 지출)</span>
        <span class="amount ${net >= 0 ? "income" : "expense"}">${net >= 0 ? "+" : "-"}${formatKRW(Math.abs(net))}</span>
      </div>
    </div>

    <div class="card">
      <div class="section-label">카테고리별 지출</div>
      ${renderSubtotalRows(expenseSubtotals, totalExpenseKrw)}
    </div>

    <div class="card">
      <div class="section-label">카테고리별 예산</div>
      ${EXPENSE_CATEGORIES.map((c) => renderBudgetItem(c, spentByCategory[c.id] ?? 0, budgets[c.id] ?? 0)).join("")}
      <button type="button" class="btn-secondary" id="save-budget-btn">예산 저장</button>
    </div>

    <div class="card">
      <div class="section-label">카테고리별 수입</div>
      ${renderSubtotalRows(incomeSubtotals, totalIncomeKrw)}
    </div>

    <div class="card">
      <button type="button" class="btn-secondary" id="export-csv-btn">데이터 내보내기 (CSV)</button>
    </div>
  `;

  // 예산 입력칸: 천 단위 콤마 표시 + 값 추적
  const budgetValues = { ...budgets };
  EXPENSE_CATEGORIES.forEach((c) => {
    const input = container.querySelector(`#budget-input-${c.id}`);
    attachThousandsFormatting(input, (val) => {
      budgetValues[c.id] = val;
    });
  });

  const saveBudgetBtn = container.querySelector("#save-budget-btn");
  saveBudgetBtn.addEventListener("click", async () => {
    saveBudgetBtn.disabled = true;
    await budgetStorage.setAll(budgetValues);
    showToast("예산을 저장했어요");
    renderSummaryScreen(container);
  });

  const exportBtn = container.querySelector("#export-csv-btn");
  exportBtn.addEventListener("click", async () => {
    exportBtn.disabled = true;
    const originalLabel = exportBtn.textContent;
    exportBtn.textContent = "내보내는 중...";

    try {
      const result = await exportExpensesAsCsv();
      if (result.count === 0) {
        showToast("내보낼 내역이 없어요");
      } else if (result.method !== "cancelled") {
        showToast(`${result.count}건을 CSV로 내보냈어요`);
      }
    } catch (err) {
      showToast(`내보내기에 실패했어요: ${err.message}`);
    } finally {
      exportBtn.disabled = false;
      exportBtn.textContent = originalLabel;
    }
  });
}

function renderBudgetItem(category, spent, budget) {
  const hasBudget = budget > 0;
  const pct = hasBudget ? Math.round((spent / budget) * 100) : 0;
  const isOver = hasBudget && spent > budget;
  const barWidth = Math.min(pct, 100);

  const barHtml = hasBudget
    ? `
      <div class="budget-bar-track">
        <div class="budget-bar-fill${isOver ? " over-budget" : ""}" style="width:${barWidth}%"></div>
      </div>
      <div class="budget-bar-label${isOver ? " over-budget" : ""}">
        ${formatKRW(spent)} / ${formatKRW(budget)} (${pct}%)${isOver ? " · 예산 초과" : ""}
      </div>
    `
    : "";

  return `
    <div class="budget-item">
      <div class="budget-item-header">
        <span>${category.label}</span>
        <div class="budget-input-wrap">
          <input id="budget-input-${category.id}" type="text" inputmode="numeric" placeholder="0"
            value="${budget > 0 ? formatThousands(budget) : ""}" autocomplete="off" />
          <span>원</span>
        </div>
      </div>
      ${barHtml}
    </div>
  `;
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1800);
}

function subtotalsByCategory(categories, records) {
  return categories.map((c) => ({
    ...c,
    total: records.filter((e) => e.category === c.id).reduce((sum, e) => sum + e.krwAmount, 0),
  }));
}

function renderSubtotalRows(subtotals, total) {
  return subtotals
    .map((s) => {
      const pct = total > 0 ? Math.round((s.total / total) * 100) : 0;
      return `
        <div class="summary-row">
          <span>${s.label}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%; background:var(--color-${s.id})"></div></div>
          <span>${formatKRW(s.total)}</span>
        </div>
      `;
    })
    .join("");
}
