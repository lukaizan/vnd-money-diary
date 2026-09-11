// 가계부 내역을 CSV 파일로 내보내는 기능.
// 저장된 데이터를 "읽기만" 하고 어떤 것도 수정/삭제하지 않습니다.
import { expenseRepository } from "./storage.js";
import { categoryLabel } from "./categories.js";
import { todayISODate } from "./format.js";

const CSV_HEADER = ["날짜", "카테고리", "통화", "원본금액", "원화환산금액", "구분", "메모"];

function csvEscape(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsv(expenses) {
  const rows = expenses.map((e) => [
    e.date,
    categoryLabel(e.category),
    e.inputCurrency,
    e.amount,
    Math.round(e.krwAmount),
    e.type === "income" ? "수입" : "지출",
    e.memo ?? "",
  ]);

  const lines = [CSV_HEADER, ...rows].map((row) => row.map(csvEscape).join(","));

  // 맨 앞에 BOM을 붙여서 엑셀/한글 프로그램에서 한글이 깨지지 않도록 함
  return "﻿" + lines.join("\r\n");
}

/**
 * @returns {Promise<{ method: "share" | "download" | "cancelled", count: number }>}
 */
export async function exportExpensesAsCsv() {
  // getAll()은 목록/요약 화면에서 이미 쓰는 것과 동일한 읽기 전용 조회입니다.
  const expenses = await expenseRepository.getAll();
  const sorted = [...expenses].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.createdAt - b.createdAt;
  });

  const csv = buildCsv(sorted);
  const filename = `vnd-money-diary-${todayISODate()}.csv`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });

  // 아이폰 Safari: 공유 시트를 통해 "파일에 저장" / 에어드랍 / 메일 등으로 보낼 수 있음
  if (typeof File !== "undefined" && navigator.canShare) {
    const file = new File([blob], filename, { type: "text/csv" });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        return { method: "share", count: expenses.length };
      } catch (err) {
        if (err?.name === "AbortError") {
          return { method: "cancelled", count: expenses.length };
        }
        // 공유 시트에서 알 수 없는 오류가 나면 일반 다운로드로 대체 시도
      }
    }
  }

  // 공유 API가 없는 환경(데스크톱 브라우저 등)에서는 일반 파일 다운로드로 대체
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return { method: "download", count: expenses.length };
}
