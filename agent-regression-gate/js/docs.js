import "./main.js";
import { DOCS_INDEX } from "./docs-index.js";
import { docsHref, filterHeadings, normalizeQuery } from "./docs-search.js";

function initDocs() {
  const docsRoot = document.documentElement.dataset.docsRoot || "./";
  const input = document.getElementById("docs-q");
  const hits = document.getElementById("docs-hits");
  const status = document.getElementById("docs-hit-status");
  const toc = document.querySelector(".docs-toc");
  if (!input || !hits || !status) return;

  const tocLinks = toc ? [...toc.querySelectorAll("a[href^='#']")] : [];

  function apply() {
    const query = input.value;
    const needle = normalizeQuery(query);
    for (const link of tocLinks) {
      const show = !needle || link.textContent.toLowerCase().includes(needle);
      link.hidden = Boolean(needle) && !show;
    }
    const found = filterHeadings(DOCS_INDEX, query);
    hits.replaceChildren();
    if (!needle) {
      hits.hidden = true;
      status.textContent = "";
      input.setAttribute("aria-expanded", "false");
      return;
    }
    input.setAttribute("aria-expanded", "true");
    status.textContent = found.length === 1 ? "1 heading" : `${found.length} headings`;
    hits.hidden = false;
    if (found.length === 0) {
      const empty = document.createElement("li");
      empty.textContent = "No heading matches.";
      hits.append(empty);
      return;
    }
    for (const hit of found) {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = docsHref(docsRoot, hit.path, hit.id);
      link.textContent = hit.id ? `${hit.title} · ${hit.heading}` : hit.title;
      item.append(link);
      hits.append(item);
    }
  }

  input.addEventListener("input", apply);
  input.form?.addEventListener("submit", (event) => {
    event.preventDefault();
    apply();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!input.value) return;
    input.value = "";
    apply();
  });

  if (toc && typeof IntersectionObserver === "function") {
    const byId = new Map();
    for (const link of tocLinks) {
      const id = link.getAttribute("href")?.slice(1);
      const target = id ? document.getElementById(id) : null;
      if (target) byId.set(target, link);
    }
    if (byId.size) {
      const observer = new IntersectionObserver((entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        for (const link of tocLinks) link.removeAttribute("aria-current");
        byId.get(visible.target)?.setAttribute("aria-current", "true");
      }, { rootMargin: "-18% 0px -65% 0px", threshold: [0.15, 0.6] });
      for (const target of byId.keys()) observer.observe(target);
    }
  }
}

initDocs();
