// 지출 데이터 저장소.
//
// 지금은 브라우저 localStorage에 저장하지만, 나중에 회원가입/클라우드 저장으로
// 확장할 때는 이 파일의 LocalStorageExpenseRepository 대신
// 같은 메서드(getAll/add/remove)를 가진 ApiExpenseRepository 같은 클래스를
// 새로 만들어 바꿔 끼우면 됩니다. 화면(screens) 쪽 코드는 그대로 두어도 됩니다.

const STORAGE_KEY = "vnd_money_diary_expenses_v1";

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

class LocalStorageExpenseRepository {
  // async로 만들어 둔 이유: 나중에 서버 API로 바꿔도 호출하는 쪽 코드가
  // await repository.getAll() 형태 그대로 동작하도록 하기 위해서입니다.
  async getAll() {
    const list = readAll();
    return list.sort((a, b) => {
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

  async remove(id) {
    const list = readAll().filter((e) => e.id !== id);
    writeAll(list);
  }
}

export const expenseRepository = new LocalStorageExpenseRepository();
