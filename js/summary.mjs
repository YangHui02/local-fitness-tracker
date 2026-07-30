const MONTH_PATTERN = /^\d{4}-\d{2}$/;
const YEAR_PATTERN = /^\d{4}$/;

function roundOne(value) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function labelForDate(date) {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
}

export function recordsForMonth(records, month) {
  if (!MONTH_PATTERN.test(month)) throw new TypeError("月份格式必须为 YYYY-MM");
  return Object.values(records)
    .filter((record) => record.date.startsWith(`${month}-`))
    .sort((left, right) => left.date.localeCompare(right.date));
}

export function summarizeMonth(monthRecords) {
  if (monthRecords.length === 0) {
    return {
      recordedDays: 0,
      averageIntake: null,
      averageExpenditure: null,
      cumulativeSurplus: 0,
      startWeight: null,
      latestWeight: null,
      weightChange: null,
    };
  }

  const sum = (selector) =>
    monthRecords.reduce((total, record) => total + selector(record), 0);
  const weights = monthRecords
    .filter(
      (record) =>
        record.weightKg !== null &&
        record.weightKg !== undefined &&
        Number.isFinite(Number(record.weightKg)),
    )
    .map((record) => Number(record.weightKg));
  const startWeight = weights[0] ?? null;
  const latestWeight = weights.at(-1) ?? null;

  return {
    recordedDays: monthRecords.length,
    averageIntake: roundOne(
      sum((record) => record.actual.calories) / monthRecords.length,
    ),
    averageExpenditure: roundOne(
      sum((record) => record.expenditure.total) / monthRecords.length,
    ),
    cumulativeSurplus: roundOne(sum((record) => record.surplus)),
    startWeight,
    latestWeight,
    weightChange:
      startWeight === null ? null : roundOne(latestWeight - startWeight),
  };
}

export function buildChartSeries(monthRecords) {
  return {
    intakeExpenditure: monthRecords.map((record) => ({
      date: record.date,
      label: labelForDate(record.date),
      intake: record.actual.calories,
      expenditure: record.expenditure.total,
    })),
    surplus: monthRecords.map((record) => ({
      date: record.date,
      label: labelForDate(record.date),
      value: record.surplus,
    })),
    macros: monthRecords.map((record) => ({
      date: record.date,
      label: labelForDate(record.date),
      carbs: record.actual.carbs,
      protein: record.actual.protein,
      fat: record.actual.fat,
    })),
    weight: monthRecords
      .filter(
        (record) =>
          record.weightKg !== null &&
          record.weightKg !== undefined &&
          Number.isFinite(Number(record.weightKg)),
      )
      .map((record) => ({
        date: record.date,
        label: labelForDate(record.date),
        value: Number(record.weightKg),
      })),
  };
}

export function recordsForYear(records, year) {
  if (!YEAR_PATTERN.test(year)) throw new TypeError("年份格式必须为 YYYY");
  return Object.values(records)
    .filter((record) => record.date.startsWith(`${year}-`))
    .sort((left, right) => left.date.localeCompare(right.date));
}

export function summarizeYear(yearRecords) {
  return summarizeMonth(yearRecords);
}

function average(values) {
  return values.length
    ? roundOne(values.reduce((total, value) => total + value, 0) / values.length)
    : null;
}

function validWeights(records) {
  return records
    .map((record) => record.weightKg)
    .filter(
      (weight) =>
        weight !== null &&
        weight !== undefined &&
        Number.isFinite(Number(weight)),
    )
    .map(Number);
}

function averageAchievement(records, macro) {
  const ratios = records
    .filter((record) => Number(record.plan[macro]) > 0)
    .map(
      (record) =>
        (Number(record.actual[macro]) / Number(record.plan[macro])) * 100,
    );
  return average(ratios);
}

export function aggregateYearByMonth(yearRecords) {
  const groups = new Map();
  for (const record of yearRecords) {
    const month = record.date.slice(0, 7);
    if (!groups.has(month)) groups.set(month, []);
    groups.get(month).push(record);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, records]) => ({
      month,
      label: `${Number(month.slice(5, 7))}月`,
      recordedDays: records.length,
      averageWeight: average(validWeights(records)),
      averageIntake: average(records.map((record) => record.actual.calories)),
      averageExpenditure: average(
        records.map((record) => record.expenditure.total),
      ),
      cumulativeSurplus: roundOne(
        records.reduce((total, record) => total + record.surplus, 0),
      ),
      averageCarbs: average(records.map((record) => record.actual.carbs)),
      averageProtein: average(records.map((record) => record.actual.protein)),
      averageFat: average(records.map((record) => record.actual.fat)),
      macroAchievement: {
        carbs: averageAchievement(records, "carbs"),
        protein: averageAchievement(records, "protein"),
        fat: averageAchievement(records, "fat"),
      },
    }));
}

export function buildAnnualChartSeries(monthSummaries, yearRecords) {
  return {
    intakeExpenditure: monthSummaries.map((month) => ({
      date: month.month,
      label: month.label,
      intake: month.averageIntake,
      expenditure: month.averageExpenditure,
    })),
    surplus: monthSummaries.map((month) => ({
      date: month.month,
      label: month.label,
      value: month.cumulativeSurplus,
    })),
    macros: monthSummaries.map((month) => ({
      date: month.month,
      label: month.label,
      carbs: month.averageCarbs,
      protein: month.averageProtein,
      fat: month.averageFat,
    })),
    monthlyWeight: monthSummaries
      .filter((month) => month.averageWeight !== null)
      .map((month) => ({
        date: month.month,
        label: month.label,
        value: month.averageWeight,
      })),
    dailyWeight: yearRecords
      .filter(
        (record) =>
          record.weightKg !== null &&
          record.weightKg !== undefined &&
          Number.isFinite(Number(record.weightKg)),
      )
      .map((record) => ({
        date: record.date,
        label: labelForDate(record.date),
        value: Number(record.weightKg),
      })),
  };
}
