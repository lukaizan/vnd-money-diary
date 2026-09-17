// 지출 데이터 저장소.
//
// 지금은 브라우저 localStorage에 저장하지만, 나중에 회원가입/클라우드 저장으로
// 확장할 때는 이 파일의 LocalStorageExpenseRepository 대신
// 같은 메서드(getAll/add/remove)를 가진 ApiExpenseRepository 같은 클래스를
// 새로 만들어 바꿔 끼우면 됩니다. 화면(screens) 쪽 코드는 그대로 두어도 됩니다.

const STORAGE_KEY = "vnd_money_diary_expenses_v1";
// 스키마를 바꿀 때마다, 옛날 데이터를 한 번이라도 안전하게 원본 그대로
// 백업해 두는 키입니다 (데이터 유실 방지용 안전망).
const PRE_MIGRATION_BACKUP_KEY_V2 = "vnd_money_diary_expenses_backup_pre_currency_v2";
const PRE_MIGRATION_BACKUP_KEY_V3 = "vnd_money_diary_expenses_backup_pre_target_currency_v3";

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("저장된 데이터를 읽는 중 오류:", err);
    return [];
  }
}

function writeAll(expenses) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// 예전 버전에서 저장된 레코드를 현재 구조로 변환합니다. 세대별로:
// - 1세대: type/inputCurrency 없이 vndAmount/krwAmount/rate만 있음
// - 2세대: inputCurrency("VND"|"KRW"), vndAmount, krwAmount, rate (수입/지출 구분 이후 type도 있음)
// - 3세대: type, inputCurrency(4종), amount, krwAmount, rate (환산 화폐가 KRW로 고정이던 시절)
// - 지금 구조: type, inputCurrency, amount, convertedAmount, convertedCurrency, rate
// 어떤 경우든 금액/날짜/카테고리/메모 값 자체는 그대로 유지되고, 필드 이름만 정리됩니다.
function migrateRecord(raw) {
  let record = raw;

  if (typeof record.amount !== "number") {
    const inputCurrency = record.inputCurrency ?? (record.vndAmount ? "VND" : "KRW");
    const amount = inputCurrency === "VND" ? record.vndAmount : record.krwAmount;
    const { vndAmount, ...rest } = record;
    record = {
      ...rest,
      type: record.type ?? "expense",
      inputCurrency,
      amount,
      rate: record.rate ?? null,
      memo: record.memo ?? "",
    };
  } else if (!record.type) {
    record = { ...record, type: "expense" };
  }

  if (typeof record.convertedAmount !== "number") {
    // 예전에는 환산 화폐가 항상 KRW로 고정되어 있었으므로, krwAmount를
    // convertedAmount로 옮기면서 convertedCurrency를 "KRW"로 명시합니다.
    const { krwAmount, ...rest } = record;
    record = {
      ...rest,
      convertedAmount: typeof krwAmount === "number" ? krwAmount : record.amount,
      convertedCurrency: "KRW",
    };
  }

  return record;
}

function isCurrentSchema(raw) {
  return (
    typeof raw.amount === "number" &&
    !!raw.type &&
    typeof raw.convertedAmount === "number" &&
    !!raw.convertedCurrency
  );
}

function migrateAll(rawList) {
  let changed = false;
  const migrated = rawList.map((raw) => {
    if (isCurrentSchema(raw)) return raw;
    changed = true;
    return migrateRecord(raw);
  });
  return { migrated, changed };
}

function backupOnce(key, rawList) {
  try {
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify(rawList));
    }
  } catch (err) {
    console.warn("마이그레이션 백업 저장 실패:", err);
  }
}

class LocalStorageExpenseRepository {
  // async로 만들어 둔 이유: 나중에 서버 API로 바꿔도 호출하는 쪽 코드가
  // await repository.getAll() 형태 그대로 동작하도록 하기 위해서입니다.
  async getAll() {
    const rawList = readAll();
    const { migrated, changed } = migrateAll(rawList);

    if (changed) {
      backupOnce(PRE_MIGRATION_BACKUP_KEY_V2, rawList);
      backupOnce(PRE_MIGRATION_BACKUP_KEY_V3, rawList);
      writeAll(migrated);
    }

    return migrated.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return b.createdAt - a.createdAt;
    });
  }

  async add(expense) {
    const list = readAll();
    const record = {
      id: generateId(),
      createdAt: Date.now(),
      ...expense,
    };
    list.push(record);
    writeAll(list);
    return record;
  }

  async update(id, updates) {
    const list = readAll();
    const index = list.findIndex((e) => e.id === id);
    if (index === -1) return null;

    const updated = { ...list[index], ...updates, id: list[index].id, createdAt: list[index].createdAt };
    list[index] = updated;
    writeAll(list);
    return updated;
  }

  async remove(id) {
    const list = readAll().filter((e) => e.id !== id);
    writeAll(list);
  }

  /**
   * 환산 화폐(설정에서 고른 "환산 화폐")가 바뀔 때, 저장된 모든 내역의 환산
   * 금액을 새 환산 화폐 기준으로 다시 계산합니다. 금액/날짜/카테고리/메모/
   * 원래 입력 통화는 전혀 건드리지 않고, convertedAmount/convertedCurrency/rate만
   * 갱신합니다.
   *
   * @param {string} newTargetCurrency
   * @param {(fromCurrency: string) => Promise<number>} getRate
   *   fromCurrency 1단위가 newTargetCurrency로 얼마인지 반환하는 함수.
   *   레코드 개수와 상관없이, 실제 등장하는 통화 종류별로 한 번씩만 호출됩니다.
   */
  async reconvertAll(newTargetCurrency, getRate) {
    const list = await this.getAll();

    const distinctCurrencies = [
      ...new Set(list.map((r) => r.inputCurrency).filter((c) => c && c !== newTargetCurrency)),
    ];

    const rateByCurrency = {};
    for (const code of distinctCurrencies) {
      rateByCurrency[code] = await getRate(code);
    }

    const updated = list.map((record) => {
      if (record.inputCurrency === newTargetCurrency) {
        return { ...record, convertedAmount: record.amount, convertedCurrency: newTargetCurrency, rate: null };
      }
      const rate = rateByCurrency[record.inputCurrency];
      return { ...record, convertedAmount: record.amount * rate, convertedCurrency: newTargetCurrency, rate };
    });

    writeAll(updated);
    return updated;
  }
}

export const expenseRepository = new LocalStorageExpenseRepository();
