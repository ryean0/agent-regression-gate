/**
 * Product name. Script-rendered copy reads BRAND.
 * Static HTML cannot import this module, so the name is also written in the
 * spots listed in BRAND_HTML_SPOTS. Those spots are marked with a `brand:`
 * comment. A rename is BRAND plus that list.
 */
export const BRAND = "Anubys";

export const TAGLINE = `${BRAND}, a CI-native agent regression model harness.`;

export const BRAND_HTML_SPOTS = [
  "title",
  "meta description",
  "meta og:title",
  "meta og:description",
  "meta twitter:title",
  "meta twitter:description",
  "json-ld name",
  "header wordmark",
  "footer wordmark",
  "hero tagline",
  "body: gate decision intro",
  "body: gate FAQ summary",
  "body: integrations intro",
];
