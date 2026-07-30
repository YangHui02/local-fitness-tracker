import test from "node:test";
import assert from "node:assert/strict";
import {
  recordsForMonth,
  summarizeMonth,
  buildChartSeries,
  recordsForYear,
  summarizeYear,
  aggregateYearByMonth,
  buildAnnualChartSeries,
} from "../js/summary.mjs";

const records = {
  "2026-07-01": {
    date: "2026-07-01",
    weightKg: 71.5,
    actual: { calories: 2400, carbs: 327, protein: 120, fat: 68 },
    plan: { calories: 2400, carbs: 327, protein: 120, fat: 68 },
    expenditure: { total: 2350 },
    surplus: 50,
  },
  "2026-07-02": {
    date: "2026-07-02",
    weightKg: null,
    actual: { calories: 2300, carbs: 300, protein: 120, fat: 69 },
    plan: { calories: 2400, carbs: 327, protein: 120, fat: 68 },
    expenditure: { total: 2400 },
    surplus: -100,
  },
  "2026-07-03": {
    date: "2026-07-03",
    weightKg: 71.8,
    actual: { calories: 2500, carbs: 340, protein: 120, fat: 73 },
    plan: { calories: 2400, carbs: 327, protein: 120, fat: 68 },
    expenditure: { total: 2400 },
    surplus: 100,
  },
  "2026-08-01": {
    date: "2026-08-01",
    weightKg: 72,
    actual: { calories: 2400, carbs: 327, protein: 120, fat: 68 },
    plan: { calories: 2400, carbs: 327, protein: 120, fat: 68 },
    expenditure: { total: 2400 },
    surplus: 0,
  },
};

test("筛选并按日期排序单个月份", () => {
  assert.deepEqual(
    recordsForMonth(records, "2026-07").map((record) => record.date),
    ["2026-07-01", "2026-07-02", "2026-07-03"],
  );
});

test("汇总摄入、消耗、盈余和有效体重", () => {
  assert.deepEqual(summarizeMonth(recordsForMonth(records, "2026-07")), {
    recordedDays: 3,
    averageIntake: 2400,
    averageExpenditure: 2383.3,
    cumulativeSurplus: 50,
    startWeight: 71.5,
    latestWeight: 71.8,
    weightChange: 0.3,
  });
});

test("没有记录时返回可显示的空汇总", () => {
  assert.deepEqual(summarizeMonth([]), {
    recordedDays: 0,
    averageIntake: null,
    averageExpenditure: null,
    cumulativeSurplus: 0,
    startWeight: null,
    latestWeight: null,
    weightChange: null,
  });
});

test("体重序列跳过空值而不是绘制零值", () => {
  const series = buildChartSeries(recordsForMonth(records, "2026-07"));
  assert.deepEqual(
    series.weight.map((point) => point.value),
    [71.5, 71.8],
  );
  assert.equal(series.intakeExpenditure.length, 3);
  assert.equal(series.surplus[1].value, -100);
  assert.deepEqual(series.macros[0], {
    date: "2026-07-01",
    label: "7/1",
    carbs: 327,
    protein: 120,
    fat: 68,
  });
});

test("按年份筛选并汇总有记录月份", () => {
  const yearRecords = recordsForYear(records, "2026");
  const months = aggregateYearByMonth(yearRecords);

  assert.deepEqual(months.map((item) => item.month), ["2026-07", "2026-08"]);
  assert.equal(months[0].recordedDays, 3);
  assert.equal(months[0].averageWeight, 71.7);
  assert.equal(months[0].averageIntake, 2400);
  assert.equal(months[0].averageExpenditure, 2383.3);
  assert.equal(months[0].cumulativeSurplus, 50);
  assert.equal(months[0].averageCarbs, 322.3);
  assert.equal(months[0].averageProtein, 120);
  assert.equal(months[0].averageFat, 70);
  assert.equal(months[0].macroAchievement.carbs, 98.6);
});

test("计划为零的日子不参与营养素达成率平均", () => {
  const twoDays = [
    {
      ...records["2026-07-01"],
      date: "2026-01-01",
      actual: { calories: 400, carbs: 100, protein: 0, fat: 0 },
      plan: { calories: 400, carbs: 100, protein: 0, fat: 0 },
    },
    {
      ...records["2026-07-02"],
      date: "2026-01-02",
      actual: { calories: 200, carbs: 50, protein: 0, fat: 0 },
      plan: { calories: 0, carbs: 0, protein: 0, fat: 0 },
    },
  ];
  const [january] = aggregateYearByMonth(twoDays);
  assert.equal(january.macroAchievement.carbs, 100);
  assert.equal(january.macroAchievement.protein, null);
});

test("年度概览使用全年每日记录并保留首末有效体重", () => {
  assert.deepEqual(summarizeYear(recordsForYear(records, "2026")), {
    recordedDays: 4,
    averageIntake: 2400,
    averageExpenditure: 2387.5,
    cumulativeSurplus: 50,
    startWeight: 71.5,
    latestWeight: 72,
    weightChange: 0.5,
  });
});

test("年度图表同时提供月平均体重和每日体重", () => {
  const yearRecords = recordsForYear(records, "2026");
  const series = buildAnnualChartSeries(
    aggregateYearByMonth(yearRecords),
    yearRecords,
  );

  assert.deepEqual(series.monthlyWeight.map((point) => point.label), [
    "7月",
    "8月",
  ]);
  assert.deepEqual(
    series.dailyWeight.map((point) => point.value),
    [71.5, 71.8, 72],
  );
  assert.equal(series.intakeExpenditure[0].intake, 2400);
  assert.equal(series.surplus[0].value, 50);
  assert.deepEqual(
    {
      carbs: series.macros[0].carbs,
      protein: series.macros[0].protein,
      fat: series.macros[0].fat,
    },
    { carbs: 322.3, protein: 120, fat: 70 },
  );
});
