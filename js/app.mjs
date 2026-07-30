import {
  DEFAULT_SETTINGS,
  calculateCalories,
  calculateExpenditure,
  createDailyRecord,
  planForDayType,
} from "./domain.mjs";
import { createRepository } from "./storage.mjs";
import {
  recordsForMonth,
  summarizeMonth,
  buildChartSeries,
  recordsForYear,
  summarizeYear,
  aggregateYearByMonth,
  buildAnnualChartSeries,
} from "./summary.mjs";
import {
  COLORS,
  renderLineChart,
  renderBarChart,
} from "./charts.mjs";

const repository = createRepository(window.localStorage);
const elementKey = (id) => id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
const elements = Object.fromEntries(
  [
    "view-month", "view-year", "month-controls", "year-controls",
    "month-picker", "previous-month", "next-month", "today-month",
    "year-picker", "previous-year", "next-year", "today-year",
    "summary-days", "summary-intake", "summary-expenditure", "summary-surplus",
    "summary-weight", "summary-weight-detail", "daily-form", "record-date",
    "weight-kg", "day-type", "actual-carbs", "actual-protein", "actual-fat",
    "actual-calories", "steps", "strength-minutes", "cardio-calories",
    "plan-calories", "plan-carbs", "plan-protein", "plan-fat", "preview-base",
    "preview-steps", "preview-strength", "preview-total", "preview-surplus",
    "records-body", "records-empty", "record-count", "editing-badge", "cancel-edit",
    "monthly-records", "annual-records", "annual-records-body",
    "annual-records-empty", "records-eyebrow", "records-title",
    "intake-chart", "surplus-chart", "macro-chart", "weight-chart",
    "weight-granularity", "weight-monthly", "weight-daily",
    "weight-chart-caption", "visual-eyebrow", "visual-title",
    "settings-button", "settings-dialog", "settings-form", "close-settings",
    "training-carbs", "training-protein", "training-fat", "training-plan-calories",
    "rest-carbs", "rest-protein", "rest-fat", "rest-plan-calories",
    "default-weight", "bmr", "activity-factor", "step-coefficient", "strength-met",
    "reset-settings", "export-button", "import-button", "import-file", "toast",
  ].map((id) => [elementKey(id), document.getElementById(id)]),
);

let selectedMonth = localMonth(new Date());
let selectedYear = selectedMonth.slice(0, 4);
let viewMode = "month";
let weightGranularity = "monthly";
let editingDate = null;
let toastTimer;
let pendingDelete = null;

function localDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localMonth(date) {
  return localDate(date).slice(0, 7);
}

function numberFrom(element, fallback = 0) {
  return element.value === "" ? fallback : Number(element.value);
}

function formatNumber(value, suffix = "") {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "—";
  }
  return `${Number(value).toLocaleString("zh-CN", { maximumFractionDigits: 1 })}${suffix}`;
}

function formatWeight(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "—";
  }
  return Number(value).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

