const SVG_NS = "http://www.w3.org/2000/svg";
const COLORS = {
  cyan: "#5eead4",
  blue: "#60a5fa",
  violet: "#a78bfa",
  amber: "#fbbf24",
  green: "#68e29d",
  coral: "#ff7a8a",
  red: "#ff4d4d",
};

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, String(value));
  }
  return element;
}

function normalizeAxisNumber(value) {
  return Math.round((value + Number.EPSILON) * 1e10) / 1e10;
}

export function buildAxisScale(values, {
  step,
  offset = 0,
  floor,
  includeZero = false,
  includeValuesBelowFloor = false,
}) {
  const finite = values.map(Number).filter(Number.isFinite);
  if (!finite.length || !Number.isFinite(step) || step <= 0) {
    throw new TypeError("纵轴刻度配置无效");
  }

  const rawMin = includeZero ? Math.min(...finite, 0) : Math.min(...finite);
  const rawMax = includeZero ? Math.max(...finite, 0) : Math.max(...finite);

  if (Number.isFinite(floor)) {
    const domainMin =
      includeValuesBelowFloor && rawMin < floor ? Math.min(0, rawMin) : floor;
    let domainMax = offset + Math.ceil((rawMax - offset) / step) * step;
    if (domainMax <= floor) domainMax = floor + step;
    const ticks = [];
    for (let value = floor; value <= domainMax + step / 1000; value += step) {
      ticks.push(normalizeAxisNumber(value));
    }
    return {
      domain: [normalizeAxisNumber(domainMin), normalizeAxisNumber(domainMax)],
      ticks,
    };
  }

  let domainMin = offset + Math.floor((rawMin - offset) / step) * step;
  let domainMax = offset + Math.ceil((rawMax - offset) / step) * step;
  if (domainMin === domainMax) {
    domainMin -= step;
    domainMax += step;
  }
  const ticks = [];
  for (let value = domainMin; value <= domainMax + step / 1000; value += step) {
    ticks.push(normalizeAxisNumber(value));
  }
  return {
    domain: [normalizeAxisNumber(domainMin), normalizeAxisNumber(domainMax)],
    ticks,
  };
}

function formatAxisValue(value, step) {
  return value.toLocaleString("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: step < 1 ? 1 : 0,
  });
}

