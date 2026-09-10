// 카테고리 정의. 나중에 항목을 추가/변경하려면 이 배열들만 수정하면 됩니다.
export const EXPENSE_CATEGORIES = [
  { id: "food", label: "식비" },
  { id: "transport", label: "교통" },
  { id: "living", label: "생활" },
  { id: "etc", label: "기타" },
];

export const INCOME_CATEGORIES = [
  { id: "salary", label: "급여" },
  { id: "investment", label: "투자수익" },
];

export function categoriesForType(type) {
  return type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

export function categoryLabel(id) {
  const match = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].find((c) => c.id === id);
  return match?.label ?? id;
}
