// <통화> -> <통화> 실시간 환율 조회 (입력 통화를 환산 화폐로 바꿀 때 사용).
// open.er-api.com은 무료 사용량 제한이 있어서, (base, target) 조합별로 1시간 동안은
// 캐시된 값을 재사용하고 그 이후에만 새로 요청합니다. "새로고침" 시 forceRefresh
// 옵션으로 캐시를 무시하고 즉시 새로 가져올 수 있습니다.

const API_URL_BASE = "https://open.er-api.com/v6/latest";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1시간

function cacheKey(baseCurrency, targetCurrency) {
  return `rate_cache_v2_${baseCurrency}_${targetCurrency}`;
}

function readCache(baseCurrency, targetCurrency) {
  try {
    const raw = localStorage.getItem(cacheKey(baseCurrency, targetCurrency));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(baseCurrency, targetCurrency, entry) {
  localStorage.setItem(cacheKey(baseCurrency, targetCurrency), JSON.stringify(entry));
}

async function fetchRateFromApi(baseCurrency, targetCurrency) {
  const res = await fetch(`${API_URL_BASE}/${baseCurrency}`);
  if (!res.ok) {
    throw new Error(`환율 API 응답 오류 (${res.status})`);
  }
  const data = await res.json();
  if (data.result !== "success" || typeof data.rates?.[targetCurrency] !== "number") {
    throw new Error("환율 데이터 형식이 예상과 다릅니다");
  }
  return data.rates[targetCurrency];
}

/**
 * @param {string} baseCurrency 1 단위당 환율을 구할 통화
 * @param {string} targetCurrency 환산할 대상 통화 (환산 화폐)
 * @returns {Promise<{ rate: number, fetchedAt: number, fromCache: boolean, error?: string }>}
 */
export async function getExchangeRate(baseCurrency, targetCurrency, { forceRefresh = false } = {}) {
  if (baseCurrency === targetCurrency) {
    return { rate: 1, fetchedAt: Date.now(), fromCache: false };
  }

  const cached = readCache(baseCurrency, targetCurrency);
  const isFresh = cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS;

  if (!forceRefresh && isFresh) {
    return { rate: cached.rate, fetchedAt: cached.fetchedAt, fromCache: true };
  }

  try {
    const rate = await fetchRateFromApi(baseCurrency, targetCurrency);
    const fetchedAt = Date.now();
    writeCache(baseCurrency, targetCurrency, { rate, fetchedAt });
    return { rate, fetchedAt, fromCache: false };
  } catch (err) {
    if (cached) {
      return {
        rate: cached.rate,
        fetchedAt: cached.fetchedAt,
        fromCache: true,
        error: err.message,
      };
    }
    throw err;
  }
}
