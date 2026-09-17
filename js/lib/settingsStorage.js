// 통화 설정(메인/서브/환산 화폐) 저장소.
//
// 지출/수입 내역(js/lib/storage.js)과는 완전히 다른 localStorage 키를 쓰기
// 때문에, 설정을 바꿔도 그 자체로는 기존 가계부 데이터를 건드리지 않습니다.
// (환산 화폐를 바꿀 때만 storage.js의 reconvertAll을 통해 내역의 환산 금액을
// 다시 계산하며, 그 과정은 설정 화면에서 명시적으로 처리합니다.)
import { expenseRepository } from "./storage.js";

const SETTINGS_KEY = "vnd_money_diary_currency_settings_v1";

const FRESH_INSTALL_DEFAULTS = {
  mainCurrency: "VND",
  subCurrencies: ["USD"],
  targetCurrency: "KRW",
};

let cache = null;

function readRaw() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error("통화 설정을 읽는 중 오류:", err);
    return null;
  }
}

function writeRaw(settings) {
  cache = settings;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// 설정이 처음 생기는 시점(앱을 업데이트한 직후 등)에, 이미 저장된 내역에서
// 실제로 쓰인 통화를 자동으로 감지해서 서브 화폐 기본값에 전부 포함시킵니다.
// 저장된 내역이 전혀 없으면(완전히 새로 설치) 고정된 기본값을 그대로 씁니다.
async function buildInitialSettings() {
  const records = await expenseRepository.getAll(); // 읽기 전용 조회
  const usedCurrencies = new Set(
    records.map((e) => e.inputCurrency).filter((c) => c && c !== FRESH_INSTALL_DEFAULTS.mainCurrency)
  );

  const subCurrencies = new Set(FRESH_INSTALL_DEFAULTS.subCurrencies);
  usedCurrencies.forEach((c) => subCurrencies.add(c));

  return {
    mainCurrency: FRESH_INSTALL_DEFAULTS.mainCurrency,
    subCurrencies: [...subCurrencies],
    targetCurrency: FRESH_INSTALL_DEFAULTS.targetCurrency,
  };
}

export const settingsStorage = {
  async get() {
    if (cache) return cache;

    let settings = readRaw();
    if (!settings) {
      settings = await buildInitialSettings();
      writeRaw(settings);
    }
    cache = settings;
    return settings;
  },

  async setAll(settings) {
    writeRaw(settings);
    return settings;
  },
};

/** 메인 화폐 -> 서브 화폐들 -> 환산 화폐 순서로 중복 없이 합친, 입력 화면에서 쓸 통화 코드 목록 */
export function effectiveCurrencies(settings) {
  const seen = new Set();
  const list = [];
  [settings.mainCurrency, ...settings.subCurrencies, settings.targetCurrency].forEach((code) => {
    if (code && !seen.has(code)) {
      seen.add(code);
      list.push(code);
    }
  });
  return list;
}
