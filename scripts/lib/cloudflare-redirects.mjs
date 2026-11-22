// Transform public/_redirects (Netlify syntax) into a file Cloudflare Pages
// accepts. Pure function, unit-tested in tests/ncn-cloudflare-redirects.test.mjs.
//
// Cloudflare's _redirects parser (workers-sdk parseRedirects) rejects the
// whole file when it hits problems that Netlify tolerates:
//  1. The `!` (shadowing/force) suffix on status codes: `301!` / `200!` are
//     invalid on Cloudflare, and the rule is dropped. 414/452 rules use it.
//  2. Dynamic rules count against a 100-rule budget, and the budget counts
//     EVERY rule after the first dynamic one — including static rules. The
//     two `:slug` rules sit at lines 7-8, so the parser aborts around line
//     106 and discards the remaining ~38 valid static rules. Moving the
//     dynamic rules to the END keeps all static rules static.
//  3. Duplicate sources are a validation error on Cloudflare (6 sources
//     appear twice: /arcade, /arcade/, /arcade/index.html, /ban-bong,
//     /ban-bong/, /ban-bong/index.html). First occurrence wins, matching
//     Netlify's behaviour.
//  4. Rules whose target is a Function (/.netlify/functions/...) are DROPPED:
//     Cloudflare applies _redirects rules only to static asset responses, so
//     a 200 rewrite to a Function path resolves the target as a static file
//     and 404s (verified against the Pages docs and in wrangler pages dev).
//     Page routing lives in functions/_middleware.js instead; dropping the
//     rules (instead of keeping them) also means a request that ever reaches
//     static serving for a page path degrades to the static HTML file
//     instead of a 404. 410 of 452 rules are dropped this way; the 37 301s
//     and 5 static 200 rewrites are kept.

export function transformRedirectsForCloudflare(text) {
  const comments = [];
  const staticRules = [];
  const dynamicRules = [];
  const seen = new Set();
  let strippedBang = 0;
  let removedDuplicates = 0;
  let droppedFunctionRewrites = 0;

  for (const line of String(text).split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#')) {
      comments.push(trimmed);
      continue;
    }
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) continue; // malformed line, drop it
    const [source, target] = parts;
    if (target.startsWith('/.netlify/functions/')) {
      droppedFunctionRewrites++;
      continue;
    }
    let status = parts[2] || '';
    if (status.endsWith('!')) {
      status = status.slice(0, -1);
      strippedBang++;
    }
    if (seen.has(source)) {
      removedDuplicates++;
      continue;
    }
    seen.add(source);
    const rule = status ? `${source}  ${target}  ${status}` : `${source}  ${target}`;
    if (source.includes(':')) dynamicRules.push(rule);
    else staticRules.push(rule);
  }

  const out = [...comments, ...staticRules, ...dynamicRules].join('\n') + '\n';
  return {
    text: out,
    stats: {
      total: staticRules.length + dynamicRules.length,
      static: staticRules.length,
      dynamic: dynamicRules.length,
      strippedBang,
      removedDuplicates,
      droppedFunctionRewrites
    }
  };
}
