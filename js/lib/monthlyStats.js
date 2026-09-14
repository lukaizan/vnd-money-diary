// 월별 수입/지출 합계 계산. 요약 화면과 캘린더 화면에서 공통으로 사용합니다.

export function sumKrw(records) {
  return records.reduce((sum, e) => sum + e.krwAmount, 0);
}

export function splitByType(records) {
  // 예전에 저장된 내역(type 없음)은 지출로 취급
  const expenseRecords = records.filter((e) => (e.type ?? "expense") === "expense");
  const incomeRecords = records.filter((e) => e.type === "income");
  return { expenseRecords, incomeRecords };
}

/** @param {string} yearMonth "YYYY-MM" @param {number} delta 몇 달 이동할지 (음수면 과거로) */
export function shiftYearMonth(yearMonth, delta) {
  const [y, m] = yearMonth.split("-").map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
