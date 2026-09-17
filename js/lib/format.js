import { currencyMeta } from "./currencies.js";

// 통화별 금액 표시 형식. 항상 "en-US" 로케일로 천 단위 콤마(,)를 사용해서,
// 입력 화면의 콤마 표시(js/lib/numberInput.js)와 항상 같은 모양이 되도록 합니다.
export function formatByCurrency(amount, currencyCode) {
  const formatted = Math.round(amount).toLocaleString("en-US");
  const meta = currencyMeta(currencyCode);
  if (meta.position === "suffix") {
    // KRW("원")만 기호 앞에 공백 없이 붙이고, 나머지 접미사 통화(VND "₫")는 공백을 둠
    return currencyCode === "KRW" ? `${formatted}${meta.symbol}` : `${formatted} ${meta.symbol}`;
  }
  return `${meta.symbol}${formatted}`;
}

// 캘린더 칸/차트 축처럼 공간이 좁은 곳에 쓰는 축약형.
// KRW는 한국식 "만" 단위(예: 1,500,000 -> "150만")로, 그 외 통화는 K/M 단위로 줄입니다.
export function formatCompactAmount(amount, currencyCode) {
  const abs = Math.round(Math.abs(amount));

  if (currencyCode === "KRW") {
    return abs >= 10000 ? `${Math.round(abs / 10000).toLocaleString("en-US")}만` : abs.toLocaleString("en-US");
  }

  if (abs >= 1_000_000) {
    return `${(abs / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (abs >= 1_000) {
    return `${(abs / 1_000).toFixed(abs % 1_000 === 0 ? 0 : 1)}K`;
  }
  return abs.toLocaleString("en-US");
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
