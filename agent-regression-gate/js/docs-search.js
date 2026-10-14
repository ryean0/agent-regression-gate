/**
 * Client-side docs search. Headings are filtered in the browser.
 * This module does not touch the DOM.
 */

export function normalizeQuery(value) {
  return String(value ?? "").trim().toLowerCase();
}

/** Relative href from a page's docs root (`./`, `../`, `../../`). */
export function docsHref(docsRoot, pagePath, id) {
  const root = docsRoot && String(docsRoot).length ? String(docsRoot) : "./";
  const base = root.endsWith("/") ? root : `${root}/`;
  const path = pagePath || "";
  const hash = id ? `#${id}` : "";
  return `${base}${path}${hash}`;
}

export function filterHeadings(entries, query, limit = 12) {
  const needle = normalizeQuery(query);
  if (!needle) return [];
  const cap = Number.isInteger(limit) && limit > 0 ? limit : 12;
  const hits = [];
  for (const page of entries) {
    const title = String(page.title ?? "");
    const pagePath = String(page.path ?? "");
    if (title.toLowerCase().includes(needle)) {
      hits.push({ title, heading: title, path: pagePath, id: "" });
    }
    for (const heading of page.headings ?? []) {
      const text = String(heading.text ?? "");
      if (text.toLowerCase().includes(needle)) {
        hits.push({ title, heading: text, path: pagePath, id: String(heading.id ?? "") });
      }
    }
    if (hits.length >= cap) break;
  }
  return hits.slice(0, cap);
}
