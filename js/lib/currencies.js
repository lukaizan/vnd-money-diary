// 앱이 알고 있는 전체 통화 목록. 해외 거주 외국인들이 자주 쓸 만한 통화 위주로 구성했습니다.
// 설정 화면(js/screens/settingsScreen.js)에서 이 중 메인/서브/환산 화폐를 고릅니다.
// (환율 조회는 open.er-api.com에서 해당 통화를 base로 하는 값을 가져와 사용합니다.)
export const CURRENCIES = [
  { code: "VND", label: "VND", symbol: "₫", position: "suffix" },
  { code: "KRW", label: "KRW", symbol: "원", position: "suffix" },
  { code: "USD", label: "USD", symbol: "$", position: "prefix" },
  { code: "CNY", label: "CNY", symbol: "元", position: "prefix" },
  { code: "JPY", label: "JPY", symbol: "¥", position: "prefix" },
  { code: "THB", label: "THB", symbol: "฿", position: "prefix" },
  { code: "IDR", label: "IDR", symbol: "Rp", position: "prefix" },
  { code: "MYR", label: "MYR", symbol: "RM", position: "prefix" },
  { code: "PHP", label: "PHP", symbol: "₱", position: "prefix" },
  { code: "SGD", label: "SGD", symbol: "S$", position: "prefix" },
  { code: "EUR", label: "EUR", symbol: "€", position: "prefix" },
  { code: "GBP", label: "GBP", symbol: "£", position: "prefix" },
];

const FALLBACK_META = { code: "", label: "", symbol: "", position: "prefix" };

export function currencyMeta(code) {
  return CURRENCIES.find((c) => c.code === code) ?? { ...FALLBACK_META, code, label: code, symbol: code };
}

export function currencySymbol(code) {
  return currencyMeta(code).symbol;
}
