import test from "node:test";
import assert from "node:assert/strict";
import { createRepository, STORAGE_KEY } from "../js/storage.mjs";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    raw: values,
  };
}

function sampleRecord(date = "2026-07-29", planCalories = 2400) {
  return {
    date,
    weightKg: 71.5,
    dayType: "training",
    plan: { carbs: 327, protein: 120, fat: 68, calories: planCalories },
    actual: { carbs: 327, protein: 120, fat: 68, calories: 2400 },
    activity: { steps: 8000, strengthMinutes: 90, cardioCalories: 0 },
    expenditure: {
      base: 1892.9,
      steps: 257.4,
      strength: 429,
      cardio: 0,
      total: 2579.3,
    },
    surplus: -179.3,
    updatedAt: "2026-07-29T12:00:00.000Z",
  };
}

test("按日期独立保存和删除记录", () => {
  const repository = createRepository(memoryStorage());
  repository.saveRecord(sampleRecord("2026-07-28", 2400));
  repository.saveRecord(sampleRecord("2026-07-29", 2000));

  let state = repository.loadState();
  assert.equal(state.records["2026-07-28"].plan.calories, 2400);
  assert.equal(state.records["2026-07-29"].plan.calories, 2000);

  repository.deleteRecord("2026-07-28");
  state = repository.loadState();
  assert.equal(state.records["2026-07-28"], undefined);
  assert.ok(state.records["2026-07-29"]);
});

test("设置变化不会修改已保存的计划快照", () => {
  const repository = createRepository(memoryStorage());
  repository.saveRecord(sampleRecord());
  const settings = repository.loadState().settings;
  settings.plans.training.carbs = 300;
  repository.saveSettings(settings);

  assert.equal(repository.loadState().records["2026-07-29"].plan.carbs, 327);
});

test("loadState 返回防御性副本", () => {
  const repository = createRepository(memoryStorage());
  repository.saveRecord(sampleRecord());
  const state = repository.loadState();
  state.records["2026-07-29"].weightKg = 99;

  assert.equal(repository.loadState().records["2026-07-29"].weightKg, 71.5);
});

test("导出并替换恢复有效的版本化备份", () => {
  const repository = createRepository(memoryStorage());
  repository.saveRecord(sampleRecord());
  const backup = repository.exportBackup("2026-07-29T13:00:00.000Z");

  const parsed = JSON.parse(backup);
  assert.equal(parsed.version, 1);
  assert.equal(parsed.exportedAt, "2026-07-29T13:00:00.000Z");

  const restored = createRepository(memoryStorage());
  restored.importBackup(backup, "replace");
  assert.ok(restored.loadState().records["2026-07-29"]);
});

test("无效备份不会覆盖当前数据", () => {
  const storage = memoryStorage();
  const repository = createRepository(storage);
  repository.saveRecord(sampleRecord());
  const before = storage.getItem(STORAGE_KEY);

  assert.throws(
    () => repository.importBackup('{"version":99}', "replace"),
    /版本/,
  );
  assert.equal(storage.getItem(STORAGE_KEY), before);
});

test("损坏的本地 JSON 安全回退到默认状态", () => {
  const storage = memoryStorage({ [STORAGE_KEY]: "{not-json" });
  const repository = createRepository(storage);
  const state = repository.loadState();

  assert.equal(state.version, 1);
  assert.deepEqual(state.records, {});
  assert.equal(storage.getItem(STORAGE_KEY), "{not-json");
});
