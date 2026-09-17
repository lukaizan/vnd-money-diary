import { expenseRepository } from "../lib/storage.js";
import { categoryLabel, categoryColor, categoryEmoji } from "../lib/categories.js";
import { sumKrw, splitByType, shiftYearMonth } from "../lib/monthlyStats.js";
import {
  formatKRW,
  formatByCurrency,
  formatCompactKRW,
  formatDateKorean,
  todayISODate,
  currentYearMonth,
} from "../lib/format.js";
import { escapeHtml } from "../lib/html.js";
import { attachLongPress } from "../lib/longPress.js";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * @param {HTMLElement} container
 * @param {{
 *   initialYearMonth?: string|null,
 *   initialSelectedDate?: string|null,
 *   onAddForDate?: (dateStr: string) => void,
 *   onEdit?: (expense: object) => void,
 * }} [options]
 *   initialYearMonth/initialSelectedDate는 입력 화면에서 돌아왔을 때 보던 달/선택 날짜를
 *   그대로 복원하기 위한 값입니다. 지정하지 않으면 이번 달/오늘이 기본값입니다.
 */
export async function renderCalendarScreen(
  container,
  { initialYearMonth = null, initialSelectedDate = null, onAddForDate = null, onEdit = null } = {}
) {
  const todayISO = todayISODate();
  let viewedYearMonth = initialYearMonth ?? currentYearMonth();
  let selectedDate = initialSelectedDate ?? todayISO;
  let recordsByDate = {};

  container.innerHTML = `<div class="card"><p class="empty-state">불러오는 중...</p></div>`;

  async function loadMonth() {
    // getAll()은 목록/요약 화면과 동일한 읽기 전용 조회이며, 아무것도 저장/수정하지 않습니다.
    const allRecords = await expenseRepository.getAll();
    const monthRecords = allRecords.filter((e) => e.date.startsWith(viewedYearMonth));

    recordsByDate = {};
    monthRecords.forEach((e) => {
      if (!recordsByDate[e.date]) recordsByDate[e.date] = [];
      recordsByDate[e.date].push(e);
    });

    const { expenseRecords, incomeRecords } = splitByType(monthRecords);
    const totalExpense = sumKrw(expenseRecords);
    const totalIncome = sumKrw(incomeRecords);
    const net = totalIncome - totalExpense;

    renderScreen(totalExpense, totalIncome, net);
  }

  function renderScreen(totalExpense, totalIncome, net) {
    const [year, month] = viewedYearMonth.split("-").map(Number);
    const firstWeekday = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();

    const cells = [];
    for (let i = 0; i < firstWeekday; i++) {
      cells.push(`<div class="calendar-cell empty"></div>`);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push(renderDayCell(day, year, month));
    }

    container.innerHTML = `
      <div class="card">
        <div class="calendar-month-header">
          <button type="button" id="prev-month-btn" class="month-nav-btn" aria-label="이전 달">‹</button>
          <div class="calendar-month-label">${year}년 ${month}월</div>
          <button type="button" id="next-month-btn" class="month-nav-btn" aria-label="다음 달">›</button>
        </div>

        <div class="summary-line">
          <span class="label">이번 달 수입 합계</span>
          <span class="amount income">+${formatKRW(totalIncome)}</span>
        </div>
        <div class="summary-line">
          <span class="label">이번 달 지출 합계</span>
          <span class="amount expense">-${formatKRW(totalExpense)}</span>
        </div>
        <div class="summary-line net">
          <span class="label">이번 달 순잔액 (수입 - 지출)</span>
          <span class="amount ${net >= 0 ? "income" : "expense"}">${net >= 0 ? "+" : "-"}${formatKRW(Math.abs(net))}</span>
        </div>
      </div>

      <div class="card">
        <div class="field-hint calendar-hint">날짜를 길게 누르면 그 날짜로 바로 입력할 수 있어요</div>
        <div class="calendar-grid">
          ${WEEKDAY_LABELS.map((w) => `<div class="calendar-weekday">${w}</div>`).join("")}
          ${cells.join("")}
        </div>
      </div>

      <div class="card" id="day-detail"></div>
    `;

    container.querySelector("#prev-month-btn").addEventListener("click", () => {
      viewedYearMonth = shiftYearMonth(viewedYearMonth, -1);
      selectedDate = defaultSelectedDateFor(viewedYearMonth);
      loadMonth();
    });
    container.querySelector("#next-month-btn").addEventListener("click", () => {
      viewedYearMonth = shiftYearMonth(viewedYearMonth, 1);
      selectedDate = defaultSelectedDateFor(viewedYearMonth);
      loadMonth();
    });

    // 날짜 칸: 짧게 탭하면 그 날짜 선택, 길게 누르면 그 날짜로 바로 입력 화면 이동
    attachLongPress(container.querySelector(".calendar-grid"), ".calendar-cell[data-date]", {
      onTap: (cell) => {
        selectedDate = cell.dataset.date;
        updateSelectedCell();
        renderDayDetail();
      },
      onLongPress: (cell) => onAddForDate?.(cell.dataset.date),
    });

    // 선택한 날짜의 거래 내역: 길게 누르면 그 항목을 수정하는 화면으로 이동
    attachLongPress(container.querySelector("#day-detail"), ".expense-item[data-id]", {
      onLongPress: (el) => {
        const record = (recordsByDate[selectedDate] || []).find((r) => r.id === el.dataset.id);
        if (record) onEdit?.(record);
      },
    });

    updateSelectedCell();
    renderDayDetail();
  }

  function renderDayCell(day, year, month) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayRecords = recordsByDate[dateStr] || [];
    const isToday = dateStr === todayISO;

    let totalHtml = "";
    if (dayRecords.length > 0) {
      const { income, expense } = dayTotals(dayRecords);
      // 지출이 있으면 그 지출 합계를 보여주고(빨간색), 수입이 지출보다 많은 날은 초록색으로 강조
      const amount = expense > 0 ? expense : income;
      const isPositive = income > expense;
      totalHtml = `<span class="day-total ${isPositive ? "positive" : "negative"}">${isPositive ? "+" : "-"}${formatCompactKRW(amount)}</span>`;
    }

    return `
      <button type="button" class="calendar-cell${isToday ? " today" : ""}" data-date="${dateStr}">
        <span class="day-number">${day}</span>
        ${totalHtml}
      </button>
    `;
  }

  function updateSelectedCell() {
    container.querySelectorAll(".calendar-cell[data-date]").forEach((cell) => {
      cell.classList.toggle("selected", cell.dataset.date === selectedDate);
    });
  }

  function renderDayDetail() {
    const detailCard = container.querySelector("#day-detail");
    const dayRecords = (recordsByDate[selectedDate] || [])
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt);
    const { expense: dayExpense } = dayTotals(dayRecords);

    detailCard.innerHTML = `
      <div class="day-detail-header">
        <span class="day-detail-date">${formatDateKorean(selectedDate)}</span>
        <span class="day-detail-total">지출 ${formatKRW(dayExpense)}</span>
      </div>
      ${
        dayRecords.length === 0
          ? `<p class="empty-state">이 날짜엔 기록이 없어요.<br />날짜 칸을 길게 눌러 바로 입력할 수 있어요.</p>`
          : `<div class="field-hint calendar-hint">항목을 길게 누르면 수정할 수 있어요</div>${dayRecords.map(renderDayDetailItem).join("")}`
      }
    `;
  }

  loadMonth();
}

