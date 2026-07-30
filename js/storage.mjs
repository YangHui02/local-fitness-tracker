import { DEFAULT_SETTINGS, calculateCalories } from "./domain.mjs";

export const STORAGE_KEY = "fitness-monthly-tracker:v1";
const SCHEMA_VERSION = 1;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function defaultState() {
  return {
    version: SCHEMA_VERSION,
    settings: clone(DEFAULT_SETTINGS),
    records: {},
  };
}

function requireNonNegative(value, label) {
  if (!Number.isFinite(Number(value)) || Number(value) < 0) {
    throw new TypeError(`${label}必须是非负数`);
  }
}

function validateSettings(settings) {
  if (!settings || typeof settings !== "object") {
    throw new TypeError("设置格式无效");
  }
  for (const dayType of ["training", "rest"]) {
    const plan = settings.plans?.[dayType];
    if (!plan) throw new TypeError("计划设置不完整");
    requireNonNegative(plan.carbs, `${dayType}碳水`);
    requireNonNegative(plan.protein, `${dayType}蛋白质`);
    requireNonNegative(plan.fat, `${dayType}脂肪`);
    calculateCalories(plan);
  }
  const expenditure = settings.expenditure;
  if (!expenditure) throw new TypeError("消耗设置不完整");
  for (const key of [
    "defaultWeightKg",
    "bmr",
    "activityFactor",
    "stepCoefficient",
    "strengthMet",
  ]) {
    requireNonNegative(expenditure[key], key);
  }
  if (Number(expenditure.defaultWeightKg) <= 0) {
    throw new TypeError("默认体重必须是正数");
  }
  return clone(settings);
}

function validateRecord(record, dateKey) {
  if (!record || typeof record !== "object") {
    throw new TypeError("每日记录格式无效");
  }
  if (!ISO_DATE_PATTERN.test(record.date) || record.date !== dateKey) {
    throw new TypeError("每日记录日期无效");
  }
  if (!["training", "rest"].includes(record.dayType)) {
    throw new TypeError("每日记录日类型无效");
  }
  if (!record.plan || !record.actual || !record.expenditure) {
    throw new TypeError("每日记录字段不完整");
  }
  return clone(record);
}

function validateEnvelope(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("备份格式无效");
  }
  if (value.version !== SCHEMA_VERSION) {
    throw new TypeError(`不支持的备份版本：${String(value.version)}`);
  }
  const settings = validateSettings(value.settings);
  if (
    !value.records ||
    typeof value.records !== "object" ||
    Array.isArray(value.records)
  ) {
    throw new TypeError("备份记录格式无效");
  }
  const records = {};
  for (const [date, record] of Object.entries(value.records)) {
    records[date] = validateRecord(record, date);
  }
  return { version: SCHEMA_VERSION, settings, records };
}

function parseStored(raw) {
  if (raw === null) return defaultState();
  try {
    return validateEnvelope(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

export function createRepository(storage) {
  if (
    !storage ||
    typeof storage.getItem !== "function" ||
    typeof storage.setItem !== "function"
  ) {
    throw new TypeError("需要有效的本地存储适配器");
  }

  function read() {
    return parseStored(storage.getItem(STORAGE_KEY));
  }

  function write(state) {
    storage.setItem(STORAGE_KEY, JSON.stringify(validateEnvelope(state)));
  }

  return {
    loadState() {
      return clone(read());
    },

    saveRecord(record) {
      const state = read();
      state.records[record.date] = validateRecord(record, record.date);
      write(state);
      return clone(state.records[record.date]);
    },

    deleteRecord(date) {
      if (!ISO_DATE_PATTERN.test(date)) throw new TypeError("日期无效");
      const state = read();
      delete state.records[date];
      write(state);
    },

    saveSettings(settings) {
      const state = read();
      state.settings = validateSettings(settings);
      write(state);
      return clone(state.settings);
    },

    exportBackup(exportedAt = new Date().toISOString()) {
      return JSON.stringify({ ...read(), exportedAt }, null, 2);
    },

    importBackup(jsonText, mode = "replace") {
      if (mode !== "replace") throw new TypeError("仅支持替换导入");
      let parsed;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        throw new TypeError("备份不是有效的 JSON");
      }
      const validated = validateEnvelope(parsed);
      write(validated);
      return clone(validated);
    },
  };
}
