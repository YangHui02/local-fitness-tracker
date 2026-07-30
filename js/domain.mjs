export const DEFAULT_SETTINGS = Object.freeze({
  plans: Object.freeze({
    training: Object.freeze({ carbs: 327, protein: 120, fat: 68 }),
    rest: Object.freeze({ carbs: 250, protein: 115, fat: 60 }),
  }),
  expenditure: Object.freeze({
    defaultWeightKg: 71.5,
    bmr: 1646,
    activityFactor: 1.15,
    stepCoefficient: 0.00045,
    strengthMet: 5,
  }),
});

const DAY_TYPES = new Set(["training", "rest"]);
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function roundOne(value) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function requireNonNegative(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new TypeError(`${label}必须是非负数`);
  }
  return number;
}

function requirePositiveOptional(value, label) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new TypeError(`${label}必须是正数`);
  }
  return number;
}

function validateIsoDate(value) {
  if (!ISO_DATE_PATTERN.test(value)) {
    throw new TypeError("日期必须使用 YYYY-MM-DD 格式");
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new TypeError("日期无效");
  }
  return value;
}

function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

export function calculateCalories({ carbs, protein, fat }) {
  return roundOne(
    requireNonNegative(carbs, "碳水") * 4 +
      requireNonNegative(protein, "蛋白质") * 4 +
      requireNonNegative(fat, "脂肪") * 9,
  );
}

export function planForDayType(dayType, settings = DEFAULT_SETTINGS) {
  if (!DAY_TYPES.has(dayType)) throw new TypeError("日类型无效");
  const macros = clone(settings.plans[dayType]);
  return { ...macros, calories: calculateCalories(macros) };
}

export function calculateExpenditure(activity, settings = DEFAULT_SETTINGS) {
  const config = settings.expenditure;
  const weight =
    requirePositiveOptional(activity.weightKg, "体重") ??
    requirePositiveOptional(config.defaultWeightKg, "默认体重");
  const stepsInput = requireNonNegative(activity.steps, "步数");
  const strengthMinutes = requireNonNegative(
    activity.strengthMinutes,
    "力量训练时长",
  );
  const cardio = requireNonNegative(activity.cardioCalories, "有氧消耗");
  const bmr = requireNonNegative(config.bmr, "基础代谢");
  const activityFactor = requireNonNegative(
    config.activityFactor,
    "基础活动系数",
  );
  const stepCoefficient = requireNonNegative(
    config.stepCoefficient,
    "步数系数",
  );
  const strengthMet = requireNonNegative(config.strengthMet, "力量训练 MET");

  const base = bmr * activityFactor;
  const steps = stepsInput * weight * stepCoefficient;
  const strength =
    (strengthMinutes / 60) * weight * Math.max(0, strengthMet - 1);
  const total = base + steps + strength + cardio;

  return {
    base: roundOne(base),
    steps: roundOne(steps),
    strength: roundOne(strength),
    cardio: roundOne(cardio),
    total: roundOne(total),
  };
}

export function validateDailyInput(input) {
  validateIsoDate(input.date);
  if (!DAY_TYPES.has(input.dayType)) throw new TypeError("日类型无效");

  return {
    date: input.date,
    weightKg: requirePositiveOptional(input.weightKg, "体重"),
    dayType: input.dayType,
    actual: {
      carbs: requireNonNegative(input.actual?.carbs, "碳水"),
      protein: requireNonNegative(input.actual?.protein, "蛋白质"),
      fat: requireNonNegative(input.actual?.fat, "脂肪"),
    },
    steps: requireNonNegative(input.steps, "步数"),
    strengthMinutes: requireNonNegative(
      input.strengthMinutes,
      "力量训练时长",
    ),
    cardioCalories: requireNonNegative(input.cardioCalories, "有氧消耗"),
  };
}

export function createDailyRecord(
  input,
  settings = DEFAULT_SETTINGS,
  updatedAt = new Date().toISOString(),
) {
  const validated = validateDailyInput(input);
  const plan = planForDayType(validated.dayType, settings);
  const actual = {
    ...validated.actual,
    calories: calculateCalories(validated.actual),
  };
  const expenditure = calculateExpenditure(validated, settings);

  return {
    date: validated.date,
    weightKg: validated.weightKg,
    dayType: validated.dayType,
    plan,
    actual,
    activity: {
      steps: validated.steps,
      strengthMinutes: validated.strengthMinutes,
      cardioCalories: validated.cardioCalories,
    },
    expenditure,
    surplus: roundOne(actual.calories - expenditure.total),
    updatedAt,
  };
}
