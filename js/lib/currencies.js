// 입력 가능한 통화 정의. 통화를 더 추가하려면 이 배열에 항목만 추가하면 됩니다.
// (환율 조회는 open.er-api.com에서 해당 통화를 base로 하는 값을 가져와 사용합니다.)
export const CURRENCIES = [
  { code: "VND", label: "VND", symbol: "₫" },
  { code: "KRW", label: "KRW", symbol: "원" },
  { code: "USD", label: "USD", symbol: "$" },
  { code: "CNY", label: "CNY", symbol: "¥" },
];

export function currencySymbol(code) {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}
