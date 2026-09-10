// <통화> -> KRW 실시간 환율 조회 (VND, USD, CNY 등 KRW가 아닌 모든 입력 통화에 사용).
// open.er-api.com은 무료 사용량 제한이 있어서, 통화별로 1시간 동안은 캐시된 값을
// 재사용하고 그 이후에만 새로 요청합니다. "새로고침" 시 forceRefresh 옵션으로
// 캐시를 무시하고 즉시 새로 가져올 수 있습니다.

const API_URL_BASE = "https://open.er-api.com/v6/latest";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1시간

function cacheKey(baseCurrency) {
  return `krw_rate_cache_v1_${baseCurrency}`;
}

function readCache(baseCurrency) {
  try {
    const raw = localStorage.getItem(cacheKey(baseCurrency));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(baseCurrency, entry) {
  localStorage.setItem(cacheKey(baseCurrency), JSON.stringify(entry));
}

async function fetchRateFromApi(baseCurrency) {
  const res = await fetch(`${API_URL_BASE}/${baseCurrency}`);
  if (!res.ok) {
    throw new Error(`환율 API 응답 오류 (${res.status})`);
  }
  const data = await res.json();
  if (data.result !== "success" || typeof data.rates?.KRW !== "number") {
    throw new Error("환율 데이터 형식이 예상과 다릅니다");
  }
  return data.rates.KRW;
}

/**
 * @param {"VND"|"USD"|"CNY"} baseCurrency 1 단위당 KRW 환율을 구할 통화
 * @returns {Promise<{ rate: number, fetchedAt: number, fromCache: boolean, error?: string }>}
 */
export async function getExchangeRate(baseCurrency, { forceRefresh = false } = {}) {
  const cached = readCache(baseCurrency);
  const isFresh = cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS;

  if (!forceRefresh && isFresh) {
    return { rate: cached.rate, fetchedAt: cached.fetchedAt, fromCache: true };
  }

  try {
    const rate = await fetchRateFromApi(baseCurrency);
    const fetchedAt = Date.now();
    writeCache(baseCurrency, { rate, fetchedAt });
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
