import assert from "node:assert/strict";
import test from "node:test";

import { buildAxisScale, formatTooltipModel } from "../js/charts.mjs";

test("体重范围向外取整到 0.5 kg 且只产生整数或半公斤刻度", () => {
  assert.deepEqual(buildAxisScale([70.7, 71.2], { step: 0.5 }), {
    domain: [70.5, 71.5],
    ticks: [70.5, 71, 71.5],
  });
});

test("摄入和消耗范围按 200 kcal 生成刻度", () => {
  assert.deepEqual(buildAxisScale([2392, 2699.3], { step: 200 }), {
    domain: [2200, 2800],
    ticks: [2200, 2400, 2600, 2800],
  });
});

test("营养元素从 20 g 开始并每次增加 80 g", () => {
  assert.deepEqual(
    buildAxisScale([68, 120, 325], {
      step: 80,
      offset: 20,
      floor: 20,
      includeValuesBelowFloor: true,
    }),
    { domain: [20, 340], ticks: [20, 100, 180, 260, 340] },
  );
});

test("盈余按 50 kcal 取整并包含零", () => {
  assert.deepEqual(
    buildAxisScale([-307.3, 107], { step: 50, includeZero: true }),
    {
      domain: [-350, 150],
      ticks: [-350, -300, -250, -200, -150, -100, -50, 0, 50, 100, 150],
    },
  );
});

test("单一体重刻度向上下各扩展一个间隔", () => {
  assert.deepEqual(buildAxisScale([71], { step: 0.5 }), {
    domain: [70.5, 71.5],
    ticks: [70.5, 71, 71.5],
  });
});

test("营养元素低于 20 g 时范围包含零但标签仍从 20 开始", () => {
  assert.deepEqual(
    buildAxisScale([0, 18], {
      step: 80,
      offset: 20,
      floor: 20,
      includeValuesBelowFloor: true,
    }),
    { domain: [0, 100], ticks: [20, 100] },
  );
});

test("全部盈余为零时使用正负 50 kcal 范围", () => {
  assert.deepEqual(buildAxisScale([0], { step: 50, includeZero: true }), {
    domain: [-50, 50],
    ticks: [-50, 0, 50],
  });
});

test("多系列提示显示同一日期的全部数值", () => {
  assert.deepEqual(
    formatTooltipModel(
      {
        date: "2026-07-30",
        label: "7/30",
        intake: 2300,
        expenditure: 2410.5,
      },
      [
        { key: "intake", label: "实际摄入" },
        { key: "expenditure", label: "总消耗" },
      ],
      "kcal",
    ),
    {
      heading: "2026-07-30",
      rows: [
        { label: "实际摄入", value: "2,300 kcal" },
        { label: "总消耗", value: "2,410.5 kcal" },
      ],
    },
  );
});

test("盈余提示保留正负号", () => {
  const positive = formatTooltipModel(
    { date: "2026-07-30", label: "7/30", value: 95.8 },
    [{ key: "value", label: "热量盈余", signed: true }],
    "kcal",
  );
  const negative = formatTooltipModel(
    { date: "2026-07-31", label: "7/31", value: -30 },
    [{ key: "value", label: "热量盈余", signed: true }],
    "kcal",
  );

  assert.equal(positive.rows[0].value, "+95.8 kcal");
  assert.equal(negative.rows[0].value, "−30 kcal");
});

test("体重提示支持两位小数", () => {
  const model = formatTooltipModel(
    { date: "2026-07-30", value: 71.55 },
    [{ key: "value", label: "体重", maximumFractionDigits: 2 }],
    "kg",
  );
  assert.equal(model.rows[0].value, "71.55 kg");
});
