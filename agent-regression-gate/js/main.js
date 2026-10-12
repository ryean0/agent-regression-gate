import { CANDIDATES, SCENARIO_SETS, buildRun } from "./demo-data.js";
import { parseResults } from "./results.js";
import { METHOD_NOTES, armMissExceeds, formatPercent, formatPoints, formatSignedNumber, scoreRun } from "./verdict.js";

const EMAIL = "ryanphua.dev@outlook.com";
const SLOT_LABEL = {
  pass: "Pass",
  fail: "Fail",
  agent_timeout: "Step-budget timeout, scored 0",
  infra_timeout: "Infrastructure timeout, excluded",
  missing: "Missing result, excluded",
};

function asset(path) {
  const base = document.documentElement.dataset.base || "./";
  return new URL(path, new URL(base, window.location.href)).href;
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value === true) node.setAttribute(key, "");
    else if (value !== false && value != null) node.setAttribute(key, String(value));
  }
  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function initChrome() {
  const nav = document.getElementById("nav");
  const toggle = document.getElementById("nav-toggle");
  const menu = document.getElementById("nav-menu");
  const progress = document.getElementById("progress");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canAnimate = !reduceMotion && typeof IntersectionObserver === "function";
  if (canAnimate) document.documentElement.classList.add("motion");
  const flow = document.querySelector(".flow");
  const trust = document.querySelector(".trust-stage");
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
      nav.classList.toggle("is-scrolled", window.scrollY > 8);
      if (!reduceMotion && canAnimate && flow) {
        const rect = flow.getBoundingClientRect();
        const view = window.innerHeight;
        const drawn = Math.min(1, Math.max(0, (view * 0.9 - rect.top) / (view * 0.38)));
        flow.style.setProperty("--draw", drawn.toFixed(3));
        flow.dataset.step = String(Math.min(4, Math.floor(drawn * 5)));
      }
      if (!reduceMotion && trust && trust.offsetHeight > window.innerHeight + 80) {
        const start = trust.getBoundingClientRect().top + window.scrollY;
        const span = trust.offsetHeight - window.innerHeight;
        const progressTrust = Math.min(1, Math.max(0, (window.scrollY - start) / span));
        trust.dataset.step = String(Math.min(3, Math.floor(progressTrust * 4)));
      }
    });
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  if (reduceMotion) {
    document.documentElement.classList.remove("motion");
    if (flow) {
      flow.classList.add("is-settled");
      flow.dataset.step = "4";
      flow.style.setProperty("--draw", "1");
    }
    if (trust) trust.dataset.step = "3";
    document.querySelectorAll(".reveal").forEach((node) => node.classList.add("is-in"));
  } else if (canAnimate) {
    const revealNodes = [...document.querySelectorAll(".reveal")];
    let sawObserver = false;
    let revealObserver;
    try {
      revealObserver = new IntersectionObserver((entries) => {
        sawObserver = true;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-in");
          revealObserver.unobserve(entry.target);
        }
      }, { threshold: 0.12, rootMargin: "0px 0px -4% 0px" });
    } catch {
      document.documentElement.classList.remove("motion");
      revealObserver = null;
    }
    if (revealObserver) {
      const revealVisible = () => {
        for (const node of revealNodes) {
          const rect = node.getBoundingClientRect();
          if (rect.bottom > 0 && rect.top < window.innerHeight) node.classList.add("is-in");
        }
      };
      revealNodes.forEach((node) => revealObserver.observe(node));
      revealVisible();
      window.addEventListener("scroll", revealVisible, { passive: true });
      window.setTimeout(() => {
        if (!sawObserver) {
          document.documentElement.classList.remove("motion");
          revealNodes.forEach((node) => node.classList.add("is-in"));
        }
      }, 1000);
    }
  }

  toggle.addEventListener("click", () => {
    const open = menu.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? "Close" : "Menu";
    if (open) menu.querySelector("a")?.focus();
  });
  menu.addEventListener("click", (event) => {
    if (event.target.closest("a, button")) {
      menu.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.textContent = "Menu";
    }
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu.classList.contains("is-open")) {
      menu.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.textContent = "Menu";
      toggle.focus();
    }
  });

  const sections = [...document.querySelectorAll("main section[id]")];
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    for (const link of menu.querySelectorAll("a[href^='#']")) {
      link.toggleAttribute("aria-current", link.getAttribute("href") === `#${visible.target.id}`);
      if (link.getAttribute("href") === `#${visible.target.id}`) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    }
  }, { rootMargin: "-45% 0px -45% 0px", threshold: [0.2, 0.5] });
  sections.forEach((section) => observer.observe(section));

  const placeTip = (button) => {
    const tip = button.parentElement.querySelector(".term-tip");
    const rect = button.getBoundingClientRect();
    const margin = 16;
    const width = Math.min(288, window.innerWidth - margin * 2);
    let left = rect.left;
    if (left + width > window.innerWidth - margin) left = window.innerWidth - margin - width;
    if (left < margin) left = margin;
    let top = rect.bottom + 8;
    if (top + 96 > window.innerHeight) top = Math.max(margin, rect.top - 8 - 96);
    tip.style.width = `${width}px`;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  };
  for (const term of document.querySelectorAll(".term")) {
    const button = term.querySelector("button");
    const place = () => placeTip(button);
    term.addEventListener("mouseenter", place);
    term.addEventListener("focusin", place);
    button.addEventListener("click", () => {
      const open = button.getAttribute("aria-expanded") === "true";
      for (const other of document.querySelectorAll(".term.is-open")) {
        if (other === term) continue;
        other.classList.remove("is-open");
        other.querySelector("button").setAttribute("aria-expanded", "false");
      }
      place();
      button.setAttribute("aria-expanded", String(!open));
      term.classList.toggle("is-open", !open);
    });
  }

  const dialog = document.getElementById("pilot");
  for (const button of document.querySelectorAll("[data-pilot]")) {
    button.addEventListener("click", () => dialog.showModal());
  }
  document.getElementById("pilot-cancel").addEventListener("click", () => dialog.close());
  document.getElementById("pilot-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = [
      `Name: ${String(data.get("name") || "").trim()}`,
      `Work email: ${String(data.get("email") || "").trim()}`,
      `Company: ${String(data.get("company") || "").trim()}`,
      "",
      String(data.get("note") || "").trim() || "We would like to pilot the CI Agent Regression Harness.",
    ].join("\n");
    window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent("Pilot: CI Agent Regression Harness")}&body=${encodeURIComponent(body)}`;
    document.getElementById("pilot-note").textContent = `If your email app did not open, write to ${EMAIL}.`;
  });
}

function renderBanner(banner) {
  const host = document.getElementById("status-banner");
  host.replaceChildren(el("div", { class: "banner", "data-tone": banner.tone, role: "status" }, [
    el("div", { class: "wrap banner-inner" }, [
      el("strong", {}, banner.title),
      el("span", {}, banner.body),
    ]),
  ]));
}

function missLine(counts) {
  return Object.entries(counts).map(([key, value]) => `${key} ${value}`).join(", ");
}

function renderResults(view) {
  renderBanner(view.banner);
  const root = document.getElementById("results-root");
  const armRows = [
    ["Scheduled rollouts", view.arms.baseline.scheduled, view.arms.candidate.scheduled],
    ["Environment misses", view.arms.baseline.environmentMisses, view.arms.candidate.environmentMisses],
    ["Miss counts", missLine(view.arms.baseline.missCounts), missLine(view.arms.candidate.missCounts)],
    ["Pass rate", view.arms.baseline.passRateText, view.arms.candidate.passRateText],
    ["Over the 5% miss line", view.arms.baseline.overMissLimit ? "Yes" : "No", view.arms.candidate.overMissLimit ? "Yes" : "No"],
  ];

  root.replaceChildren(el("div", { class: "panel" }, [
    el("p", { class: "kicker" }, "Suite check"),
    el("article", { class: "verdict", "data-verdict": view.verdict }, [
      el("p", { class: "kicker" }, view.status === "preliminary" ? "Preliminary" : "Final"),
      el("h3", {}, view.headline),
      el("p", { class: "why" }, view.why),
    ]),
    el("div", { class: "sheet sheet-head" }, [el("span", {}, "Recorded"), el("strong", {}, "Baseline"), el("strong", {}, "Candidate")]),
    ...armRows.map(([label, base, cand]) => el("div", { class: "sheet" }, [
      el("span", {}, label), el("strong", {}, String(base)), el("strong", {}, String(cand)),
    ])),
    el("p", { class: "fine" }, "Environment misses may equal 5% of scheduled rollouts. Above that, on either arm, is over the cap. The suite check is the file’s likely_regression field."),
    el("h3", { class: "block-title" }, "Scenario diagnostics"),
    el("table", { class: "diag" }, [
      el("caption", {}, "Diagnostics only. These rates do not pass or block a scenario."),
      el("thead", {}, el("tr", {}, [el("th", { scope: "col" }, "Scenario"), el("th", { scope: "col" }, "Baseline rate"), el("th", { scope: "col" }, "Candidate rate")])),
      el("tbody", {}, view.scenarios.map((row) => el("tr", {}, [
        el("th", { scope: "row" }, row.name),
        el("td", {}, row.baselineText),
        el("td", {}, row.candidateText),
      ]))),
    ]),
    el("div", { class: "charts" }, [renderChart(view.charts.mde), renderChart(view.charts.aa)]),
    view.summaryNote ? el("p", { class: "file-note" }, view.summaryNote) : null,
    el("p", { class: "file-note" }, [
      "Loaded from ",
      el("a", { href: asset("data/results.preliminary.json") }, "data/results.preliminary.json"),
      ". level 0.9.",
    ]),
  ]));
}

function renderChart(chart) {
  const body = chart.status === "coming_soon"
    ? el("div", { class: "chart-frame" }, "No series. This check is not in the file yet.")
    : chart.points.length
      ? mdeSvg(chart)
      : el("div", { class: "chart-frame" }, [
          el("p", {}, `${chart.yLabel || chart.title} · ${chart.xLabel || "rollout budget"}`),
          el("p", {}, "No series in this file."),
        ]);
  return el("figure", { class: "chart" }, [
    el("header", {}, [
      el("h3", {}, chart.title),
      el("span", { class: "pill", "data-status": chart.status }, chart.status === "coming_soon" ? "Coming soon" : chart.status),
    ]),
    body,
    el("figcaption", {}, chart.caption || "No caption in this results file."),
  ]);
}

function mdeSvg(chart) {
  const width = 520;
  const height = 220;
  const pad = 36;
  const budgets = chart.points.map((point) => point.budget);
  const maxBudget = Math.max(...budgets, 1);
  const coords = chart.points.map((point, index) => {
    const x = pad + (point.budget / maxBudget) * (width - pad * 2);
    const y = pad + index * 8;
    return `${x},${height - y}`;
  });
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `${chart.title}. ${chart.points.map((point) => `${point.budget} rollouts, drop ${point.dropText}`).join(". ")}`);
  svg.innerHTML = `<line x1="${pad}" y1="${height - pad}" x2="${width - 16}" y2="${height - pad}" stroke="#a1a1aa"/><line x1="${pad}" y1="16" x2="${pad}" y2="${height - pad}" stroke="#a1a1aa"/><polyline fill="none" stroke="#f4f4f5" stroke-width="1.5" points="${coords.join(" ")}"/>`;
  return el("div", { class: "chart-frame" }, svg);
}

function renderResultsError(error) {
  renderBanner({
    tone: "error",
    title: "Results file could not be read",
    body: error.message,
  });
  document.getElementById("results-root").replaceChildren(
    el("div", { class: "panel" }, [
      el("h3", {}, "The results file did not match version 1"),
      el("p", { class: "why" }, error.message),
    ]),
  );
}

function renderDemo() {
  const root = document.getElementById("demo-root");
  let setId = SCENARIO_SETS[0].id;
  let candidateId = "stable";
  let phase = "idle";
  let result = null;
  let input = null;
  let token = 0;
  const timers = [];

  const live = el("div", { "aria-live": "polite", "aria-atomic": "true" });
  const stage = el("div");
  const shell = el("div", { class: "console" }, [
    el("div", { class: "console-bar" }, [
      el("strong", {}, "Sample run"),
      el("span", {}, "Local configuration. Not results.json. Not a customer benchmark."),
    ]),
    el("div", { class: "console-body" }, [
      el("div", { class: "pickers" }, [
        fieldset("Suite", "scenario-set", SCENARIO_SETS, setId, (id) => { setId = id; reset(); paint(); }),
        fieldset("Configuration", "candidate", CANDIDATES, candidateId, (id) => { candidateId = id; reset(); paint(); }),
      ]),
      el("div", { class: "runbar" }, [
        el("button", { type: "button", class: "btn btn-primary", id: "run-btn", onclick: run }, "Run"),
        el("p", {}, "20 baseline · 5 candidate · paired by scenario"),
      ]),
      el("ul", { class: "legend" }, [
        legendItem("pass", "Pass"),
        legendItem("fail", "Fail"),
        legendItem("agent_timeout", "Step-budget timeout"),
        legendItem("infra_timeout", "Excluded"),
      ]),
    ]),
    stage,
    live,
    el("details", { class: "math" }, [
      el("summary", {}, "Scoring notes"),
      ...Object.values(METHOD_NOTES).map((text) => el("p", {}, text)),
    ]),
  ]);
  root.replaceChildren(shell);

  function fieldset(legend, name, options, current, onChange) {
    return el("fieldset", {}, [
      el("legend", {}, legend),
      el("div", { class: "choices" }, options.map((option) => el("label", { class: "choice" }, [
        el("input", {
          type: "radio",
          name,
          value: option.id,
          checked: option.id === current,
          onchange: () => onChange(option.id),
        }),
        el("span", { class: "choice-name" }, option.name),
        el("span", { class: "choice-summary" }, option.summary),
      ]))),
    ]);
  }

  function legendItem(kind, label) {
    return el("li", {}, [el("i", { class: "cell", "data-kind": kind, "aria-hidden": "true" }), label]);
  }

  function clearTimers() {
    while (timers.length) window.clearTimeout(timers.pop());
  }

  function reset() {
    token += 1;
    clearTimers();
    phase = "idle";
    result = null;
    input = null;
  }

  function run() {
    const mine = ++token;
    clearTimers();
    input = buildRun(setId, candidateId);
    result = scoreRun(input);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      phase = "done";
      paint();
      return;
    }
    phase = "running";
    paint();
    const fill = stage.querySelector(".timeline-fill");
    requestAnimationFrame(() => {
      if (token !== mine || !fill) return;
      fill.dataset.on = "1";
    });
    timers.push(window.setTimeout(() => {
      if (token !== mine) return;
      phase = "done";
      paint();
    }, 720));
  }

  function paint() {
    const button = document.getElementById("run-btn");
    if (button) {
      button.disabled = phase === "running";
      button.textContent = phase === "running" ? "Running" : phase === "done" ? "Run again" : "Run";
    }
    const set = SCENARIO_SETS.find((item) => item.id === setId);
    const show = phase !== "idle" && input && result;
    stage.replaceChildren(
      el("div", { class: "console-body" }, [
        timelineBlock(),
        show ? gridBlock(set) : el("p", { class: "fine" }, phase === "idle" ? "Select a configuration and run." : ""),
        show && phase === "done" ? rateBlock(result) : null,
        show && phase === "done" ? missBlock(result) : null,
      ].filter(Boolean)),
    );
    if (phase === "done" && result) live.replaceChildren(verdictCard(result));
    else if (phase === "running") live.replaceChildren(el("p", { class: "fine" }, "Run in progress."));
    else live.replaceChildren();
  }

  function timelineBlock() {
    return el("div", { class: "dash-block", style: "border-top:0;padding-top:0" }, [
      el("div", { class: "timeline-meta" }, [
        el("span", {}, "Run timeline"),
        el("span", { class: "mono" }, phase === "idle" ? "idle" : phase === "running" ? "scoring" : "complete"),
      ]),
      el("div", { class: "timeline-track", "aria-hidden": "true" }, el("i", {
        class: "timeline-fill",
        "data-on": phase === "done" ? "1" : "0",
      })),
    ]);
  }

  function gridBlock(set) {
    return el("div", { class: "dash-block" }, [
      el("h3", {}, "Rollouts"),
      ...set.scenarios.map((scenario) => {
        const raw = input.find((row) => row.id === scenario.id);
        const scored = result.scenarios.find((row) => row.id === scenario.id);
        const settled = phase === "done";
        return el("article", { class: "scenario" }, [
          el("h3", {}, scenario.name),
          el("p", { class: "hash" }, scenario.id),
          el("div", { class: "arms" }, [
            armGrid("Baseline", raw.baseline, settled ? scored.baseline : null),
            armGrid("Candidate", raw.candidate, settled ? scored.candidate : null),
          ]),
        ]);
      }),
    ]);
  }

  function armGrid(name, arm, official) {
    const label = official
      ? `${official.passes}/${official.valid} pass`
      : `${arm.scheduled} scheduled`;
    return el("div", {}, [
      el("p", { class: "arm-label" }, [name, el("b", {}, label)]),
      el("div", { class: "cells", "aria-hidden": "true" }, arm.slots.slice(0, arm.scheduled).map((slot) => el("i", {
        class: "cell",
        "data-kind": official ? slot : "",
        title: official ? SLOT_LABEL[slot] : "Pending",
      }))),
    ]);
  }

  function rateBlock(scored) {
    const rows = [
      rateRow("Baseline", scored.baseline),
      rateRow("Candidate", scored.candidate),
    ];
    return el("div", { class: "dash-block" }, [
      el("h3", {}, "Pass rate"),
      ...rows,
      scored.meanDelta == null ? el("p", { class: "fine" }, "No interval. The run is invalid.") : interval(scored),
    ]);
  }

  function rateRow(name, arm) {
    const text = arm.passRate == null ? "—" : formatPercent(arm.passes, arm.valid);
    const width = arm.passRate == null ? 0 : Math.round(arm.passRate * 1000) / 10;
    return el("div", { class: "rate-row" }, [
      el("span", {}, name),
      el("span", { class: "mono" }, text),
      el("span", { class: "rate-track", "aria-hidden": "true" }, el("i", { style: `width:${width}%` })),
    ]);
  }

  function interval(scored) {
    const pad = Math.max(0.02, (scored.upper - scored.lower) * 0.35);
    let min = Math.min(scored.lower, scored.meanDelta, 0) - pad;
    let max = Math.max(scored.upper, scored.meanDelta, 0) + pad;
    if (max - min < 0.05) max = min + 0.05;
    const x = (value) => ((value - min) / (max - min)) * 100;
    const start = x(scored.lower);
    return el("div", { style: "margin-top:0.7rem" }, [
      el("div", { class: "timeline-meta" }, [
        el("span", {}, "90% interval on the gap"),
        el("span", { class: "mono" }, `${formatSignedNumber(scored.lower)} to ${formatSignedNumber(scored.upper)} pp`),
      ]),
      el("div", { class: "ci-scale", "aria-hidden": "true" }, [
        el("i", { class: "ci-zero", style: `left:${x(0)}%` }),
        el("i", { class: "ci-band", style: `left:${start}%;width:${Math.max(0.8, x(scored.upper) - start)}%` }),
        el("i", { class: "ci-mean", style: `left:${x(scored.meanDelta)}%` }),
      ]),
      el("div", { class: "ci-labels mono" }, [
        el("span", {}, formatSignedNumber(min)),
        el("span", {}, "0"),
        el("span", {}, formatSignedNumber(max)),
      ]),
    ]);
  }

  function missBlock(scored) {
    return el("div", { class: "dash-block" }, [
      el("h3", {}, "Miss rate · 5% cap"),
      missMeter("Baseline", scored.baseline),
      missMeter("Candidate", scored.candidate),
    ]);
  }

  function missMeter(name, arm) {
    const over = armMissExceeds(arm.excluded, arm.scheduled);
    const rate = arm.scheduled ? arm.excluded / arm.scheduled : 0;
    const fill = Math.min(100, (rate / 0.2) * 100);
    return el("div", { style: "margin-top:0.55rem" }, [
      el("div", { class: "meter-top" }, [
        el("span", {}, name),
        el("span", { class: "mono" }, formatPercent(arm.excluded, arm.scheduled)),
        el("span", {}, over ? "Over cap" : "Within cap"),
      ]),
      el("div", { class: "meter-track", "aria-hidden": "true" }, [
        el("i", { class: "meter-fill", "data-over": over ? "1" : "0", style: `width:${fill}%` }),
        el("i", { class: "meter-cap", style: "left:25%" }),
      ]),
    ]);
  }

  function verdictCard(scored) {
    const rows = [];
    if (scored.meanDelta != null) rows.push(["Gap", formatPoints(scored.meanDelta)]);
    if (scored.candidate.agentTimeouts > 0) rows.push(["Step-budget timeouts", `${scored.candidate.agentTimeouts} scored 0`]);
    return el("div", { class: "console-body", style: "padding-top:0" }, [
      el("article", { class: "verdict", "data-verdict": scored.verdict }, [
        el("p", { class: "kicker" }, "Suite check"),
        el("h3", {}, scored.headline),
        rows.length ? el("dl", { class: "statline" }, rows.map(([label, value]) => el("div", {}, [el("dt", {}, label), el("dd", {}, value)]))) : null,
        el("p", { class: "why" }, scored.why),
      ]),
    ]);
  }

  paint();
}

initChrome();
renderDemo();

fetch(asset("data/results.preliminary.json"))
  .then((response) => {
    if (!response.ok) throw new Error(`Could not load results file (${response.status}).`);
    return response.json();
  })
  .then((doc) => renderResults(parseResults(doc)))
  .catch((error) => renderResultsError(error instanceof Error ? error : new Error("Could not read results.json")));
