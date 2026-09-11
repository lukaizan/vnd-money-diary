// 카테고리별 "월 예산" 저장소. 특정 달에 묶이지 않고 매달 반복 적용되는
// 예산 한 세트를 저장합니다 (예: 식비 월 500,000원). 요약 화면은 이 값을
// "이번 달" 실제 지출과 비교해서 막대로 보여줍니다.
//
// 지출/수입 내역(js/lib/storage.js)과는 완전히 다른 localStorage 키를 쓰기
// 때문에, 예산을 저장/수정해도 기존 가계부 데이터는 전혀 건드리지 않습니다.

const BUDGET_STORAGE_KEY = "vnd_money_diary_budgets_v1";

function readBudgets() {
  try {
    const raw = localStorage.getItem(BUDGET_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error("예산 데이터를 읽는 중 오류:", err);
    return {};
  }
}

function writeBudgets(budgets) {
  localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(budgets));
}

export const budgetStorage = {
  // async로 만들어 둔 이유: expenseRepository와 마찬가지로 나중에 서버 저장으로
  // 바꾸더라도 호출하는 쪽 코드가 그대로 동작하도록 하기 위해서입니다.
  async getAll() {
    return readBudgets();
  },

  /** @param {Record<string, number>} budgets 카테고리 id -> 예산 금액(KRW) */
  async setAll(budgets) {
    const cleaned = {};
    for (const [categoryId, amount] of Object.entries(budgets)) {
      if (amount > 0) cleaned[categoryId] = amount;
    }
    writeBudgets(cleaned);
    return cleaned;
  },
};
