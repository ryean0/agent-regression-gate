/**
 * Product name. Script-rendered copy reads BRAND.
 * The visual lockup is WORDMARK (BRAND plus .dev). Static HTML cannot import
 * this module, so the name is also written in the spots listed in
 * BRAND_HTML_SPOTS. Those spots are marked with a `brand:` comment.
 * A rename is BRAND, WORDMARK, and that list. Prose stays on BRAND.
 */
export const BRAND = "Anubys";

export const WORDMARK = `${BRAND}.dev`;

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
  "hero wordmark",
  "hero tagline",
  "body: gate decision intro",
  "body: gate FAQ summary",
  "body: integrations intro",
];
