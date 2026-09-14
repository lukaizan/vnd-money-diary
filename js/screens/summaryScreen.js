import { expenseRepository } from "../lib/storage.js";
import { budgetStorage } from "../lib/budgetStorage.js";
import { categoriesForType, categoryLabel, categoryColor, categoryEmoji } from "../lib/categories.js";
import { formatKRW, formatCompactKRW, currentYearMonth } from "../lib/format.js";
import { exportExpensesAsCsv } from "../lib/csvExport.js";
import { attachThousandsFormatting, formatThousands } from "../lib/numberInput.js";
import { sumKrw, splitByType, shiftYearMonth } from "../lib/monthlyStats.js";
import { escapeHtml } from "../lib/html.js";

const TREND_MAX_MONTHS = 12; // 그래프가 너무 길어지지 않도록 최근 최대 12개월까지만

// 화면을 다시 그릴 때마다(탭 이동, 예산 저장 등) 이전 차트를 먼저 없애야
// "Canvas is already in use" 오류 없이 새로 그릴 수 있습니다.
let categoryChartInstance = null;
let trendChartInstance = null;
let dataLabelsPluginRegistered = false;

function isChartAvailable() {
  if (typeof window === "undefined" || typeof window.Chart === "undefined") return false;
  if (!dataLabelsPluginRegistered && typeof window.ChartDataLabels !== "undefined") {
    window.Chart.register(window.ChartDataLabels);
    dataLabelsPluginRegistered = true;
  }
  return true;
}

function getCssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export async function renderSummaryScreen(container) {
  container.innerHTML = `<div class="card"><p class="empty-state">불러오는 중...</p></div>`;

  // getAll()은 읽기 전용 조회입니다 (다른 화면과 동일). 여기서는 이번 달 계산과
  // 월별 추이 계산에 모두 쓰기 위해 전체 내역을 한 번만 불러옵니다.
  const allRecords = await expenseRepository.getAll();
  const yearMonth = currentYearMonth();
  const monthRecords = allRecords.filter((e) => e.date.startsWith(yearMonth));
  const budgets = await budgetStorage.getAll();

  const { expenseRecords, incomeRecords } = splitByType(monthRecords);

  const totalExpenseKrw = sumKrw(expenseRecords);
  const totalIncomeKrw = sumKrw(incomeRecords);
  const net = totalIncomeKrw - totalExpenseKrw;

  const expenseSubtotals = groupByCategory(expenseRecords);
  const incomeSubtotals = groupByCategory(incomeRecords);
  const spentByCategory = Object.fromEntries(expenseSubtotals.map((s) => [s.id, s.total]));

  const trend = buildTrendData(allRecords, yearMonth);

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
      <div class="section-label">월별 지출 추이</div>
      <div class="chart-container">
        <canvas id="trend-chart"></canvas>
      </div>
    </div>

    <div class="card">
      <div class="section-label">카테고리별 지출</div>
      <div class="chart-container chart-container-donut">
        <canvas id="category-chart"></canvas>
      </div>
      ${renderSubtotalRows(expenseSubtotals, totalExpenseKrw)}
    </div>

    <div class="card">
      <div class="section-label">카테고리별 예산</div>
      ${categoriesForType("expense")
        .map((c) => renderBudgetItem(c, spentByCategory[c.id] ?? 0, budgets[c.id] ?? 0))
        .join("")}
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

  renderCharts(container, { expenseSubtotals, trend });

  // 예산 입력칸: 천 단위 콤마 표시 + 값 추적
  const budgetValues = { ...budgets };
  categoriesForType("expense").forEach((c) => {
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

// 저장된 내역 중 가장 이른 달 ~ 이번 달까지(최대 TREND_MAX_MONTHS개월)의
// 월별 수입/지출 합계를 계산합니다. 데이터가 이번 달치밖에 없으면 1개월만 반환됩니다.
function buildTrendData(allRecords, currentYm) {
  let earliestYm = currentYm;
  allRecords.forEach((e) => {
    const ym = e.date.slice(0, 7);
    if (ym < earliestYm) earliestYm = ym;
  });

  const earliestAllowed = shiftYearMonth(currentYm, -(TREND_MAX_MONTHS - 1));
  const startYm = earliestYm < earliestAllowed ? earliestAllowed : earliestYm;

  const months = [];
  for (let ym = startYm; ym <= currentYm; ym = shiftYearMonth(ym, 1)) {
    months.push(ym);
  }

  const expenses = [];
  const incomes = [];
  months.forEach((ym) => {
    const records = allRecords.filter((e) => e.date.startsWith(ym));
    const { expenseRecords, incomeRecords } = splitByType(records);
    expenses.push(sumKrw(expenseRecords));
    incomes.push(sumKrw(incomeRecords));
  });

  const labels = months.map((ym) => formatMonthLabel(ym, currentYm));

  return { labels, expenses, incomes };
}

function formatMonthLabel(yearMonth, currentYm) {
  const [y, m] = yearMonth.split("-");
  const [cy] = currentYm.split("-");
  return y === cy ? `${Number(m)}월` : `${y.slice(2)}.${Number(m)}월`;
}

function renderCharts(container, { expenseSubtotals, trend }) {
  if (categoryChartInstance) {
    categoryChartInstance.destroy();
    categoryChartInstance = null;
  }
  if (trendChartInstance) {
    trendChartInstance.destroy();
    trendChartInstance = null;
  }

  if (!isChartAvailable()) {
    container.querySelectorAll(".chart-container").forEach((el) => {
      el.innerHTML = `<p class="chart-note">그래프를 불러오지 못했어요 (인터넷 연결을 확인해주세요)</p>`;
    });
    return;
  }

  const Chart = window.Chart;
  const textColor = getCssVar("--color-text-muted");
  const gridColor = getCssVar("--color-border");

  // 카테고리별 지출 도넛 차트 (지출이 있는 카테고리만)
  const nonZeroSubtotals = expenseSubtotals.filter((s) => s.total > 0);
  const categoryCanvas = container.querySelector("#category-chart");
  if (categoryCanvas) {
    if (nonZeroSubtotals.length === 0) {
      categoryCanvas.closest(".chart-container").innerHTML =
        `<p class="chart-note">이번 달 지출 내역이 없어요.</p>`;
    } else {
      const total = nonZeroSubtotals.reduce((sum, s) => sum + s.total, 0);
      categoryChartInstance = new Chart(categoryCanvas, {
        type: "doughnut",
        data: {
          labels: nonZeroSubtotals.map((s) => s.label),
          datasets: [
            {
              data: nonZeroSubtotals.map((s) => s.total),
              backgroundColor: nonZeroSubtotals.map((s) => s.color),
              borderColor: getCssVar("--color-surface"),
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "60%",
          plugins: {
            legend: {
              position: "bottom",
              labels: { boxWidth: 10, font: { size: 11 }, color: textColor },
            },
            tooltip: {
              callbacks: { label: (ctx) => `${ctx.label}: ${formatKRW(ctx.parsed)}` },
            },
            datalabels: {
              color: "#fff",
              font: { weight: "600", size: 11 },
              formatter: (value) => {
                const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                return pct < 5 ? "" : `${pct}%`;
              },
            },
          },
        },
        plugins: [window.ChartDataLabels],
      });
    }
  }

  // 월별 지출/수입 추이 꺾은선 그래프
  const trendCanvas = container.querySelector("#trend-chart");
  if (trendCanvas) {
    trendChartInstance = new Chart(trendCanvas, {
      type: "line",
      data: {
        labels: trend.labels,
        datasets: [
          {
            label: "지출",
            data: trend.expenses,
            borderColor: getCssVar("--color-danger"),
            backgroundColor: getCssVar("--color-danger"),
            tension: 0.3,
            pointRadius: 4,
          },
          {
            label: "수입",
            data: trend.incomes,
            borderColor: getCssVar("--color-income"),
            backgroundColor: getCssVar("--color-income"),
            tension: 0.3,
            pointRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: gridColor },
            ticks: { color: textColor, callback: (v) => formatCompactKRW(v) },
          },
          x: {
            grid: { display: false },
            ticks: { color: textColor },
          },
        },
        plugins: {
          legend: { position: "bottom", labels: { color: textColor, boxWidth: 10, font: { size: 11 } } },
          tooltip: {
            callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatKRW(ctx.parsed.y)}` },
          },
          datalabels: { display: false },
        },
      },
    });
  }
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

  const emojiPrefix = category.emoji ? `${escapeHtml(category.emoji)} ` : "";

  return `
    <div class="budget-item">
      <div class="budget-item-header">
        <span>${emojiPrefix}${escapeHtml(category.label)}</span>
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

// 고정된 카테고리 목록이 아니라, 실제 내역에 등장하는 카테고리를 그대로 집계합니다.
// 삭제된 커스텀 카테고리로 저장된 옛날 내역도 categoryLabel/categoryColor가
// 계속 이름/색을 찾아주기 때문에 정상적으로 표시됩니다.
function groupByCategory(records) {
  const totals = new Map();
  records.forEach((e) => {
    totals.set(e.category, (totals.get(e.category) ?? 0) + e.krwAmount);
  });

  return [...totals.entries()]
    .map(([id, total]) => ({
      id,
      label: categoryLabel(id),
      emoji: categoryEmoji(id),
      color: categoryColor(id),
      total,
    }))
    .sort((a, b) => b.total - a.total);
}

function renderSubtotalRows(subtotals, total) {
  if (subtotals.length === 0) {
    return `<p class="empty-state">이번 달 내역이 없어요.</p>`;
  }
  return subtotals
    .map((s) => {
      const pct = total > 0 ? Math.round((s.total / total) * 100) : 0;
      const emojiPrefix = s.emoji ? `${escapeHtml(s.emoji)} ` : "";
      return `
        <div class="summary-row">
          <span>${emojiPrefix}${escapeHtml(s.label)}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%; background:${s.color}"></div></div>
          <span>${formatKRW(s.total)}</span>
        </div>
      `;
    })
    .join("");
}