function formatSigned(value, suffix = "") {
  if (value === null || value === undefined) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatNumber(Math.abs(value), suffix)}`;
}

function setPolarity(element, value) {
  element.classList.toggle("positive", value > 0);
  element.classList.toggle("negative", value < 0);
}

function showToast(message, { error = false, undoLabel = "", onUndo = null, onTimeout = null } = {}) {
  clearTimeout(toastTimer);
  elements.toast.classList.remove("error", "undo-toast");
  elements.toast.replaceChildren();
  if (onUndo && undoLabel) {
    const text = document.createElement("span");
    text.textContent = message;
    const undo = document.createElement("button");
    undo.type = "button";
    undo.className = "toast-undo";
    undo.textContent = undoLabel;
    undo.addEventListener("click", () => {
      clearTimeout(toastTimer);
      elements.toast.classList.remove("show");
      onUndo();
    });
    elements.toast.append(text, undo);
    elements.toast.classList.add("undo-toast");
  } else {
    elements.toast.textContent = message;
  }
  elements.toast.classList.toggle("error", error);
  elements.toast.classList.add("show");
  toastTimer = setTimeout(() => {
    elements.toast.classList.remove("show");
    if (onTimeout) onTimeout();
  }, 10000);
}

function selectedDayType() {
  return new FormData(elements.dailyForm).get("dayType");
}

function currentInput() {
  return {
    date: elements.recordDate.value,
    weightKg: elements.weightKg.value === "" ? null : numberFrom(elements.weightKg),
    dayType: selectedDayType(),
    actual: {
      carbs: numberFrom(elements.actualCarbs),
      protein: numberFrom(elements.actualProtein),
      fat: numberFrom(elements.actualFat),
    },
    steps: numberFrom(elements.steps),
    strengthMinutes: numberFrom(elements.strengthMinutes),
    cardioCalories: numberFrom(elements.cardioCalories),
  };
}

function updatePreview() {
  const state = repository.loadState();
  const input = currentInput();
  const plan = planForDayType(input.dayType, state.settings);
  const calories = calculateCalories(input.actual);
  const expenditure = calculateExpenditure(input, state.settings);
  const surplus = Math.round((calories - expenditure.total) * 10) / 10;

  elements.planCalories.textContent = `${formatNumber(plan.calories)} kcal`;
  elements.planCarbs.textContent = `${formatNumber(plan.carbs)} g`;
  elements.planProtein.textContent = `${formatNumber(plan.protein)} g`;
  elements.planFat.textContent = `${formatNumber(plan.fat)} g`;
  elements.actualCalories.textContent = `${formatNumber(calories)} kcal`;
  elements.previewBase.textContent = `${formatNumber(expenditure.base)} kcal`;
  elements.previewSteps.textContent = `${formatNumber(expenditure.steps)} kcal`;
  elements.previewStrength.textContent = `${formatNumber(expenditure.strength)} kcal`;
  elements.previewTotal.textContent = `${formatNumber(expenditure.total)} kcal`;
  elements.previewSurplus.textContent = formatSigned(surplus, " kcal");
  setPolarity(elements.previewSurplus, surplus);
}

function renderSummary(summary) {
  elements.summaryDays.textContent = `${summary.recordedDays} 天`;
  elements.summaryIntake.textContent =
    summary.averageIntake === null ? "—" : formatNumber(summary.averageIntake);
  elements.summaryExpenditure.textContent =
    summary.averageExpenditure === null
      ? "—"
      : formatNumber(summary.averageExpenditure);
  elements.summarySurplus.textContent = formatSigned(
    summary.cumulativeSurplus,
    " kcal",
  );
  setPolarity(elements.summarySurplus, summary.cumulativeSurplus);
  elements.summaryWeight.textContent =
    summary.weightChange === null
      ? "—"
      : formatSigned(summary.weightChange, " kg");
  setPolarity(elements.summaryWeight, summary.weightChange ?? 0);
  elements.summaryWeightDetail.textContent =
    summary.startWeight === null
      ? "等待体重记录"
      : `${formatWeight(summary.startWeight)} → ${formatWeight(summary.latestWeight)} kg`;
}

function td(content, className = "") {
  const cell = document.createElement("td");
  cell.className = className;
  if (content instanceof Node) cell.append(content);
  else cell.textContent = content;
  return cell;
}

function renderRecords(records) {
  elements.recordsBody.replaceChildren();
  elements.recordsEmpty.hidden = records.length > 0;
  elements.recordCount.textContent = records.length
    ? `${records.length} 天已记录`
    : "暂无记录";

  for (const record of records) {
    const row = document.createElement("tr");
    const type = document.createElement("span");
    type.className = `type-pill ${record.dayType}`;
    type.textContent = record.dayType === "training" ? "训练日" : "休息日";

    const actions = document.createElement("div");
    actions.className = "row-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "text-button";
    edit.textContent = "编辑";
    edit.dataset.action = "edit";
    edit.dataset.date = record.date;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "text-button danger";
    remove.textContent = "删除";
    remove.dataset.action = "delete";
    remove.dataset.date = record.date;
    actions.append(edit, remove);

    const surplusCell = td(formatSigned(record.surplus), record.surplus >= 0 ? "positive" : "negative");
    row.append(
      td(record.date.slice(5).replace("-", "/")),
      td(type),
      td(record.weightKg === null ? "—" : `${formatWeight(record.weightKg)} kg`),
      td(`${formatNumber(record.plan.calories)} / ${formatNumber(record.actual.calories)}`),
      td(`${formatNumber(record.actual.carbs)} / ${formatNumber(record.plan.carbs)}`),
      td(`${formatNumber(record.actual.protein)} / ${formatNumber(record.plan.protein)}`),
      td(`${formatNumber(record.actual.fat)} / ${formatNumber(record.plan.fat)}`),
      td(formatNumber(record.activity.steps)),
      td(formatNumber(record.activity.strengthMinutes)),
      td(formatNumber(record.activity.cardioCalories)),
      td(formatNumber(record.expenditure.total)),
      surplusCell,
      td(actions),
    );
    elements.recordsBody.append(row);
  }
}

function renderAnnualRecords(months) {
  elements.annualRecordsBody.replaceChildren();
  elements.annualRecordsEmpty.hidden = months.length > 0;
  elements.recordCount.textContent = months.length
    ? `${months.length} 个月有记录`
    : "暂无记录";

  for (const month of months) {
    const row = document.createElement("tr");
    row.dataset.month = month.month;
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.setAttribute("aria-label", `查看 ${month.label} 每日记录`);
    const surplusCell = td(
      formatSigned(month.cumulativeSurplus),
      month.cumulativeSurplus >= 0 ? "positive" : "negative",
    );
    const arrowCell = td("→", "annual-arrow");
    row.append(
      td(month.label),
      td(`${month.recordedDays} 天`),
      td(month.averageWeight === null ? "—" : `${formatWeight(month.averageWeight)} kg`),
      td(formatNumber(month.averageIntake)),
      td(formatNumber(month.averageExpenditure)),
      surplusCell,
      td(formatNumber(month.averageCarbs)),
      td(formatNumber(month.averageProtein)),
      td(formatNumber(month.averageFat)),
      arrowCell,
    );
    elements.annualRecordsBody.append(row);
  }
}

function renderCharts(series, annual = false) {
  renderLineChart(elements.intakeChart, series.intakeExpenditure, {
    series: [
      { key: "intake", label: "实际摄入", color: COLORS.green },
      { key: "expenditure", label: "总消耗", color: COLORS.coral },
    ],
    unit: "kcal",
    axis: { step: 200 },
    summary: "每日实际摄入与总消耗趋势",
  });
  renderBarChart(elements.surplusChart, series.surplus);
  const weightSeries = annual
    ? weightGranularity === "monthly"
      ? series.monthlyWeight
      : series.dailyWeight
    : series.weight;
  renderLineChart(elements.weightChart, weightSeries, {
    series: [{
      key: "value",
      label: "体重",
      color: COLORS.violet,
      maximumFractionDigits: 2,
    }],
    unit: "kg",
    axis: { step: 0.5 },
    summary: "只包含已填写体重日期的体重趋势",
  });

  renderLineChart(elements.macroChart, series.macros, {
    series: [
      { key: "carbs", label: "碳水", color: COLORS.cyan },
      { key: "protein", label: "蛋白质", color: COLORS.blue },
      { key: "fat", label: "脂肪", color: COLORS.amber },
    ],
    unit: "g",
    axis: {
      step: 80,
      offset: 20,
      floor: 20,
      includeValuesBelowFloor: true,
    },
    summary: annual
      ? "每月日均碳水、蛋白质、脂肪实际摄入克数"
      : "每日碳水、蛋白质、脂肪实际摄入克数",
  });
}

function renderModeControls() {
  const annual = viewMode === "year";
  elements.viewMonth.setAttribute("aria-pressed", String(!annual));
  elements.viewYear.setAttribute("aria-pressed", String(annual));
  elements.monthControls.hidden = annual;
  elements.yearControls.hidden = !annual;
  elements.monthlyRecords.hidden = annual;
  elements.annualRecords.hidden = !annual;
  elements.weightGranularity.hidden = !annual;
  elements.weightMonthly.setAttribute(
    "aria-pressed",
    String(weightGranularity === "monthly"),
  );
  elements.weightDaily.setAttribute(
    "aria-pressed",
    String(weightGranularity === "daily"),
  );
}

function renderMonthView(state) {
  const records = recordsForMonth(state.records, selectedMonth);
  elements.monthPicker.value = selectedMonth;
  elements.recordsEyebrow.textContent = "MONTHLY LOG";
  elements.recordsTitle.textContent = "本月记录";
  elements.visualEyebrow.textContent = "MONTHLY TRENDS";
  elements.visualTitle.textContent = "本月可视化";
  elements.weightChartCaption.textContent = "按实际填写日期展示，空白日期不会按零计算";
  renderSummary(summarizeMonth(records));
  renderRecords(records);
  renderCharts(buildChartSeries(records));
}

function renderYearView(state) {
  const records = recordsForYear(state.records, selectedYear);
  const months = aggregateYearByMonth(records);
  elements.yearPicker.value = selectedYear;
  elements.recordsEyebrow.textContent = "ANNUAL LOG";
  elements.recordsTitle.textContent = "年度月度汇总";
  elements.visualEyebrow.textContent = "ANNUAL TRENDS";
  elements.visualTitle.textContent = "年度可视化";
  elements.weightChartCaption.textContent =
    weightGranularity === "monthly"
      ? "显示每月有效体重的平均值"
      : "显示全年每个有效体重记录";
  renderSummary(summarizeYear(records));
  renderAnnualRecords(months);
  renderCharts(buildAnnualChartSeries(months, records), true);
}

function render() {
  const state = repository.loadState();
  renderModeControls();
  if (viewMode === "year") renderYearView(state);
  else renderMonthView(state);
  updatePreview();
}

function resetEntryForm(date = localDate(new Date())) {
  editingDate = null;
  elements.dailyForm.reset();
  elements.recordDate.value = date;
  elements.steps.value = "0";
  elements.strengthMinutes.value = "0";
  elements.cardioCalories.value = "0";
  elements.editingBadge.hidden = true;
  elements.cancelEdit.hidden = true;
  updatePreview();
}

function loadRecordForEdit(date, { scroll = true } = {}) {
  const record = repository.loadState().records[date];
  if (!record) return false;
  editingDate = date;
  elements.recordDate.value = record.date;
  elements.weightKg.value = record.weightKg ?? "";
  elements.dailyForm.elements.dayType.value = record.dayType;
  elements.actualCarbs.value = record.actual.carbs;
  elements.actualProtein.value = record.actual.protein;
  elements.actualFat.value = record.actual.fat;
  elements.steps.value = record.activity.steps;
  elements.strengthMinutes.value = record.activity.strengthMinutes;
  elements.cardioCalories.value = record.activity.cardioCalories;
  elements.editingBadge.hidden = false;
  elements.cancelEdit.hidden = false;
  updatePreview();
  if (scroll) {
    elements.dailyForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  return true;
}

function shiftMonth(delta) {
  const [year, month] = selectedMonth.split("-").map(Number);
  const next = new Date(year, month - 1 + delta, 1);
  selectedMonth = localMonth(next);
  render();
}

function shiftYear(delta) {
  selectedYear = String(Number(selectedYear) + delta);
  render();
}

function fillSettingsForm(settings) {
  for (const dayType of ["training", "rest"]) {
    for (const macro of ["carbs", "protein", "fat"]) {
      elements[elementKey(`${dayType}-${macro}`)].value =
        settings.plans[dayType][macro];
    }
  }
  elements.defaultWeight.value = settings.expenditure.defaultWeightKg;
  elements.bmr.value = settings.expenditure.bmr;
  elements.activityFactor.value = settings.expenditure.activityFactor;
  elements.stepCoefficient.value = settings.expenditure.stepCoefficient;
  elements.strengthMet.value = settings.expenditure.strengthMet;
  updateSettingsCalories();
}

function settingsFromForm() {
  return {
    plans: {
      training: {
        carbs: numberFrom(elements.trainingCarbs),
        protein: numberFrom(elements.trainingProtein),
        fat: numberFrom(elements.trainingFat),
      },
      rest: {
        carbs: numberFrom(elements.restCarbs),
        protein: numberFrom(elements.restProtein),
        fat: numberFrom(elements.restFat),
      },
    },
    expenditure: {
      defaultWeightKg: numberFrom(elements.defaultWeight),
      bmr: numberFrom(elements.bmr),
      activityFactor: numberFrom(elements.activityFactor),
      stepCoefficient: numberFrom(elements.stepCoefficient),
      strengthMet: numberFrom(elements.strengthMet),
    },
  };
}

function updateSettingsCalories() {
  for (const dayType of ["training", "rest"]) {
    const macros = {
      carbs: numberFrom(elements[elementKey(`${dayType}-carbs`)]),
      protein: numberFrom(elements[elementKey(`${dayType}-protein`)]),
      fat: numberFrom(elements[elementKey(`${dayType}-fat`)]),
    };
    elements[elementKey(`${dayType}-plan-calories`)].textContent =
      `${formatNumber(calculateCalories(macros))} kcal`;
  }
}

elements.dailyForm.addEventListener("input", () => {
  try {
    updatePreview();
  } catch {
    elements.actualCalories.textContent = "请检查输入";
  }
});

elements.recordDate.addEventListener("change", () => {
  const date = elements.recordDate.value;
  if (!date) return;
  if (!loadRecordForEdit(date, { scroll: false })) {
    resetEntryForm(date);
  }
});

elements.dailyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const state = repository.loadState();
    const input = currentInput();
    const existing = state.records[input.date];
    if (existing && input.date !== editingDate) {
      if (!window.confirm(`${input.date} 已有记录，是否覆盖？`)) return;
    }
    const record = createDailyRecord(input, state.settings);
    if (existing && editingDate === input.date && existing.dayType === input.dayType) {
      record.plan = structuredClone(existing.plan);
    }
    repository.saveRecord(record);
    if (viewMode === "month") selectedMonth = input.date.slice(0, 7);
    render();
    loadRecordForEdit(input.date, { scroll: false });
    showToast(existing ? "当日记录已更新" : "当日记录已保存");
    const saveBtn = elements.dailyForm.querySelector('button[type="submit"]');
    saveBtn.classList.add("saved");
    saveBtn.addEventListener("animationend", () => saveBtn.classList.remove("saved"), { once: true });
  } catch (error) {
    showToast(error.message, { error: true });
  }
});

elements.recordsBody.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (button.dataset.action === "edit") loadRecordForEdit(button.dataset.date);
  if (button.dataset.action === "delete") {
    if (!window.confirm(`确定删除 ${button.dataset.date} 的记录吗？`)) return;
    const state = repository.loadState();
    pendingDelete = state.records[button.dataset.date] ? structuredClone(state.records[button.dataset.date]) : null;
    repository.deleteRecord(button.dataset.date);
    if (editingDate === button.dataset.date) resetEntryForm();
    render();
    if (pendingDelete) {
      showToast(`已删除 ${button.dataset.date} 的记录`, {
        undoLabel: "撤销",
        onUndo() {
          repository.saveRecord(pendingDelete);
          pendingDelete = null;
          render();
          showToast("已撤销删除");
        },
        onTimeout() {
          pendingDelete = null;
        },
      });
    }
  }
});

elements.cancelEdit.addEventListener("click", () => resetEntryForm());
elements.viewMonth.addEventListener("click", () => {
  viewMode = "month";
  render();
});
elements.viewYear.addEventListener("click", () => {
  viewMode = "year";
  selectedYear = selectedMonth.slice(0, 4);
  render();
});
elements.previousMonth.addEventListener("click", () => shiftMonth(-1));
elements.nextMonth.addEventListener("click", () => shiftMonth(1));
elements.todayMonth.addEventListener("click", () => {
  selectedMonth = localMonth(new Date());
  render();
});
elements.monthPicker.addEventListener("change", () => {
  if (elements.monthPicker.value) selectedMonth = elements.monthPicker.value;
  render();
});
elements.previousYear.addEventListener("click", () => shiftYear(-1));
elements.nextYear.addEventListener("click", () => shiftYear(1));
elements.todayYear.addEventListener("click", () => {
  selectedYear = String(new Date().getFullYear());
  render();
});
elements.yearPicker.addEventListener("change", () => {
  if (/^\d{4}$/.test(elements.yearPicker.value)) {
    selectedYear = elements.yearPicker.value;
  }
  render();
});
elements.weightMonthly.addEventListener("click", () => {
  weightGranularity = "monthly";
  render();
});
elements.weightDaily.addEventListener("click", () => {
  weightGranularity = "daily";
  render();
});

function openAnnualMonth(month) {
  if (!month) return;
  selectedMonth = month;
  viewMode = "month";
  render();
}

elements.annualRecordsBody.addEventListener("click", (event) => {
  openAnnualMonth(event.target.closest("tr[data-month]")?.dataset.month);
});
elements.annualRecordsBody.addEventListener("keydown", (event) => {
  if (!["Enter", " "].includes(event.key)) return;
  event.preventDefault();
  openAnnualMonth(event.target.closest("tr[data-month]")?.dataset.month);
});

elements.settingsButton.addEventListener("click", () => {
  fillSettingsForm(repository.loadState().settings);
  elements.settingsDialog.showModal();
});
elements.closeSettings.addEventListener("click", () => elements.settingsDialog.close());
elements.resetSettings.addEventListener("click", () => fillSettingsForm(DEFAULT_SETTINGS));
elements.settingsForm.addEventListener("input", updateSettingsCalories);
elements.settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    repository.saveSettings(settingsFromForm());
    elements.settingsDialog.close();
    render();
    showToast("计划与计算参数已保存");
  } catch (error) {
    showToast(error.message, { error: true });
  }
});

elements.exportButton.addEventListener("click", async () => {
  const data = repository.exportBackup();
  const filename = `fitness-tracker-backup-${localDate(new Date())}.json`;
  try {
    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: "JSON 备份", accept: { "application/json": [".json"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(data);
      await writable.close();
    } else {
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    }
    showToast("备份已导出");
  } catch (err) {
    if (err.name !== "AbortError") showToast("导出失败", { error: true });
  }
});
elements.importButton.addEventListener("click", () => elements.importFile.click());
elements.importFile.addEventListener("change", async () => {
  const [file] = elements.importFile.files;
  elements.importFile.value = "";
  if (!file) return;
  if (!window.confirm("导入会替换当前所有记录与设置，是否继续？")) return;
  try {
    repository.importBackup(await file.text(), "replace");
    resetEntryForm();
    render();
    showToast("备份已恢复");
  } catch (error) {
    showToast(`导入失败：${error.message}`, true);
  }
});

resetEntryForm();
render();
