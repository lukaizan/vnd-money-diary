// 지출 데이터 저장소.
//
// 지금은 브라우저 localStorage에 저장하지만, 나중에 회원가입/클라우드 저장으로
// 확장할 때는 이 파일의 LocalStorageExpenseRepository 대신
// 같은 메서드(getAll/add/remove)를 가진 ApiExpenseRepository 같은 클래스를
// 새로 만들어 바꿔 끼우면 됩니다. 화면(screens) 쪽 코드는 그대로 두어도 됩니다.

const STORAGE_KEY = "vnd_money_diary_expenses_v1";
// 통화 종류를 4개로 늘리면서 레코드 구조(vndAmount -> amount)를 바꿀 때,
// 옛날 데이터를 한 번이라도 안전하게 원본 그대로 백업해 두는 키.
const PRE_MIGRATION_BACKUP_KEY = "vnd_money_diary_expenses_backup_pre_currency_v2";

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

// 예전 버전에서 저장된 레코드를 현재 구조로 변환합니다.
// - 아주 옛날 레코드: type/inputCurrency 없이 vndAmount/krwAmount/rate만 있음
// - VND/KRW 토글이 생긴 뒤 레코드: inputCurrency("VND"|"KRW"), vndAmount, krwAmount, rate
// - 지금 구조: type, inputCurrency(4종), amount, krwAmount, rate
// 어떤 경우든 금액/날짜/카테고리/메모 값 자체는 그대로 유지되고, 필드 이름만 정리됩니다.
function migrateRecord(raw) {
  if (typeof raw.amount === "number") {
    // 이미 현재 구조
    return { type: raw.type ?? "expense", ...raw };
  }

  const inputCurrency = raw.inputCurrency ?? (raw.vndAmount ? "VND" : "KRW");
  const amount = inputCurrency === "VND" ? raw.vndAmount : raw.krwAmount;
  const { vndAmount, ...rest } = raw;

  return {
    ...rest,
    type: raw.type ?? "expense",
    inputCurrency,
    amount,
    rate: raw.rate ?? null,
    memo: raw.memo ?? "",
  };
}

function migrateAll(rawList) {
  let changed = false;
  const migrated = rawList.map((raw) => {
    if (typeof raw.amount === "number" && raw.type) return raw;
    changed = true;
    return migrateRecord(raw);
  });
  return { migrated, changed };
}

class LocalStorageExpenseRepository {
  // async로 만들어 둔 이유: 나중에 서버 API로 바꿔도 호출하는 쪽 코드가
  // await repository.getAll() 형태 그대로 동작하도록 하기 위해서입니다.
  async getAll() {
    const rawList = readAll();
    const { migrated, changed } = migrateAll(rawList);

    if (changed) {
      // 구조를 바꾸기 전 원본을 한 번은 그대로 백업해 둡니다 (데이터 유실 방지용 안전망).
      try {
        if (!localStorage.getItem(PRE_MIGRATION_BACKUP_KEY)) {
          localStorage.setItem(PRE_MIGRATION_BACKUP_KEY, JSON.stringify(rawList));
        }
      } catch (err) {
        console.warn("마이그레이션 백업 저장 실패:", err);
      }
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
}

export const expenseRepository = new LocalStorageExpenseRepository();
