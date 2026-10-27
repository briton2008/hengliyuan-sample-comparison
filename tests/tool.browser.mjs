import {tmpdir} from "node:os";
import {join} from "node:path";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.QA_BASE_URL || "http://127.0.0.1:5199";
const output = join(tmpdir(),"hly-sample-browser-qa");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [], errors = [], leaks = [];
const secret = "QA-SAMPLE-PRIVATE-VERSION-7021";
async function start(width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on("pageerror", e => errors.push(e.message));
  page.on("request", r => { if ((r.url() + (r.postData() || "")).includes(secret)) leaks.push(r.url()); });
  await page.goto(base + "/");
  await page.waitForFunction(() => !document.documentElement.classList.contains("hly-app-booting") && document.querySelector(".oem-form input")?.disabled === false, null, { timeout: 30000 });
  return { page, context };
}
async function setup(page, metrics = true) {
  await page.getByRole("textbox", { name: "Project / comparison round", exact: true }).fill("QA round");
  await page.getByRole("textbox", { name: "Actual application / base", exact: true }).fill("Synthetic test base");
  await page.getByRole("textbox", { name: "Reference and target", exact: true }).fill("Customer target in this base");
  await page.getByRole("textbox", { name: "Preparation and comparison conditions", exact: true }).fill("QA preparation only; same conditions for this demonstration");
  await page.getByRole("textbox", { name: "What should be improved first?", exact: true }).fill("Bitterness");
  const refs = page.getByRole("textbox", { name: "Sample / version reference", exact: true });
  await refs.nth(0).fill(secret); await refs.nth(1).fill(secret + "-B");
  if (metrics) await page.getByText("Bitterness intensity", { exact: true }).click();
  await page.getByRole("button", { name: "Create the sample code key", exact: true }).click();
  await page.getByRole("heading", { name: "Label the samples. Keep the key separate.", exact: true }).waitFor();
}
async function evaluate(page, metrics = true) {
  await page.getByRole("button", { name: "Open coded tasting sheet", exact: true }).click();
  await page.getByText("4 / Good", { exact: true }).waitFor();
  assert.equal(await page.locator(".company-tool-document").count(), 0);
  assert.ok(await page.evaluate(marker => !document.body.textContent.includes(marker) && ![...document.querySelectorAll("input,textarea")].some(el => el.value.includes(marker)), secret));
  assert.ok(!(await page.locator("#sample-workspace").innerText()).includes(secret));
  await page.getByText("4 / Good", { exact: true }).click();
  if (metrics) await page.getByText("None", { exact: true }).click();
  await page.getByRole("button", { name: "Next sample", exact: true }).click();
  await page.getByText("3 / Acceptable", { exact: true }).click();
  await page.getByRole("button", { name: "Review my comparison", exact: true }).click();
  await page.getByRole("heading", { name: "What changed between samples?", exact: true }).waitFor();
}
try {
  {
    const { page, context } = await start();
    await page.screenshot({ path: output + "/desktop.png" });
    const firstField = page.getByRole("textbox", { name: "Project / comparison round", exact: true });
    await firstField.focus(); await firstField.press("Tab");
    assert.ok(await page.evaluate(() => document.activeElement.closest(".oem-form") && document.activeElement.getAttribute("aria-labelledby") !== document.querySelector(".oem-form input").getAttribute("aria-labelledby")));
    await page.getByRole("button", { name: "Add a sample", exact: true }).click();
    assert.equal(await page.getByRole("textbox", { name: "Sample / version reference", exact: true }).count(), 3);
    await page.getByRole("button", { name: "Remove sample", exact: true }).last().click();
    await page.getByRole("textbox", { name: "Sample / version reference", exact: true }).nth(2).waitFor({ state: "detached" });
    assert.equal(await page.getByRole("textbox", { name: "Sample / version reference", exact: true }).count(), 2);
    await setup(page);
    await page.evaluate(() => { window.__qaPrints = 0; window.print = () => window.__qaPrints++; });
    await page.getByRole("button", { name: "Print / save code key PDF", exact: true }).click();
    assert.equal(await page.evaluate(() => window.__qaPrints), 1);
    assert.ok((await page.locator(".company-tool-document tbody").textContent()).includes(secret));
    await page.emulateMedia({ media: "print" });
    await page.pdf({ path: output + "/code-key.pdf", format: "A4", printBackground: true });
    await page.emulateMedia({ media: "screen" });
    await evaluate(page);
    const record = page.getByRole("textbox", { name: "Your complete comparison record", exact: true });
    assert.ok(!(await record.inputValue()).includes(secret));
    assert.ok((await record.inputValue()).includes("Bitterness intensity: None"));
    assert.ok((await record.inputValue()).includes("Bitterness intensity: Not recorded"));
    await page.getByLabel("Closest to target", { exact: true }).selectOption({ index: 1 });
    await page.getByLabel("Adjust first", { exact: true }).fill("Reduce bitterness");
    await page.getByLabel("Keep unchanged", { exact: true }).fill("Retain current body");
    await page.getByRole("button", { name: "Copy record", exact: true }).click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), await record.inputValue());
    await writeFile(output + "/coded-record.txt", await record.inputValue());
    await page.getByRole("button", { name: "Print / save company PDF", exact: true }).click();
    assert.equal(await page.evaluate(() => window.__qaPrints), 2);
    await page.screenshot({ path: output + "/desktop-result.png" });
    await page.emulateMedia({ media: "print" }); assert.equal(await page.locator(".topbar").isVisible(), false); assert.equal(await page.locator(".footer").isVisible(), false);
    await page.pdf({ path: output + "/comparison-record.pdf", format: "A4", printBackground: true }); await page.emulateMedia({ media: "screen" });
    await page.emulateMedia({ media: "print" });
    const printBody = page.locator(".company-tool-document tbody");
    await printBody.evaluate(el => { for (let i = 0; i < 100; i++) { const row = document.createElement("tr"), cell = document.createElement("td"), pre = document.createElement("pre"); row.className = "qa-pagination-row"; pre.textContent = `Synthetic long observation ${i + 1} for checking repeated company headers and page numbers.`; cell.append(pre); row.append(cell); el.append(row); } });
    await page.pdf({ path: output + "/multipage-check.pdf", format: "A4", printBackground: true });
    await printBody.locator(".qa-pagination-row").evaluateAll(rows => rows.forEach(row => row.remove()));
    await page.emulateMedia({ media: "screen" });
    await page.getByLabel("Reveal identities and include them in this record", { exact: true }).check();
    assert.ok((await record.inputValue()).includes(secret));
    await page.getByRole("button", { name: "Edit observations", exact: true }).click();
    assert.equal(await page.getByText("4 / Good", { exact: true }).count(), 1);
    assert.ok(!(await page.locator("#sample-workspace").innerText()).includes(secret));
    await page.getByText("2 / Fair", { exact: true }).click(); await page.getByRole("button", { name: "Next sample", exact: true }).click(); await page.getByRole("button", { name: "Review my comparison", exact: true }).click();
    assert.ok((await record.inputValue()).includes("Overall fit: 2 / Fair"));
    page.once("dialog", d => d.dismiss()); await page.getByRole("button", { name: "Start revised round", exact: true }).click(); assert.equal(await record.count(), 1);
    page.once("dialog", d => d.accept()); await page.getByRole("button", { name: "Start revised round", exact: true }).click();
    assert.equal(await page.getByRole("textbox", { name: "Project / comparison round", exact: true }).inputValue(), "QA round");
    assert.equal(await record.count(), 0);
    await page.getByRole("button", { name: "Create the sample code key", exact: true }).click();
    await page.getByRole("button", { name: "Open coded tasting sheet", exact: true }).click();
    await page.getByText("4 / Good", { exact: true }).waitFor();
    assert.equal(await page.locator(".oem-form input:checked").count(), 0);
    page.once("dialog", d => d.accept()); await page.getByRole("button", { name: "Reset", exact: true }).click();
    assert.equal(await page.getByRole("textbox", { name: "Project / comparison round", exact: true }).inputValue(), "");
    results.push({ case: "coded_view_company_key_pdf_feedback_reveal_copy_pdf_edit_revised_round_reset", passed: true }); await context.close();
  }
  for (const width of [320, 390, 768]) {
    const { page, context } = await start(width);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await setup(page, false); await evaluate(page, false);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    if (width === 390) { await page.locator(".sample-results").scrollIntoViewIfNeeded(); await page.screenshot({ path: output + "/mobile-result.png" }); }
    results.push({ case: "mobile_comparison_no_optional_metrics", width, passed: true }); await context.close();
  }
  {
    const { page, context } = await start(390);
    await page.getByRole("button", { name: "Create the sample code key", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: "Open coded tasting sheet", exact: true }).count(), 0);
    assert.ok(await page.getByText("Enter the actual context for this comparison.", { exact: true }).count() > 0);
    results.push({ case: "missing_context_blocks_code_key", passed: true }); await context.close();
  }
  assert.deepEqual(errors, []); assert.deepEqual(leaks, []);
  await writeFile(output + "/result.json", JSON.stringify({ base, browser: "headless Chromium", browser_path: "Browser plugin absent; user disallows desktop control", results, page_errors: errors, sample_value_network_leaks: leaks }, null, 2) + "\n");
  console.log(JSON.stringify({ passed: results.length, output, errors, leaks }));
} finally { await browser.close(); }
