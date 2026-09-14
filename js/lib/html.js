// innerHTML에 사용자가 입력한 텍스트(메모, 커스텀 카테고리 이름 등)를 안전하게
// 끼워 넣기 위한 이스케이프 도우미. 여러 화면에서 공통으로 사용합니다.
export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