function dayTotals(records) {
  let income = 0;
  let expense = 0;
  records.forEach((e) => {
    if ((e.type ?? "expense") === "income") income += e.krwAmount;
    else expense += e.krwAmount;
  });
  return { income, expense };
}

function defaultSelectedDateFor(yearMonth) {
  const todayISO = todayISODate();
  return yearMonth === todayISO.slice(0, 7) ? todayISO : `${yearMonth}-01`;
}

function renderDayDetailItem(e) {
  const type = e.type ?? "expense";
  const sign = type === "income" ? "+" : "-";
  const originalAmountHtml =
    e.inputCurrency !== "KRW"
      ? `<div class="original-amount">${formatByCurrency(e.amount, e.inputCurrency)}</div>`
      : "";
  const emoji = categoryEmoji(e.category);

  return `
    <div class="expense-item" data-id="${e.id}">
      <div>
        <span class="category-chip" style="background:${categoryColor(e.category)}">${emoji ? escapeHtml(emoji) + " " : ""}${escapeHtml(categoryLabel(e.category))}</span>
        ${e.memo ? `<div class="memo">${escapeHtml(e.memo)}</div>` : ""}
      </div>
      <div class="amounts ${type}">
        <div class="krw">${sign}${formatKRW(e.krwAmount)}</div>
        ${originalAmountHtml}
      </div>
    </div>
  `;
}
