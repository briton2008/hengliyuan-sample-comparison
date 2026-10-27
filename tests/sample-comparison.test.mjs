import test from "node:test";
import assert from "node:assert/strict";
import { createSampleSession, sampleEvaluationComplete, sampleEvaluationQuestions, sampleKeyText, sampleMetrics, sampleQuestionName, sampleReportText, sampleRows, sampleSetupQuestions, validateSampleSetup } from "../src/sample-comparison-model.mjs";
const data = { project: "Round 2", evaluator: "E01", application: "Test base", target: "Target reference", conditions: "Customer's actual dose and preparation", priority: "Reduce bitterness", samples: [{ reference: "SECRET-VERSION-ONE", batch: "PRIVATE-BATCH-A" }, { reference: "SECRET-VERSION-TWO" }], metrics: ["sweetness", "bitterness"] };
const session = () => createSampleSession(data, () => .25);
const answers = s => Object.fromEntries(s.samples.flatMap(x => [[sampleQuestionName(x.code, "fit"), 4], [sampleQuestionName(x.code, "sweetness"), 0], [sampleQuestionName(x.code, "bitterness"), 0]]));
test("setup requires actual context and sample references while allowing same-version batch or repeat comparisons", () => {
  assert.equal(validateSampleSetup(data).length, 0);
  for (const value of [{}, { ...data, samples: "bad" }, { ...data, application: " " }, { ...data, samples: [{ reference: "" }, { reference: "X" }] }, { ...data, samples: Array(7).fill({ reference: "X" }) }, { ...data, metrics: ["fake"] }, { ...data, metrics: ["cooling", "cooling"] }]) assert.ok(validateSampleSetup(value).length);
  const repeated = { ...data, samples: [{ reference: "Same version", batch: "Batch A" }, { reference: "Same version", batch: "Batch B" }] };
  assert.equal(validateSampleSetup(repeated).length, 0);
  assert.equal(new Set(createSampleSession(repeated, () => .25).samples.map(s => s.code)).size, 2);
});
test("one round gets distinct three-digit codes and a shuffled order without mutating setup", () => {
  const s = session(); assert.equal(new Set(s.samples.map(x => x.code)).size, 2); assert.ok(s.samples.every(x => /^\d{3}$/.test(x.code)));
  assert.notEqual(s.samples[0].reference, data.samples[0].reference); assert.equal(data.samples[0].reference, "SECRET-VERSION-ONE");
  assert.throws(() => createSampleSession(data, () => -1)); assert.throws(() => createSampleSession(data, () => 1));
});
test("coded evaluation schema excludes organizer identities and does not prefill any ratings", () => {
  const s = session(), q = sampleEvaluationQuestions(s), json = JSON.stringify(q);
  for (const ref of ["SECRET-VERSION-ONE", "SECRET-VERSION-TWO", "PRIVATE-BATCH-A"]) assert.ok(!json.includes(ref));
  assert.ok(!JSON.stringify(sampleSetupQuestions).includes('"defaultValue"')); assert.ok(!json.includes('"defaultValue"')); assert.equal(q.pages.length, 2);
  assert.ok(sampleKeyText(s).includes("SECRET-VERSION-ONE"));
});
test("intensity zero and target equality remain observations, while omitted entries are not zero", () => {
  const s = session(), a = answers(s), rows = sampleRows(s, a);
  assert.equal(rows[0].observations[1].label, "About target"); assert.equal(rows[0].observations[2].label, "None");
  delete a[sampleQuestionName(s.samples[0].code, "bitterness")]; assert.equal(sampleRows(s, a)[0].observations[2].label, "Not recorded"); assert.ok(sampleEvaluationComplete(s, a));
});
test("incomplete overall fit and out-of-scale observations block a finished record", () => {
  const s = session(); assert.equal(sampleReportText(s, {}), null);
  for (const value of [0, 6, "4", NaN]) { const a = answers(s); a[sampleQuestionName(s.samples[0].code, "fit")] = value; assert.equal(sampleReportText(s, a), null); }
  const a = answers(s); a[sampleQuestionName(s.samples[0].code, "bitterness")] = 5; assert.equal(sampleReportText(s, a), null);
});
test("report is coded by default, reveal is explicit, and feedback remains a discussion request", () => {
  const s = session(), a = answers(s), f = { closest: `Sample ${s.samples[0].code}`, next: "Discuss a revised sample", adjust: "Less bitterness", keep: "Current sweetness" };
  const coded = sampleReportText(s, a, f); assert.ok(!coded.includes("SECRET-VERSION")); assert.ok(!coded.includes("PRIVATE-BATCH"));
  for (const text of ["Not a laboratory", "Overall fit: 4 / Good", "No scores have been combined", "Current sweetness", f.closest]) { if (text === "Not a laboratory") assert.ok(coded.includes("not a laboratory report")); else assert.ok(coded.includes(text)); }
  assert.ok(sampleReportText(s, a, f, true).includes("SECRET-VERSION-ONE")); assert.ok(sampleReportText(s, a, f, true).includes("PRIVATE-BATCH-A"));
});
test("rating dimensions keep their own meanings without an average or winner calculation", () => {
  assert.equal(sampleMetrics.sweetness.choices.find(c => c.value === 0).text, "About target");
  assert.equal(sampleMetrics.cooling.choices[0].text, "None"); assert.equal(sampleMetrics.texture.choices[0].value, 1);
  const s = createSampleSession({ ...data, metrics: [] }, () => .25); assert.ok(sampleEvaluationComplete(s, answers(s))); assert.equal(sampleRows(s, answers(s))[0].observations.length, 1);
});
