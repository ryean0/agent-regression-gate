const RESULTS_URL = "results.json";

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function normalizeStatus(data) {
  const raw = String(data?.status ?? "").trim().toLowerCase();
  return raw === "final" ? "final" : "preliminary";
}

export function caseList(data) {
  if (Array.isArray(data?.cases)) return data.cases;
  if (Array.isArray(data)) return data;
  return [];
}

export function caseVerdict(item) {
  const raw = String(item?.verdict ?? item?.status ?? item?.outcome ?? "")
    .trim()
    .toLowerCase();
  if (["pass", "passed", "ok", "success"].includes(raw)) return "pass";
  if (["fail", "failed", "error", "regression"].includes(raw)) return "fail";
  if (["skip", "skipped"].includes(raw)) return "skip";
  return "unknown";
}

export function summarize(data) {
  const cases = caseList(data);
  const summary = data?.summary ?? {};
  const passed = Number.isFinite(summary.passed)
    ? summary.passed
    : cases.filter((item) => caseVerdict(item) === "pass").length;
  const failed = Number.isFinite(summary.failed)
    ? summary.failed
    : cases.filter((item) => caseVerdict(item) === "fail").length;
  const total = Number.isFinite(summary.cases) ? summary.cases : cases.length;
  const decision = String(data?.gate?.decision ?? (failed > 0 ? "fail" : "pass")).toLowerCase();
  return { cases: total, passed, failed, decision };
}

function formatDuration(ms) {
  if (!Number.isFinite(ms)) return "";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)} s`;
  return `${ms} ms`;
}

export function renderResults(data) {
  const status = normalizeStatus(data);
  const stats = summarize(data);
  const reason = data?.gate?.reason ? String(data.gate.reason) : "";
  const rows = caseList(data)
    .map((item) => {
      const verdict = caseVerdict(item);
      const label = verdict === "pass" ? "PASS" : verdict === "fail" ? "FAIL" : verdict === "skip" ? "SKIP" : "----";
      const detail = item?.detail
        ? `<span class="detail">${escapeHtml(item.detail)}</span>`
        : "";
      return `<li class="log-row ${verdict}">
        <span class="verdict ${verdict}">${label}</span>
        <span class="suite">${escapeHtml(item.suite ?? item.group ?? "")}</span>
        <span class="name">${escapeHtml(item.name ?? item.title ?? item.id ?? "case")}</span>
        <span class="time">${escapeHtml(formatDuration(Number(item.durationMs)))}</span>
        ${detail}
      </li>`;
    })
    .join("");

  const body = `<p class="prompt">$ gate check --suite pinned --out results.json<span class="caret" aria-hidden="true"></span></p>
    <p class="summary-line">status ${escapeHtml(status)} · decision ${escapeHtml(stats.decision.toUpperCase())} · cases ${stats.cases} · passed ${stats.passed} · failed ${stats.failed}</p>
    ${reason ? `<p class="reason">${escapeHtml(reason)}</p>` : ""}
    <ol class="log">${rows}</ol>
    <p class="exit">gate exited ${stats.decision === "pass" ? "0" : "1"}</p>`;

  return { status, stats, body };
}

function paint(data) {
  const view = renderResults(data);
  const badge = document.querySelector("#status-badge");
  const heroStatus = document.querySelector("#hero-status");
  const body = document.querySelector("#console-body");
  const cases = document.querySelector("#stat-cases");
  const passed = document.querySelector("#stat-passed");
  const gate = document.querySelector("#stat-gate");
  const label = view.status === "final" ? "Final" : "Preliminary";
  if (badge) {
    badge.textContent = label;
    badge.classList.toggle("final", view.status === "final");
  }
  if (heroStatus) heroStatus.textContent = `${label} run`;
  if (cases) cases.textContent = String(view.stats.cases);
  if (passed) passed.textContent = String(view.stats.passed);
  if (gate) {
    gate.textContent = view.stats.decision.toUpperCase();
    gate.classList.toggle("fail", view.stats.decision !== "pass");
  }
  if (body) body.innerHTML = view.body;
}

if (typeof document !== "undefined") {
  fetch(RESULTS_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(paint)
    .catch(() => {
      const body = document.querySelector("#console-body");
      const badge = document.querySelector("#status-badge");
      if (badge) badge.textContent = "Unavailable";
      if (body) {
        body.innerHTML =
          '<p class="error">Could not read results.json. Replace the sample file and reload.</p>';
      }
    });
}
