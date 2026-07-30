import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

test("页面仅引用本地资源并包含四类图表", async () => {
  const html = await readFile(join(root, "index.html"), "utf8");
  assert.doesNotMatch(html, /(?:src|href)=["']https?:\/\//i);
  for (const id of [
    "intake-chart",
    "surplus-chart",
    "macro-chart",
    "weight-chart",
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
});

test("当日录入中体重紧接日期之后且营养素顺序正确", async () => {
  const html = await readFile(join(root, "index.html"), "utf8");
  assert.match(html, /id="weight-kg"[^>]*step="0\.05"/);
  const dateIndex = html.indexOf('id="record-date"');
  const weightIndex = html.indexOf('id="weight-kg"');
  const dayTypeIndex = html.indexOf('id="day-type"');
  const carbsIndex = html.indexOf('id="actual-carbs"');
  const proteinIndex = html.indexOf('id="actual-protein"');
  const fatIndex = html.indexOf('id="actual-fat"');
  assert.ok(dateIndex < weightIndex && weightIndex < dayTypeIndex);
  assert.ok(carbsIndex < proteinIndex && proteinIndex < fatIndex);
});

test("页面包含月份导航、设置、备份与记录表", async () => {
  const html = await readFile(join(root, "index.html"), "utf8");
  for (const id of [
    "month-picker",
    "settings-button",
    "export-button",
    "import-button",
    "records-body",
    "settings-dialog",
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
});

test("浏览器标题和页面主标题均为日常热量摄入与消耗记录", async () => {
  const html = await readFile(join(root, "index.html"), "utf8");
  assert.match(html, /<title>日常热量摄入与消耗记录<\/title>/);
  assert.match(html, /<h1>日常热量摄入与消耗记录<\/h1>/);
});

test("页面包含月度年度切换、年份控件和体重粒度切换", async () => {
  const html = await readFile(join(root, "index.html"), "utf8");
  for (const id of [
    "view-month",
    "view-year",
    "year-picker",
    "weight-monthly",
    "weight-daily",
    "annual-records-body",
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
});

test("体重图位于可视化区域第一张卡片并独占整行", async () => {
  const html = await readFile(join(root, "index.html"), "utf8");
  assert.ok(html.indexOf('id="weight-chart"') < html.indexOf('id="intake-chart"'));
  assert.match(html, /class="panel chart-card wide weight-chart-card"/);
});

test("概览记录天数文案同时适用于月度和年度", async () => {
  const html = await readFile(join(root, "index.html"), "utf8");
  assert.match(html, /<small>所选周期有效数据<\/small>/);
  assert.doesNotMatch(html, /<small>本月有效数据<\/small>/);
});

test("四张图按指定顺序且全部全宽", async () => {
  const html = await readFile(join(root, "index.html"), "utf8");
  const ids = [
    "weight-chart",
    "intake-chart",
    "surplus-chart",
    "macro-chart",
  ];
  assert.deepEqual(
    [...ids].sort((left, right) => html.indexOf(left) - html.indexOf(right)),
    ids,
  );
  for (const className of [
    "weight-chart-card",
    "intake-chart-card",
    "macro-chart-card",
    "surplus-chart-card",
  ]) {
    assert.match(html, new RegExp(`chart-card wide ${className}`));
  }
  assert.match(html, /三大营养元素实际摄入/);
  assert.doesNotMatch(html, /三大营养素达成/);
});
