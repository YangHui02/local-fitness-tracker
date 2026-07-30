const test = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

test("浏览器中完成录入、保存、设置快照和体重空值流程", async () => {
  assert.ok(process.env.BROWSER_EXECUTABLE, "BROWSER_EXECUTABLE is required");
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE,
  });
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  try {
    await page.goto("http://127.0.0.1:8877/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const order = await page.locator("#daily-form input").evaluateAll((inputs) =>
      inputs.map((input) => input.id || input.name),
    );
    assert.ok(order.indexOf("record-date") < order.indexOf("weight-kg"));
    assert.ok(order.indexOf("weight-kg") < order.indexOf("dayType"));

    await page.locator("#record-date").fill("2026-07-29");
    await page.locator("#weight-kg").fill("71.55");
    await page.locator("#actual-carbs").fill("327");
    await page.locator("#actual-protein").fill("120");
    await page.locator("#actual-fat").fill("68");
    await page.locator("#steps").fill("8000");
    await page.locator("#strength-minutes").fill("90");
    await page.locator("#cardio-calories").fill("120");

    await assertText(page, "#actual-calories", "2,400 kcal");
    await assertText(page, "#preview-total", "2,699.8 kcal");
    await page.locator("#daily-form button[type=submit]").click();
    await page.waitForSelector("#records-body tr");
    assert.match(await page.locator("#records-body tr").innerText(), /71\.55 kg/);
    assert.equal(await page.locator("#record-date").inputValue(), "2026-07-29");
    assert.equal(await page.locator("#weight-kg").inputValue(), "71.55");
    assert.equal(await page.locator("#actual-carbs").inputValue(), "327");
    assert.equal(await page.locator("#steps").inputValue(), "8000");
    assert.equal(await page.locator("#editing-badge").isVisible(), true);

    await page.locator("#actual-carbs").fill("326");
    await page.locator("#daily-form button[type=submit]").click();
    assert.equal(await page.locator("#records-body tr").count(), 1);
    assert.equal(await page.locator("#actual-carbs").inputValue(), "326");
    assert.equal(await page.locator("#editing-badge").isVisible(), true);

    await page.reload();
    assert.equal(await page.locator("#records-body tr").count(), 1);

    await page.locator("#settings-button").click();
    await page.locator("#training-carbs").fill("300");
    await page.locator("#settings-form button[type=submit]").click();
    await page.locator("#records-body button[data-action=edit]").click();
    await page.locator("#actual-carbs").fill("326");
    await page.locator("#daily-form button[type=submit]").click();
    assert.match(await page.locator("#records-body tr td").nth(3).innerText(), /^2,400/);

    await page.locator("#record-date").fill("2026-07-30");
    await page.locator("#weight-kg").fill("");
    await page.locator("#actual-carbs").fill("300");
    await page.locator("#actual-protein").fill("120");
    await page.locator("#actual-fat").fill("68");
    await page.locator("#steps").fill("0");
    await page.locator("#strength-minutes").fill("0");
    await page.locator("#cardio-calories").fill("0");
    await page.locator("#daily-form button[type=submit]").click();

    assert.equal(await page.locator("#records-body tr").count(), 2);
    assert.equal(await page.locator("#records-empty").isVisible(), false);
    assert.equal(await page.locator("#weight-chart circle").count(), 1);
    assert.equal(await page.locator("#intake-chart svg").count(), 1);

    await page.locator("#record-date").fill("2026-07-31");
    await page.locator("#actual-carbs").fill("999");
    await page.locator("#record-date").fill("2026-07-29");
    await page.locator("#record-date").dispatchEvent("change");

    assert.equal(await page.locator("#weight-kg").inputValue(), "71.55");
    assert.equal(
      await page.locator("input[name=dayType]:checked").inputValue(),
      "training",
    );
    assert.equal(await page.locator("#actual-carbs").inputValue(), "326");
    assert.equal(await page.locator("#actual-protein").inputValue(), "120");
    assert.equal(await page.locator("#actual-fat").inputValue(), "68");
    assert.equal(await page.locator("#steps").inputValue(), "8000");
    assert.equal(await page.locator("#strength-minutes").inputValue(), "90");
    assert.equal(await page.locator("#cardio-calories").inputValue(), "120");
    assert.equal(await page.locator("#editing-badge").isVisible(), true);

    await page.locator("#actual-carbs").fill("325");
    await page.locator("#daily-form button[type=submit]").click();
    assert.equal(await page.locator("#records-body tr").count(), 2);
    assert.match(
      await page.locator("#records-body tr").filter({ hasText: "07/29" }).innerText(),
      /325 \/ 327/,
    );

    await page.locator("#record-date").fill("2026-07-31");
    await page.locator("#record-date").dispatchEvent("change");
    assert.equal(await page.locator("#record-date").inputValue(), "2026-07-31");
    assert.equal(await page.locator("#weight-kg").inputValue(), "");
    assert.equal(await page.locator("#actual-carbs").inputValue(), "");
    assert.equal(await page.locator("#actual-protein").inputValue(), "");
    assert.equal(await page.locator("#actual-fat").inputValue(), "");
    assert.equal(await page.locator("#steps").inputValue(), "0");
    assert.equal(await page.locator("#strength-minutes").inputValue(), "0");
    assert.equal(await page.locator("#cardio-calories").inputValue(), "0");
    assert.equal(await page.locator("#editing-badge").isVisible(), false);

    await page.locator("#record-date").fill("2026-08-01");
    await page.locator("#weight-kg").fill("72");
    await page.locator("#actual-carbs").fill("300");
    await page.locator("#actual-protein").fill("120");
    await page.locator("#actual-fat").fill("68");
    await page.locator("#daily-form button[type=submit]").click();

    await page.locator("#view-year").click();
    assert.equal(await page.locator("#annual-records-body tr").count(), 2);
    assert.equal(
      await page.locator("#weight-monthly").getAttribute("aria-pressed"),
      "true",
    );
    assert.equal(await page.locator("#weight-chart circle").count(), 2);

    await page.locator("#weight-daily").click();
    assert.equal(
      await page.locator("#weight-daily").getAttribute("aria-pressed"),
      "true",
    );
    assert.equal(await page.locator("#weight-chart circle").count(), 2);

    await page.locator("#record-date").fill("2026-08-02");
    await page.locator("#weight-kg").fill("");
    await page.locator("#actual-carbs").fill("310");
    await page.locator("#actual-protein").fill("120");
    await page.locator("#actual-fat").fill("68");
    await page.locator("#daily-form button[type=submit]").click();
    assert.equal(
      await page.locator("#view-year").getAttribute("aria-pressed"),
      "true",
    );
    assert.equal(await page.locator("#annual-records-body tr").count(), 2);

    const chartLayout = await page.locator(".chart-card").evaluateAll((cards) =>
      cards.map((card) => ({
        id: card.querySelector(".chart")?.id,
        width: Math.round(card.getBoundingClientRect().width),
      })),
    );
    assert.deepEqual(
      chartLayout.map((card) => card.id),
      ["weight-chart", "intake-chart", "surplus-chart", "macro-chart"],
    );
    assert.equal(new Set(chartLayout.map((card) => card.width)).size, 1);
    const macroLegend = await page.locator("#macro-chart .chart-legend").innerText();
    assert.match(macroLegend, /碳水/);
    assert.match(macroLegend, /蛋白质/);
    assert.match(macroLegend, /脂肪/);
    assert.doesNotMatch(macroLegend, /达成/);
    assert.match(await page.locator("#macro-chart").innerText(), /\bg\b/);

    if (process.env.ANNUAL_SCREENSHOT_PATH) {
      await page.screenshot({
        path: process.env.ANNUAL_SCREENSHOT_PATH,
        fullPage: true,
      });
    }

    await page.locator("#annual-records-body tr").first().click();
    assert.equal(
      await page.locator("#view-month").getAttribute("aria-pressed"),
      "true",
    );
    assert.equal(await page.locator("#month-picker").inputValue(), "2026-07");
    assert.equal(await page.locator("#records-body tr").count(), 2);

    assert.deepEqual(await yAxisValues(page, "#weight-chart"), [71.5, 72]);
    assert.ok(
      (await yAxisValues(page, "#intake-chart"))
        .every((value) => value % 200 === 0),
    );
    assert.deepEqual(
      await yAxisValues(page, "#macro-chart"),
      [20, 100, 180, 260, 340],
    );
    const surplusTicks = await yAxisValues(page, "#surplus-chart");
    assert.ok(surplusTicks.includes(0));
    assert.ok(surplusTicks.every((value) => value % 50 === 0));
    const firstSurplusBarSpacing = await page
      .locator("#surplus-chart svg")
      .evaluate((svg) => ({
        barX: Number(svg.querySelector("rect.chart-bar").getAttribute("x")),
        barWidth: Number(svg.querySelector("rect.chart-bar").getAttribute("width")),
        plotX: Number(svg.querySelector("line.chart-gridline").getAttribute("x1")),
        labelX: Number(svg.querySelector("text[data-axis=x]").getAttribute("x")),
      }));
    assert.ok(
      firstSurplusBarSpacing.barX >= firstSurplusBarSpacing.plotX + 1,
      "最左侧盈余柱应与纵轴刻度区域保持至少 1px 间距",
    );
    assert.equal(
      firstSurplusBarSpacing.labelX,
      firstSurplusBarSpacing.barX + firstSurplusBarSpacing.barWidth / 2,
      "最左侧日期应与右移后的第一根盈余柱居中对齐",
    );

    await assertChartTooltip(page, "#weight-chart circle", [
      /2026-07-29/,
      /体重/,
      /71\.55 kg/,
    ]);
    await assertChartTooltip(page, "#intake-chart circle", [
      /2026-07-29/,
      /实际摄入/,
      /总消耗/,
      /kcal/,
    ]);
    await assertChartTooltip(page, "#macro-chart circle", [
      /2026-07-29/,
      /碳水/,
      /蛋白质/,
      /脂肪/,
      /\bg\b/,
    ]);
    await assertChartTooltip(page, "#surplus-chart rect", [
      /2026-07-29/,
      /热量盈余/,
      /[+−]\d/,
      /kcal/,
    ]);
    await page.locator("h1").hover();
    assert.equal(
      await page.locator(".chart-tooltip:not([hidden])").count(),
      0,
    );

    if (process.env.SCREENSHOT_PATH) {
      await page.screenshot({
        path: process.env.SCREENSHOT_PATH,
        fullPage: true,
      });
    }

    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator("#daily-form").isVisible(), true);
    assert.equal(await page.locator("#records-body").isVisible(), true);
    assert.deepEqual(
      await page.locator(".chart-card").evaluateAll((cards) =>
        cards.map((card) => card.querySelector(".chart")?.id),
      ),
      ["weight-chart", "intake-chart", "surplus-chart", "macro-chart"],
    );
  } finally {
    await browser.close();
  }
});

async function assertText(page, selector, expected) {
  await page.waitForFunction(
    ({ selector, expected }) =>
      document.querySelector(selector)?.textContent.trim() === expected,
    { selector, expected },
  );
}

async function assertChartTooltip(page, markSelector, patterns) {
  await page.locator(markSelector).first().hover();
  const tooltip = page.locator(".chart-tooltip:not([hidden])");
  assert.equal(await tooltip.count(), 1);
  const text = await tooltip.innerText();
  for (const pattern of patterns) assert.match(text, pattern);
}

async function yAxisValues(page, chartSelector) {
  return page.locator(`${chartSelector} text[data-axis=y]`).evaluateAll((nodes) =>
    nodes.map((node) => Number.parseFloat(node.textContent.replaceAll(",", ""))),
  );
}
