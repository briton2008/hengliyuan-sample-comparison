export const samplePath = "/tools/sweetener-sample-comparison/";
export const sampleTitle = "Sweetener sample comparison";
export const sampleDescription = "Record sweetener sample feedback in your actual application. Create coded tasting sheets, compare observations and prepare a revision brief without signing in.";
const intensity = ["None", "Slight", "Moderate", "Strong", "Very strong"].map((text, value) => ({ value, text }));
export const fitScale = ["Poor", "Fair", "Acceptable", "Good", "Very good"].map((text, i) => ({ value: i + 1, text: `${i + 1} / ${text}` }));
export const sampleMetrics = {
  sweetness: { title: "Sweetness compared with your target", choices: ["Much less", "Slightly less", "About target", "Slightly more", "Much more"].map((text, i) => ({ value: i - 2, text })) },
  bitterness: { title: "Bitterness intensity", choices: intensity },
  lingering: { title: "Lingering taste intensity", choices: intensity },
  cooling: { title: "Cooling sensation intensity", choices: intensity },
  dissolution: { title: "Dissolution fit for your application", choices: fitScale },
  texture: { title: "Texture / mouthfeel fit for your application", choices: fitScale }
};
export const cleanSampleText = v => typeof v === "string" ? v.trim().slice(0, 1500) : "";
export const sampleSetupQuestions = {
  showTitle: false, showQuestionNumbers: "off", showCompletedPage: false, focusFirstQuestionAutomatic: false,
  completeText: "Create the sample code key", pages: [{ name: "setup", elements: [
    { type: "text", name: "project", title: "Project / comparison round", maxLength: 120 },
    { type: "text", name: "evaluator", title: "Evaluator code", maxLength: 80, description: "Use an anonymous reference. This sheet records one evaluator in one round." },
    { type: "text", inputType: "date", name: "date", title: "Test date" },
    { type: "text", name: "application", title: "Actual application / base", isRequired: true, maxLength: 250, description: "Name the product or base being tested." },
    { type: "comment", name: "target", title: "Reference and target", isRequired: true, rows: 2, maxLength: 1000, description: "Describe the reference or desired result. State whether a 1:1 target means sweetness, weight or volume. For coded tasting, keep sample identities out of shared context fields." },
    { type: "comment", name: "conditions", title: "Preparation and comparison conditions", isRequired: true, rows: 3, maxLength: 1500, description: "Record actual sample dose, base quantity and units, preparation, serving conditions and observation time. Keep the comparison basis consistent, or record differences for each sample." },
    { type: "text", name: "priority", title: "What should be improved first?", isRequired: true, maxLength: 250 },
    { type: "paneldynamic", name: "samples", title: "Samples in this round", description: "Use the exact sample or version reference from your label. These identities are hidden in the coded tasting view.", minPanelCount: 2, maxPanelCount: 6, panelCount: 2, panelAddText: "Add a sample", panelRemoveText: "Remove sample", templateTitle: "Sample {panelIndex}", templateElements: [
      { type: "text", name: "reference", title: "Sample / version reference", isRequired: true, maxLength: 150 },
      { type: "text", name: "batch", title: "Batch or preparation reference, if known", maxLength: 150 }
    ] },
    { type: "checkbox", name: "metrics", title: "Additional observations to record", description: "Optional. Overall fit and a comment are available for every sample. No answers are preselected.", choices: Object.entries(sampleMetrics).map(([value, metric]) => ({ value, text: metric.title })) }
  ] }]
};

