import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SETTINGS,
  calculateCalories,
  calculateExpenditure,
  createDailyRecord,
  planForDayType,
} from "../js/domain.mjs";

test("按碳水、蛋白质、脂肪顺序计算热量", () => {
  assert.equal(calculateCalories({ carbs: 327, protein: 120, fat: 68 }), 2400);
});

test("计算基础、步数、力量、有氧和总消耗", () => {
  const expenditure = calculateExpenditure(
    {
      weightKg: 71.5,
      steps: 8000,
      strengthMinutes: 90,
      cardioCalories: 120,
    },
    DEFAULT_SETTINGS,
  );

  assert.deepEqual(expenditure, {
    base: 1892.9,
    steps: 257.4,
    strength: 429,
    cardio: 120,
    total: 2699.3,
  });
});

test("休息日计划热量由三大营养素自动计算", () => {
  assert.deepEqual(planForDayType("rest", DEFAULT_SETTINGS), {
    carbs: 250,
    protein: 115,
    fat: 60,
    calories: 2000,
  });
});

test("创建含体重、计划快照和热量盈余的每日记录", () => {
  const record = createDailyRecord(
    {
      date: "2026-07-29",
      weightKg: 71.5,
      dayType: "training",
      actual: { carbs: 327, protein: 120, fat: 68 },
      steps: 8000,
      strengthMinutes: 90,
      cardioCalories: 120,
    },
    DEFAULT_SETTINGS,
    "2026-07-29T12:00:00.000Z",
  );

  assert.equal(record.weightKg, 71.5);
  assert.equal(record.actual.calories, 2400);
  assert.equal(record.plan.calories, 2400);
  assert.equal(record.surplus, -299.3);
  assert.equal(record.updatedAt, "2026-07-29T12:00:00.000Z");
  assert.notEqual(record.plan, DEFAULT_SETTINGS.plans.training);
});

test("未填写体重时保留 null 并使用默认体重估算消耗", () => {
  const record = createDailyRecord(
    {
      date: "2026-07-30",
      weightKg: null,
      dayType: "rest",
      actual: { carbs: 250, protein: 115, fat: 60 },
      steps: 0,
      strengthMinutes: 0,
      cardioCalories: 0,
    },
    DEFAULT_SETTINGS,
  );

  assert.equal(record.weightKg, null);
  assert.equal(record.expenditure.total, 1892.9);
});

test("拒绝负数、非法日期和非法日类型", () => {
  assert.throws(
    () =>
      createDailyRecord(
        {
          date: "29/07/2026",
          weightKg: -1,
          dayType: "workout",
          actual: { carbs: -1, protein: 1, fat: 1 },
          steps: 0,
          strengthMinutes: 0,
          cardioCalories: 0,
        },
        DEFAULT_SETTINGS,
      ),
    /日期|非负|日类型/,
  );
});
