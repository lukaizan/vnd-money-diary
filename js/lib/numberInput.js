// 숫자 입력 칸에 천 단위 콤마(,)를 자동으로 붙여주는 도우미.
// 화면에는 "1,000,000"처럼 보이지만, 실제로 저장/계산에 쓰는 값은
// 콤마가 없는 순수 숫자(1000000)입니다.

export function formatThousands(value) {
  const num = Number(value) || 0;
  return num.toLocaleString("en-US");
}

/**
 * 텍스트 입력 요소에 천 단위 콤마 자동 서식을 붙입니다.
 * @param {HTMLInputElement} inputEl
 * @param {(numericValue: number) => void} onChange 콤마를 뺀 순수 숫자 값이 바뀔 때마다 호출
 */
export function attachThousandsFormatting(inputEl, onChange) {
  inputEl.addEventListener("input", () => {
    const cursorPos = inputEl.selectionStart ?? inputEl.value.length;
    const prevLength = inputEl.value.length;

    const digitsOnly = inputEl.value.replace(/[^\d]/g, "");
    const numericValue = digitsOnly ? Number(digitsOnly) : 0;
    const formatted = digitsOnly ? formatThousands(digitsOnly) : "";

    inputEl.value = formatted;

    const lengthDiff = formatted.length - prevLength;
    const newPos = Math.max(0, cursorPos + lengthDiff);
    inputEl.setSelectionRange(newPos, newPos);

    onChange(numericValue);
  });
}