function createFrame(container, labels, scale, unit, step) {
  const width = Math.max(620, labels.length * 52);
  const height = 275;
  const margin = { top: 18, right: 20, bottom: 38, left: 54 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const [min, max] = scale.domain;
  const x = (index) =>
    margin.left +
    (labels.length === 1 ? innerWidth / 2 : (index / (labels.length - 1)) * innerWidth);
  const y = (value) =>
    margin.top + ((max - value) / (max - min || 1)) * innerHeight;

  const svg = svgElement("svg", {
    viewBox: `0 0 ${width} ${height}`,
    "aria-hidden": "true",
  });

  scale.ticks.forEach((value, tickIndex) => {
    const tickY = y(value);
    svg.append(
      svgElement("line", {
        x1: margin.left,
        x2: width - margin.right,
        y1: tickY,
        y2: tickY,
        class: "chart-gridline",
      }),
    );
    const text = svgElement("text", {
      x: margin.left - 8,
      y: tickY + 3,
      "text-anchor": "end",
      class: "chart-axis",
      "data-axis": "y",
    });
    text.textContent =
      `${formatAxisValue(value, step)}${tickIndex === scale.ticks.length - 1 && unit ? ` ${unit}` : ""}`;
    svg.append(text);
  });

  const stride = Math.max(1, Math.ceil(labels.length / 10));
  labels.forEach((label, index) => {
    if (index % stride !== 0 && index !== labels.length - 1) return;
    const text = svgElement("text", {
      x: x(index),
      y: height - 13,
      "text-anchor": "middle",
      class: "chart-axis",
      "data-axis": "x",
    });
    text.textContent = label;
    svg.append(text);
  });

  container.append(svg);
  return { svg, width, height, margin, innerWidth, innerHeight, x, y };
}

function addLegend(container, series) {
  const legend = document.createElement("div");
  legend.className = "chart-legend";
  for (const item of series) {
    const label = document.createElement("span");
    label.style.setProperty("--legend-color", item.color);
    label.textContent = item.label;
    legend.append(label);
  }
  container.prepend(legend);
}

function addAccessibleSummary(container, text) {
  const summary = document.createElement("p");
  summary.className = "sr-only";
  summary.textContent = text;
  container.append(summary);
}

export function formatTooltipModel(point, series, unit = "") {
  const rows = series.flatMap((item) => {
    const value = Number(point[item.key]);
    if (!Number.isFinite(value)) return [];
    const prefix = item.signed ? (value > 0 ? "+" : value < 0 ? "−" : "") : "";
    const formatted = Math.abs(value).toLocaleString("zh-CN", {
      maximumFractionDigits: item.maximumFractionDigits ?? 1,
    });
    return [{
      label: item.label,
      value: `${prefix}${formatted}${unit ? ` ${unit}` : ""}`,
    }];
  });
  return {
    heading: point.date || point.label || "",
    rows,
  };
}

function createTooltip() {
  const tooltip = document.createElement("div");
  tooltip.className = "chart-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  document.body.append(tooltip);
  return tooltip;
}

function fillTooltip(tooltip, model, series) {
  tooltip.replaceChildren();
  const heading = document.createElement("strong");
  heading.className = "chart-tooltip-heading";
  heading.textContent = model.heading;
  tooltip.append(heading);
  model.rows.forEach((row, index) => {
    const line = document.createElement("div");
    line.className = "chart-tooltip-row";
    const label = document.createElement("span");
    label.className = "chart-tooltip-label";
    const swatch = document.createElement("i");
    swatch.style.setProperty("--tooltip-color", series[index]?.color || COLORS.green);
    label.append(swatch, document.createTextNode(row.label));
    const value = document.createElement("b");
    value.textContent = row.value;
    line.append(label, value);
    tooltip.append(line);
  });
}

function positionTooltip(tooltip, event) {
  const margin = 8;
  const gap = 6;
  const tooltipRect = tooltip.getBoundingClientRect();
  const maxLeft = window.innerWidth - tooltipRect.width - margin;
  const maxTop = window.innerHeight - tooltipRect.height - margin;
  const preferredLeft = event.clientX + gap;
  const preferredTop = event.clientY + gap;
  tooltip.style.left = `${Math.max(margin, Math.min(preferredLeft, maxLeft))}px`;
  tooltip.style.top = `${Math.max(margin, Math.min(preferredTop, maxTop))}px`;
}

function bindTooltip(mark, tooltip, point, series, unit) {
  const show = (event) => {
    fillTooltip(tooltip, formatTooltipModel(point, series, unit), series);
    tooltip.hidden = false;
    mark.classList.add("is-hovered");
    positionTooltip(tooltip, event);
  };
  mark.addEventListener("pointerenter", show);
  mark.addEventListener("pointermove", (event) => positionTooltip(tooltip, event));
  mark.addEventListener("pointerleave", () => {
    tooltip.hidden = true;
    mark.classList.remove("is-hovered");
  });
}

export function clearChart(container, emptyMessage = "本月暂无可展示数据") {
  container.replaceChildren();
  const empty = document.createElement("div");
  empty.className = "chart-empty";
  empty.textContent = emptyMessage;
  container.append(empty);
}

export function renderLineChart(
  container,
  points,
  { series, unit = "", summary = "趋势图", axis },
) {
  container.replaceChildren();
  if (!points.length) {
    clearChart(container);
    return;
  }
  const values = points.flatMap((point) =>
    series
      .map((item) => Number(point[item.key]))
      .filter((value) => Number.isFinite(value)),
  );
  if (!values.length) {
    clearChart(container);
    return;
  }

  addLegend(container, series);
  const frame = createFrame(
    container,
    points.map((point) => point.label),
    buildAxisScale(values, axis),
    unit,
    axis.step,
  );
  const tooltip = createTooltip();

  for (const item of series) {
    const validPoints = points
      .map((point, index) => ({ value: Number(point[item.key]), index, point }))
      .filter(({ value }) => Number.isFinite(value));
    if (!validPoints.length) continue;
    const pathData = validPoints
      .map(({ value, index }, sequence) =>
        `${sequence === 0 ? "M" : "L"} ${frame.x(index)} ${frame.y(value)}`,
      )
      .join(" ");
    frame.svg.append(
      svgElement("path", {
        d: pathData,
        class: "chart-line",
        stroke: item.color,
      }),
    );
    const baseY = frame.margin.top + frame.innerHeight;
    const areaPath =
      `${pathData} L ${frame.x(validPoints[validPoints.length - 1].index)} ${baseY} L ${frame.x(validPoints[0].index)} ${baseY} Z`;
    frame.svg.append(
      svgElement("path", {
        d: areaPath,
        class: "chart-area",
        fill: hexToRgba(item.color, 0.12),
      }),
    );
    for (const { value, index, point } of validPoints) {
      const circle = svgElement("circle", {
        cx: frame.x(index),
        cy: frame.y(value),
        r: 4,
        fill: item.color,
        class: "chart-point",
      });
      bindTooltip(circle, tooltip, point, [item], unit);
      frame.svg.append(circle);
    }
  }

  addAccessibleSummary(container, summary);
}

function computeNiceStep(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  if (!finite.length) return 50;
  const maxAbs = Math.max(...finite.map(Math.abs), 1);
  const rawStep = maxAbs / 10;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  let nice;
  if (normalized <= 1) nice = 1;
  else if (normalized <= 2) nice = 2;
  else if (normalized <= 5) nice = 5;
  else nice = 10;
  return nice * magnitude;
}

export function renderBarChart(
  container,
  points,
  {
    unit = "kcal",
    summary = "热量盈余柱状图",
    axis = { includeZero: true },
  } = {},
) {
  container.replaceChildren();
  if (!points.length) {
    clearChart(container);
    return;
  }
  const resolvedAxis = {
    ...axis,
    step: axis.step && axis.step > 0 ? axis.step : computeNiceStep(points.map(p => p.value)),
  };
  const frame = createFrame(
    container,
    points.map((point) => point.label),
    buildAxisScale(points.map((point) => point.value), resolvedAxis),
    unit,
    resolvedAxis.step,
  );
  const tooltip = createTooltip();
  const tooltipSeries = [{
    key: "value",
    label: "热量盈余",
    color: COLORS.green,
    signed: true,
  }];
  const zeroY = frame.y(0);
  frame.svg.append(
    svgElement("line", {
      x1: frame.margin.left,
      x2: frame.width - frame.margin.right,
      y1: zeroY,
      y2: zeroY,
      stroke: "rgba(255,255,255,.3)",
    }),
  );
  const slot = frame.innerWidth / Math.max(points.length, 1);
  const barWidth = Math.min(24, slot * 0.55);
  const isSingle = points.length === 1;
  const firstXLabel = frame.svg.querySelector('text[data-axis="x"]');
  if (firstXLabel && !isSingle) {
    firstXLabel.setAttribute("x", String(frame.margin.left + 1 + barWidth / 2));
  }

  points.forEach((point, index) => {
    const valueY = frame.y(point.value);
    const barX =
      index === 0 && !isSingle
        ? frame.margin.left + 1
        : frame.x(index) - barWidth / 2;
    const isPositive = point.value >= 0;
    const rect = svgElement("rect", {
      x: barX,
      y: Math.min(valueY, zeroY),
      width: barWidth,
      height: Math.max(2, Math.abs(zeroY - valueY)),
      rx: 4,
      fill: isPositive ? COLORS.green : COLORS.coral,
      class: "chart-bar",
    });
    tooltipSeries[0].color = point.value >= 0 ? COLORS.green : COLORS.coral;
    bindTooltip(rect, tooltip, point, [{ ...tooltipSeries[0] }], unit);
    frame.svg.append(rect);
  });
  addAccessibleSummary(container, summary);
}

export { COLORS };
