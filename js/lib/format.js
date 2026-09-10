export function formatVND(amount) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(amount)) + " ₫";
}

export function formatKRW(amount) {
  return new Intl.NumberFormat("ko-KR").format(Math.round(amount)) + "원";
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
