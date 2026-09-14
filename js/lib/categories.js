// 카테고리 시스템.
//
// 기본 카테고리(식비/교통/생활/기타/급여/투자수익)는 코드에 고정되어 있고
// 삭제할 수 없습니다. 사용자가 만드는 커스텀 카테고리는 localStorage에 저장되며,
// 지출/수입 내역(js/lib/storage.js)과는 완전히 다른 키를 쓰기 때문에
// 카테고리를 추가/삭제해도 기존 가계부 데이터는 전혀 건드리지 않습니다.
//
// 커스텀 카테고리를 삭제해도 실제로는 지우지 않고 deleted 표시만 남깁니다
// (소프트 삭제). 그래야 이미 그 카테고리로 저장된 옛날 내역을 화면에 표시할 때
// 카테고리 이름/색을 계속 정상적으로 찾을 수 있고, 선택 목록에서만 사라집니다.

export const BUILTIN_EXPENSE_CATEGORIES = [
  { id: "food", label: "식비", emoji: "🍽️", color: "#ef8354" },
  { id: "transport", label: "교통", emoji: "🚕", color: "#2f6fed" },
  { id: "living", label: "생활", emoji: "🏠", color: "#2fa84f" },
  { id: "etc", label: "기타", emoji: "🛒", color: "#9b6bd6" },
];

export const BUILTIN_INCOME_CATEGORIES = [
  { id: "salary", label: "급여", emoji: "💰", color: "#1f9d55" },
  { id: "investment", label: "투자수익", emoji: "📈", color: "#d6a419" },
];

const BUILTIN_IDS = new Set(
  [...BUILTIN_EXPENSE_CATEGORIES, ...BUILTIN_INCOME_CATEGORIES].map((c) => c.id)
);

// 커스텀 카테고리를 만들 때 이모지를 고르는 선택지
export const EMOJI_CHOICES = [
  "🍽️", "🚕", "🏠", "💡", "🎁", "❤️", "🛒", "🎮",
  "📚", "✈️", "☕", "💊", "🐾", "🎓", "💼", "🎬",
];

// 커스텀 카테고리를 만들 때 순서대로 배정하는 색상 팔레트
const CUSTOM_COLOR_PALETTE = [
  "#e0668b", "#4fb0c6", "#f2a541", "#7c83db",
  "#5bbd7a", "#c1667a", "#3fa9a0", "#d68a3f",
];

const CUSTOM_CATEGORY_STORAGE_KEY = "vnd_money_diary_custom_categories_v1";

let customCategoriesCache = null;

function readCustomCategories() {
  if (customCategoriesCache) return customCategoriesCache;
  try {
    const raw = localStorage.getItem(CUSTOM_CATEGORY_STORAGE_KEY);
    customCategoriesCache = raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("커스텀 카테고리를 읽는 중 오류:", err);
    customCategoriesCache = [];
  }
  return customCategoriesCache;
}

function writeCustomCategories(list) {
  customCategoriesCache = list;
  localStorage.setItem(CUSTOM_CATEGORY_STORAGE_KEY, JSON.stringify(list));
}

function generateCategoryId() {
  const unique =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `custom-${unique}`;
}

function nextColor(existingCustomCategories) {
  const used = new Set(existingCustomCategories.map((c) => c.color));
  const unused = CUSTOM_COLOR_PALETTE.find((c) => !used.has(c));
  return unused ?? CUSTOM_COLOR_PALETTE[existingCustomCategories.length % CUSTOM_COLOR_PALETTE.length];
}

/** 입력 화면에서 고를 수 있는(삭제되지 않은) 카테고리 목록 */
export function categoriesForType(type) {
  const builtin = type === "income" ? BUILTIN_INCOME_CATEGORIES : BUILTIN_EXPENSE_CATEGORIES;
  const custom = readCustomCategories().filter((c) => c.type === type && !c.deleted);
  return [...builtin, ...custom];
}

export function addCustomCategory({ type, label, emoji }) {
  const list = readCustomCategories();
  const category = {
    id: generateCategoryId(),
    type,
    label: label.trim(),
    emoji,
    color: nextColor(list),
    deleted: false,
    createdAt: Date.now(),
  };
  writeCustomCategories([...list, category]);
  return category;
}

/** 소프트 삭제: 선택 목록에서는 사라지지만 옛날 내역의 카테고리명 조회는 계속 됨 */
export function removeCustomCategory(id) {
  const list = readCustomCategories();
  const index = list.findIndex((c) => c.id === id);
  if (index === -1) return false;
  const updated = [...list];
  updated[index] = { ...updated[index], deleted: true };
  writeCustomCategories(updated);
  return true;
}

export function isBuiltinCategory(id) {
  return BUILTIN_IDS.has(id);
}

/** 삭제된 커스텀 카테고리를 포함해 id로 카테고리 전체 정보를 찾습니다. */
export function findCategory(id) {
  const all = [...BUILTIN_EXPENSE_CATEGORIES, ...BUILTIN_INCOME_CATEGORIES, ...readCustomCategories()];
  return all.find((c) => c.id === id) ?? null;
}

export function categoryLabel(id) {
  return findCategory(id)?.label ?? id;
}

export function categoryColor(id) {
  return findCategory(id)?.color ?? "#9ca3af";
}

export function categoryEmoji(id) {
  return findCategory(id)?.emoji ?? "";
}
