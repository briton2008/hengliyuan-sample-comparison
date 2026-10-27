import React, { useMemo, useRef, useState } from "react";
import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import { ArrowRight, Check, Clipboard, Eye, FlaskConical, Printer, RotateCcw } from "lucide-react";
import "survey-core/survey-core.fontless.min.css";
import "./oem-configurator.css";
import "./sample-comparison.css";
import CompanyToolDocument from "./company-tool-document.jsx";
import { cleanSampleText, createSampleSession, sampleDescription, sampleEvaluationComplete, sampleEvaluationQuestions, sampleFaqs, sampleKeyText, sampleReportText, sampleRows, sampleSetupQuestions, sampleTitle, validateSampleSetup } from "./sample-comparison-model.mjs";

function makeSurvey(questions) {
  const model = new Model(questions);
  model.applyTheme({ cssVariables: { "--sjs-primary-backcolor": "#237247", "--sjs-primary-backcolor-dark": "#174a31", "--sjs-primary-forecolor": "#fff", "--sjs-general-backcolor": "#fff", "--sjs-general-backcolor-dim": "#fff", "--sjs-corner-radius": "8px", "--sjs-font-family": "inherit", "--sjs-base-unit": "8px" } });
  model.onCurrentPageChanged.add(() => document.getElementById("sample-workspace")?.scrollIntoView({ block: "start" }));
  return model;
}
export default function SampleComparison({ onInquiry }) {
  const [phase, setPhase] = useState("setup"), [session, setSession] = useState(null), [answers, setAnswers] = useState({});
  const [followup, setFollowup] = useState({}), [reveal, setReveal] = useState(false), [status, setStatus] = useState("");
  const workspace = useRef(null);
  function go(next) { setPhase(next); setStatus(""); requestAnimationFrame(() => { workspace.current?.scrollIntoView({ block: "start" }); workspace.current?.focus({ preventScroll: true }); }); }
  const setupModel = useMemo(() => {
    const model = makeSurvey(sampleSetupQuestions);
    model.onValidateQuestion.add((_, o) => {
      if (o.question.isRequired && o.question.getType() !== "paneldynamic" && !cleanSampleText(o.value)) o.error = "Enter the actual context for this comparison.";
    });
    model.onCompleting.add((_, o) => { const errors = validateSampleSetup(model.data); if (errors.length) { o.allowComplete = false; setStatus(errors.join(" ")); } });
    model.onComplete.add(() => { setSession(createSampleSession(model.data)); setAnswers({}); setFollowup({}); setReveal(false); go("key"); });
    return model;
  }, []);
  const evaluationModel = useMemo(() => {
    if (!session) return null;
    const model = makeSurvey(sampleEvaluationQuestions(session));
    model.onValueChanged.add(() => setAnswers(structuredClone(model.data)));
    model.onCompleting.add((_, o) => { if (!sampleEvaluationComplete(session, model.data)) { o.allowComplete = false; setStatus("Record overall fit for every sample and check the selected observations."); } });
    model.onComplete.add(() => { setAnswers(structuredClone(model.data)); go("result"); });
    return model;
  }, [session]);
  const report = session && phase === "result" ? sampleReportText(session, answers, followup, reveal) : null;
  function editSetup() {
    if (Object.keys(answers).length && !window.confirm("Start a new round? Current observations will be cleared. Save the record first.")) return;
    setupModel.clear(false); setSession(null); setAnswers({}); setFollowup({}); setReveal(false); go("setup");
  }
  function reset() {
    if ((session || Object.keys(setupModel.data).length) && !window.confirm("Clear this worksheet? Download any record and code key you need first.")) return;
    setupModel.clear(); setSession(null); setAnswers({}); setFollowup({}); setReveal(false); go("setup");
  }
  async function copy() {
    try { await navigator.clipboard.writeText(report); setStatus("Record copied. Review the code key before sharing sample identities."); }
    catch { setStatus("Copy is unavailable. Select the record below and copy it manually."); }
  }
  return <div className="sweetener-tools-page oem-page sample-page" lang="en" dir="ltr">
    <div className="blend-container">
      <nav className="blend-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/tools/">Tools</a><span>/</span><span aria-current="page">Sample comparison</span></nav>
      <header className="sample-hero"><div><p className="blend-eyebrow">HENGLIYUAN / SAMPLE WORKSHEET</p><h1>{sampleTitle}.</h1><p>Same question. Clearer feedback.<br />Keep the sample version and test conditions with your observations.</p></div><p className="oem-privacy"><Check size={16} aria-hidden="true" /> Free to use · No login<br /><span>Save your record before closing.</span></p></header>
      <div className="oem-intro"><FlaskConical size={23} aria-hidden="true" /><p>{sampleDescription} One evaluator and one round per sheet. The completed record supports a sample discussion; production approval remains separate.</p></div>
      <noscript><p>Enable JavaScript to create codes and enter observations. The method and questions below remain available.</p></noscript>
      <div id="sample-workspace" className="oem-workspace sample-workspace" ref={workspace} tabIndex={-1}>
        <section className="oem-form">
          <div className="oem-form-toolbar"><span>{({ setup: "01 / PREPARE THE ROUND", key: "02 / PREPARER'S CODE KEY", evaluate: "03 / CODED OBSERVATIONS", result: "04 / REVIEW & NEXT DISCUSSION" })[phase]}</span><button className="blend-text-button" onClick={reset}><RotateCcw size={15} aria-hidden="true" /> Reset</button></div>
          {phase === "setup" && <Survey model={setupModel} />}
          {phase === "key" && <div className="sample-content">
            <p className="blend-eyebrow">FOR THE PREPARER</p><h2>Label the samples. Keep the key separate.</h2>
            <p>Use the codes and presentation order below. Save this key before handing the coded sheet to the evaluator. If you prepared the samples, you already know their identities.</p>
            <ol className="sample-key">{session.samples.map(s => <li key={s.code}><strong>Code {s.code}</strong><span>{s.reference}</span><small>Batch / preparation: {s.batch || "Not recorded"}</small></li>)}</ol>
            <div className="oem-actions"><button onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> Print / save code key PDF</button><button onClick={editSetup}>Edit setup</button></div>
            <p className="sample-note">Check that the shared application, target, conditions and priority do not identify the samples. The mapping remains in this page's memory; this is not a secure multi-user blinding system.</p>
            <button className="oem-contact" onClick={() => go("evaluate")}>Open coded tasting sheet <ArrowRight size={17} aria-hidden="true" /></button>
          </div>}
          {phase === "evaluate" && <Survey model={evaluationModel} />}
          {phase === "result" && <div className="sample-content">
            <p className="blend-eyebrow">YOUR OBSERVATIONS</p><h2>What changed between samples?</h2><p>Read each observation against your own target. There is no combined score, automatic winner or pass threshold.</p>
            <div className="sample-results">{sampleRows(session, answers).map((row, i) => <article className="sample-result" key={row.code}><h3>Sample {row.code}</h3>{reveal && <p className="sample-identity">{session.samples[i].reference}<br />Batch / preparation: {session.samples[i].batch || "Not recorded"}</p>}<dl>{row.observations.map(o => <div key={o.key}><dt>{o.title}</dt><dd>{o.label}</dd></div>)}</dl><p className="sample-observation">{row.notes || "No additional notes recorded."}</p></article>)}</div>
            <label className="sample-reveal"><input type="checkbox" checked={reveal} onChange={e => setReveal(e.target.checked)} /><Eye size={17} aria-hidden="true" /><span>Reveal identities and include them in this record</span></label>
            <div className="oem-actions"><button onClick={() => { evaluationModel.clear(false); go("evaluate"); }}>Edit observations</button><button onClick={editSetup}>Start revised round</button></div>
          </div>}
        </section>
        <aside className="oem-summary sample-summary">
          <p className="blend-eyebrow">{phase === "result" ? "A USEFUL NEXT CONVERSATION" : "THE COMPARISON BASIS"}</p>
          <h2>{phase === "setup" ? "Start with the actual application." : phase === "result" ? "Say what to adjust first." : "Keep the basis in view."}</h2>
          {session ? <dl className="sample-context">{[["Application / base", session.setup.application], ["Reference / target", session.setup.target], ["Conditions", session.setup.conditions], ["First priority", session.setup.priority]].map(([title, value]) => <div key={title}><dt>{title}</dt><dd>{value}</dd></div>)}</dl> : <><p className="oem-summary-note">Record the sample versions and the conditions you will actually use. Choose only observations relevant to this round.</p><ol className="sample-steps"><li>Set the application and target.</li><li>Prepare coded samples.</li><li>Record one evaluator's observations.</li><li>Save feedback for the next discussion.</li></ol></>}
          {phase === "result" && <>
            <label className="sample-field">Closest to target<select aria-label="Closest to target" value={followup.closest || ""} onChange={e => setFollowup({ ...followup, closest: e.target.value })}><option value="">Choose when ready</option>{session.samples.map(s => <option key={s.code}>Sample {s.code}</option>)}<option>No clear preference</option><option>Not ready to choose</option></select></label>
            <label className="sample-field">Requested next step<select aria-label="Requested next step" value={followup.next || ""} onChange={e => setFollowup({ ...followup, next: e.target.value })}><option value="">Choose when ready</option>{["Retest the same samples", "Discuss a revised sample", "Discuss a quotation against a reviewed reference", "Continue evaluation before deciding"].map(v => <option key={v}>{v}</option>)}</select></label>
            <label className="sample-field">Adjust first<textarea rows={2} maxLength={1500} value={followup.adjust || ""} onChange={e => setFollowup({ ...followup, adjust: e.target.value })} /></label>
            <label className="sample-field">Keep unchanged<textarea rows={2} maxLength={1500} value={followup.keep || ""} onChange={e => setFollowup({ ...followup, keep: e.target.value })} /></label>
            <div className="oem-actions"><button onClick={copy}><Clipboard size={16} aria-hidden="true" /> Copy record</button><button onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> Print / save company PDF</button></div>
            <label className="oem-brief-label">Your complete comparison record<textarea readOnly value={report || ""} rows={10} /></label>
            <button className="oem-contact" onClick={() => onInquiry?.("Sweetener sample comparison discussion")}>Discuss the next sample <ArrowRight size={17} aria-hidden="true" /></button><p className="sample-note">Copy the record or save its PDF first, then add it to your message. Nothing has been submitted.</p>
          </>}
          <p role="status" className="oem-status">{status}</p>
          {phase !== "result" && <p className="sample-note">No sample identity is shown in the coded tasting questions. Blank optional observations remain “Not recorded”.</p>}
        </aside>
      </div>
      <section className="oem-review"><div><p className="blend-eyebrow">FROM TRIAL TO REVISION</p><h2>Keep the version with the feedback.</h2><p>Use the same record when discussing which sample is closest to the target, what should change first and what should remain unchanged. Keep separate sheets for repeats and other evaluators.</p><a href="/tools/oem-product-configurator/">Prepare an OEM project brief <ArrowRight size={17} aria-hidden="true" /></a></div><ol><li>Record the actual dose, base, preparation and serving conditions.</li><li>Save the code key separately; use codes in the tasting view.</li><li>Describe differences and the first adjustment to discuss.</li><li>Confirm the exact sample version and evaluation scope before commercial review.</li></ol></section>
      <section className="oem-method"><h2>How to read the worksheet</h2><p>Overall fit is your own 1–5 assessment against the target you wrote. Optional observations use their own labeled scales: intensity describes how strong a sensation is, while sweetness describes its difference from your target. These dimensions are not added together or ranked automatically.</p><p>This worksheet does not verify a formula, nutrition claim, shelf life or finished-product specification. It records one person's observations under the stated conditions. Refreshing or closing the page clears the entries, so save the report and code key you need.</p></section>
      <section className="blend-faq"><p className="blend-eyebrow">USEFUL ANSWERS</p><h2>Before the next round.</h2>{sampleFaqs.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</section>
      <p className="blend-source-note">Built with the <a href="https://github.com/surveyjs/survey-library" target="_blank" rel="noreferrer">SurveyJS Form Library</a> under the <a href="/licenses/surveyjs-form-library-MIT.txt">MIT license</a>.</p>
    </div>
    {report && <CompanyToolDocument title="SAMPLE COMPARISON RECORD" category="SAMPLE EVALUATION" text={report} />}
    {phase === "key" && <CompanyToolDocument title="SAMPLE CODE KEY" category="SAMPLE EVALUATION" privateKey text={sampleKeyText(session)} />}
  </div>;
}
