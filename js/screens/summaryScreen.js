import { expenseRepository } from "../lib/storage.js";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "../lib/categories.js";
import { formatKRW, currentYearMonth } from "../lib/format.js";

export async function renderSummaryScreen(container) {
  container.innerHTML = `<div class="card"><p class="empty-state">불러오는 중...</p></div>`;

  const yearMonth = currentYearMonth();
  const monthRecords = (await expenseRepository.getAll()).filter((e) =>
    e.date.startsWith(yearMonth)
  );

  // 예전에 저장된 내역(type 없음)은 지출로 취급
  const expenseRecords = monthRecords.filter((e) => (e.type ?? "expense") === "expense");
  const incomeRecords = monthRecords.filter((e) => e.type === "income");

  const totalExpenseKrw = sumKrw(expenseRecords);
  const totalIncomeKrw = sumKrw(incomeRecords);
  const net = totalIncomeKrw - totalExpenseKrw;

  const expenseSubtotals = subtotalsByCategory(EXPENSE_CATEGORIES, expenseRecords);
  const incomeSubtotals = subtotalsByCategory(INCOME_CATEGORIES, incomeRecords);

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
      <div class="section-label">카테고리별 수입</div>
      ${renderSubtotalRows(incomeSubtotals, totalIncomeKrw)}
    </div>
  `;
}

function sumKrw(records) {
  return records.reduce((sum, e) => sum + e.krwAmount, 0);
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