export function validateSampleSetup(data = {}) {
  const errors = [];
  for (const key of ["application", "target", "conditions", "priority"]) if (!cleanSampleText(data[key])) errors.push("Complete the application, target, conditions and first priority.");
  if (!Array.isArray(data.samples) || data.samples.length < 2 || data.samples.length > 6) errors.push("Use two to six samples in one comparison round.");
  const refs = (Array.isArray(data.samples) ? data.samples : []).map(s => cleanSampleText(s?.reference).toLocaleLowerCase("en"));
  if (refs.some(r => !r)) errors.push("Enter the sample or version reference for each entry.");
  if (data.metrics !== undefined && (!Array.isArray(data.metrics) || data.metrics.some(key => !sampleMetrics[key]) || new Set(data.metrics).size !== data.metrics.length)) errors.push("Choose observations from the available list.");
  return [...new Set(errors)];
}

export function createSampleSession(data, random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296) {
  if (validateSampleSetup(data).length) throw new Error("Incomplete sample setup");
  const pool = Array.from({ length: 900 }, (_, i) => String(i + 100));
  const draw = n => { const value = random(); if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error("Invalid random source"); return Math.floor(value * n); };
  const samples = data.samples.map(s => ({ reference: cleanSampleText(s.reference), batch: cleanSampleText(s.batch), code: pool.splice(draw(pool.length), 1)[0] }));
  for (let i = samples.length - 1; i > 0; i--) { const j = draw(i + 1); [samples[i], samples[j]] = [samples[j], samples[i]]; }
  const setup = Object.fromEntries(["project", "evaluator", "date", "application", "target", "conditions", "priority"].map(key => [key, cleanSampleText(data[key])]));
  return { setup, samples, metrics: [...(data.metrics || [])] };
}

export const sampleQuestionName = (code, metric) => `sample_${code}_${metric}`;
export function sampleEvaluationQuestions(session) {
  return { showTitle: false, showQuestionNumbers: "off", showProgressBar: "top", progressBarType: "pages", showCompletedPage: false, focusFirstQuestionAutomatic: false, pageNextText: "Next sample", pagePrevText: "Previous sample", completeText: "Review my comparison", pages: session.samples.map((sample, i) => ({ name: `code_${sample.code}`, title: `Sample ${sample.code} / ${i + 1} of ${session.samples.length}`, elements: [
    { type: "radiogroup", name: sampleQuestionName(sample.code, "fit"), title: "Overall fit for your stated target", isRequired: true, choices: fitScale, description: "Your own assessment in this application. The scale is a worksheet convention, not a laboratory method or a pass threshold." },
    ...session.metrics.map(key => ({ type: "radiogroup", name: sampleQuestionName(sample.code, key), title: sampleMetrics[key].title, choices: sampleMetrics[key].choices, description: "Optional. Leave blank if not evaluated." })),
    { type: "comment", name: sampleQuestionName(sample.code, "notes"), title: "Observations / differences in test conditions", rows: 3, maxLength: 1500 }
  ] })) };
}
export function sampleRows(session, answers = {}) {
  return session.samples.map(s => ({ code: s.code, observations: [
    { key: "fit", title: "Overall fit", value: answers[sampleQuestionName(s.code, "fit")], choices: fitScale },
    ...session.metrics.map(key => ({ key, title: sampleMetrics[key].title, value: answers[sampleQuestionName(s.code, key)], choices: sampleMetrics[key].choices }))
  ].map(o => ({ ...o, label: o.choices.find(c => c.value === o.value)?.text ?? "Not recorded", invalid: o.value !== undefined && o.value !== null && o.value !== "" && !o.choices.some(c => c.value === o.value) })), notes: cleanSampleText(answers[sampleQuestionName(s.code, "notes")]) }));
}
export function sampleEvaluationComplete(session, answers) {
  const rows = sampleRows(session, answers);
  return rows.every(row => row.observations[0].label !== "Not recorded" && row.observations.every(o => !o.invalid));
}
export function sampleKeyText(session) {
  return ["HENGLIYUAN — PREPARER'S SAMPLE CODE KEY", "Keep this key away from the evaluator until observations are complete. This is a local worksheet, not a secure multi-user blinding system.", `Round: ${session.setup.project || "Not named"}`, ...session.samples.map((s, i) => `${i + 1}. Code ${s.code}: ${s.reference}; batch/preparation: ${s.batch || "Not recorded"}`)].join("\n");
}
export function sampleReportText(session, answers, followup = {}, reveal = false) {
  if (!sampleEvaluationComplete(session, answers)) return null;
  const lines = ["HENGLIYUAN — SAMPLE COMPARISON RECORD", "One evaluator / one round. Customer-entered observations, not a laboratory report or production approval.", ""];
  for (const [key, title] of [["project", "Round"], ["evaluator", "Evaluator code"], ["date", "Test date"], ["application", "Application / base"], ["target", "Reference / target"], ["conditions", "Conditions"], ["priority", "First priority"]]) lines.push(`${title}: ${session.setup[key] || "Not recorded"}`);
  lines.push("", "OBSERVATIONS IN PRESENTATION ORDER");
  for (const [i, row] of sampleRows(session, answers).entries()) {
    lines.push("", `${i + 1}. Sample ${row.code}`);
    if (reveal) { const s = session.samples[i]; lines.push(`Reference: ${s.reference}; batch/preparation: ${s.batch || "Not recorded"}`); }
    for (const observation of row.observations) lines.push(`${observation.title}: ${observation.label}`);
    lines.push(`Notes: ${row.notes || "Not recorded"}`);
  }
  lines.push("", "NEXT DISCUSSION", `Closest to target (evaluator's choice): ${cleanSampleText(followup.closest) || "Not chosen"}`, `Requested next step: ${cleanSampleText(followup.next) || "To discuss"}`, `Adjust first: ${cleanSampleText(followup.adjust) || "To discuss"}`, `Keep unchanged: ${cleanSampleText(followup.keep) || "To discuss"}`, "", reveal ? "Sample identities included at the user's request." : "Sample identities withheld. Match codes against the preparer's separate key when ready.", "No scores have been combined, averaged or converted into pass/fail. A sample preference does not approve a production specification. Confirm the exact version and evaluation scope before commercial review.", "No data has been submitted. Copy or download this record before closing; refreshing clears the page.");
  return lines.join("\n");
}

