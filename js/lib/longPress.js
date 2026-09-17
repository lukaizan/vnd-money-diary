// 짧게 탭(클릭)했을 때와 길게 누르고 있을 때(long press)를 구분해서 처리하는
// 공용 도우미. 이벤트 위임 방식이라 컨테이너 내용이 innerHTML로 다시 그려져도
// 다시 연결(addEventListener)할 필요 없이 계속 동작합니다.

const DEFAULT_LONG_PRESS_MS = 500;

/**
 * @param {HTMLElement} container 이벤트를 위임받을 부모 요소 (내용이 바뀌어도 유지되는 요소)
 * @param {string} selector 롱프레스/탭 대상이 되는 자손 요소의 CSS 선택자
 * @param {{
 *   onTap?: (el: HTMLElement, ev: Event) => void,
 *   onLongPress: (el: HTMLElement, ev: Event) => void,
 *   duration?: number,
 *   canLongPress?: (el: HTMLElement, ev: Event) => boolean,
 * }} handlers
 */
export function attachLongPress(container, selector, { onTap, onLongPress, duration = DEFAULT_LONG_PRESS_MS, canLongPress } = {}) {
  let timer = null;
  let triggered = false;

  container.addEventListener("pointerdown", (e) => {
    const el = e.target.closest(selector);
    if (!el) return;
    triggered = false;
    if (canLongPress && !canLongPress(el, e)) return; // 이 요소는 롱프레스 대상이 아님 -> 탭으로만 처리
    timer = setTimeout(() => {
      triggered = true;
      onLongPress(el, e);
    }, duration);
  });

  ["pointerup", "pointercancel", "pointerleave"].forEach((evt) => {
    container.addEventListener(evt, () => clearTimeout(timer));
  });

  container.addEventListener("click", (e) => {
    const el = e.target.closest(selector);
    if (!el) return;
    if (triggered) {
      triggered = false; // 롱프레스로 이미 처리됨 -> 탭 동작으로 이어지지 않게 무시
      return;
    }
    onTap?.(el, e);
  });

  // 아이폰 사파리 등에서 길게 누르면 뜨는 기본 메뉴(복사/공유 등)를 막습니다.
  container.addEventListener("contextmenu", (e) => {
    if (e.target.closest(selector)) e.preventDefault();
  });
}
