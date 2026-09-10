// VND -> KRW 실시간 환율 조회.
// open.er-api.com은 무료 사용량 제한이 있어서, 1시간 동안은 캐시된 값을
// 재사용하고 그 이후에만 새로 요청합니다. "새로고침" 버튼을 누르면
// forceRefresh 옵션으로 캐시를 무시하고 즉시 새로 가져옵니다.

const API_URL = "https://open.er-api.com/v6/latest/VND";
const CACHE_KEY = "vnd_krw_rate_cache_v1";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1시간

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(entry) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
}

async function fetchRateFromApi() {
  const res = await fetch(API_URL);
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
 * @returns {Promise<{ rate: number, fetchedAt: number, fromCache: boolean, error?: string }>}
 */
export async function getExchangeRate({ forceRefresh = false } = {}) {
  const cached = readCache();
  const isFresh = cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS;

  if (!forceRefresh && isFresh) {
    return { rate: cached.rate, fetchedAt: cached.fetchedAt, fromCache: true };
  }

  try {
    const rate = await fetchRateFromApi();
    const fetchedAt = Date.now();
    writeCache({ rate, fetchedAt });
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