export const sampleFaqs = [
  ["What should I record before tasting?", "Use the actual application or base, sample versions, reference target and first improvement priority. Record the dose with units, base quantity, preparation and serving conditions, and observation time. The worksheet does not prescribe a universal dose or test method."],
  ["How does the coded view work?", "A preparer enters sample identities, receives unique three-digit codes and a shuffled presentation order, then labels the samples. Save the separate code key before opening the evaluator view. Only codes appear in the tasting questions. The preparer should not act as an unaware evaluator; identities remain in the page's memory, so this is not secure multi-user blinding."],
  ["Do all samples need the same preparation?", "Use a consistent basis for the comparison you intend to make. If a sample needs different preparation, record that difference in its notes and consider whether the results still answer the same question. The tool does not correct for differences in dose, temperature, base or processing."],
  ["What do the scores mean?", "Overall fit runs from 1 (poor) to 5 (very good) against your own stated target. Optional bitterness, lingering taste and cooling observations describe intensity, not goodness. Sweetness is relative to your target. These are worksheet scales, not a validated sensory test or a statistical result."],
  ["Can several people use this as a panel test?", "Each sheet records one evaluator and one round. Keep separate records for other evaluators or repeats. This version does not pool panel data, balance presentation orders across a panel or calculate significance."],
  ["Does a preferred sample approve production?", "No. Use the record to discuss the closest sample, what to adjust first and what to keep unchanged. Formula and sample version, agreed evaluation scope, packaging, specifications and commercial terms need separate confirmation."],
  ["Where are my entries saved?", "Entries stay in the current page and clear on refresh. You can copy the record or use Print / save PDF to save the record and its separate code key in the company document layout. No login or contact information is required, and nothing is automatically sent to Hengliyuan."]
];
