// 통화별 금액 표시 형식. 항상 "en-US" 로케일로 천 단위 콤마(,)를 사용해서,
// 입력 화면의 콤마 표시(js/lib/numberInput.js)와 항상 같은 모양이 되도록 합니다.
export function formatByCurrency(amount, currencyCode) {
  const formatted = Math.round(amount).toLocaleString("en-US");
  switch (currencyCode) {
    case "VND":
      return `${formatted} ₫`;
    case "KRW":
      return `${formatted}원`;
    case "USD":
      return `$${formatted}`;
    case "CNY":
      return `¥${formatted}`;
    default:
      return formatted;
  }
}

export function formatVND(amount) {
  return formatByCurrency(amount, "VND");
}

export function formatKRW(amount) {
  return formatByCurrency(amount, "KRW");
}

export function todayISODate() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function formatDateKorean(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return `${m}월 ${d}일 (${weekday})`;
}

export function currentYearMonth() {
  return todayISODate().slice(0, 7); // "YYYY-MM"
}
