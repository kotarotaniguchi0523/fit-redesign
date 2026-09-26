# Performance measurement and diagnosis

This repository separates browser experience, HonoX/SSR, Worker execution, external I/O, and built assets. Start with the layer-specific signals below; do not compare local Node timings to production Worker timings.

## What is collected

| Layer | Signals | Where to inspect | Use |
| --- | --- | --- | --- |
| Browser UX | LCP, INP, CLS, page load, navigation type | Cloudflare Dashboard → Web Analytics → Core Web Vitals / Page load time | Production, evaluate p75 and use URL/browser/element filters. |
| Browser rendering | Interaction, Event Timing, Long Animation Frames, scripting, style/layout, paint/composite, GC, heap, DOM nodes, listeners, detached DOM | Chrome DevTools → Performance / Memory / Performance monitor | Local diagnosis of `/`, `/unit-base-conversion/2013`, `/unit-base-conversion/2013/exam?exam=1`, and `/records`. |
| Browser app operation | `fit-redesign:quiz-question-update` User Timing measure | Chrome DevTools Performance → User Timing | Local or production debugging when recording the small-test question transition. It ends after synchronous JSX/DOM work and excludes paint. |
| Worker execution | Invocation count, errors/outcomes, CPU time, wall time, execution duration, subrequests and cached/uncached subrequests; quantile charts | Workers & Pages → `fit-redesign` → Metrics / Observability | Production. Compare p50/p75/p95/p99 where exposed, and use deployment markers/version to find regressions. |
| Worker trace | Invocation, version, Ray ID, colo/region, CPU/wall time, outcome/exception, outbound fetch and D1 operations | Workers & Pages → `fit-redesign` → Observability → Traces | Production request diagnosis. D1 and `fetch()` are automatically instrumented by Cloudflare. |
| HonoX route | Normalized route template, method, final status | Workers Observability → Query Builder; filter `event = app.route.response` or `app.route.error` | Production route grouping. The app log deliberately adds no duration or request ID already available in Cloudflare's records. |
| Network/edge | Document TTFB, request waterfall/initiator, transfer/resource size, cache status and request chain | Chrome DevTools → Network; inspect response `Server-Timing` | Browser and production diagnosis. Use Cloudflare `edge`, `origin`, `cfWorker`, and cache metrics when present to divide the path. |
| SSR and assets | SSR response generation p50/p95, HTML bytes, route island asset closure, all client JS/CSS raw/gzip/Brotli sizes, Worker bundle bytes | `pnpm perf:report` JSON output | Local relative comparison on the same runtime and machine. |
| Local Worker | CPU profile, heap, bindings, traces, correlated logs | `pnpm preview`, then Wrangler DevTools (`D`) or Local Explorer (`E`) | Local Worker diagnosis with workerd and local D1. |

## Cloudflare setup and query guidance

`wrangler.jsonc` enables persisted Workers Logs at 10% sampling and Traces at 5%, retains native invocation logs, and redacts query strings. Cloudflare Workers Free includes 200,000 log/trace events per day with 3-day retention; Workers Tracing is free in beta today but becomes part of that same metered event quota on October 1, 2026. These conservative rates leave headroom under the Free limits; monitor event volume in the dashboard and lower sampling if usage approaches the quota. Built-in Worker metrics still cover every request. Cloudflare automatically attaches Worker version, invocation, Ray ID, colo/region, CPU/wall time and outcome, and creates spans for outbound `fetch()` and D1 operations. The app currently uses D1 and the Rate Limiting binding. Cloudflare's published trace span list does not document automatic spans for Rate Limiting bindings; add no synthetic I/O timer to imitate one. The app currently has no Worker-side outbound fetch, KV, R2 or Durable Object use.

Cloudflare's Metrics view provides request and error counts, CPU/wall time quantiles, execution duration, and fetch subrequest cache breakdown. Wall time is not client response duration: it includes waiting and `waitUntil`, and may finish before a large response body is fully delivered. Invocation status also differs from HTTP status. Group request logs by the normalized `route` field and status; trace rows can be grouped by version, colo/region, outcome, and root-span CPU/wall attributes. Query Builder can aggregate percentiles rather than just averages.

Cloudflare Tracing is explicitly enabled under `observability.traces` because `observability.enabled` alone enables logs, not tracing. No custom spans are added: platform spans and the root invocation give the needed Worker/I/O split, while the HonoX route log supplies the route dimension. No Analytics Engine, OTel exporter, extra logger, or duplicate latency metric is configured.

### Server-Timing and TTFB

Cloudflare may return `cdn-cache`, `edge`, `origin`, and `cfWorker` in `Server-Timing`. `cfWorker` includes Worker execution and its subrequests; Cloudflare says it is available by default when RUM is enabled, or can be enabled with a Cloudflare rule. These values are edge-generated and cannot be configured in Wrangler or synthesized accurately by Hono middleware. If absent, enable RUM or a response-header/Server-Timing rule on the zone, then inspect the document response in Chrome Network. `Server-Timing` is intentionally not set by the application.

### Web Analytics RUM

Cloudflare Web Analytics is available on all plans at no cost. Open Dashboard → Web Analytics → Add a site. A proxied hostname can use Cloudflare's automatic setup; otherwise copy the hostname-specific snippet and add it to the HTML. This repository permits `https://static.cloudflareinsights.com` in `script-src` and `https://cloudflareinsights.com` in `connect-src` for the beacon. The production hostname/account setting is not declared in Wrangler, so repository code cannot verify or activate the account-level RUM switch by itself.

Use Core Web Vitals p75 first (Cloudflare also exposes other percentiles in element drilldowns) and filter by URL, browser, country, and element. Page load and navigation type are reported by Web Analytics. Page links in this app use regular document navigations; question/result state changes use `history.replaceState` and Hono JSX islands, not HonoX soft route navigation. Therefore those state changes are not independent page views; use the User Timing mark plus Chrome's Interaction track when profiling question changes. No general-purpose RUM beacon or custom event transport is added.

## Browser profiling

1. Run `pnpm dev` for browser-only JSX/island iteration. For Worker bindings and SSR parity, run `pnpm db:migrate:local`, `pnpm build`, then `pnpm preview` (`wrangler dev`).
2. Open one representative route above in Chrome and DevTools → Performance. Start a recording, click through question navigation, answer reveal, filter/history, and a full route navigation; stop the recording.
3. Inspect LCP/INP/CLS, Interaction and Main thread tracks, Long Animation Frames, JS/event-handler work, Recalculate Style, Layout, Paint, Composite, and GC. Find the `fit-redesign:quiz-question-update` User Timing measure around synchronous reducer/DOM work; inspect subsequent style/layout/paint separately.
4. Use Network with Preserve log enabled. Inspect document TTFB, initiator chain, transfer/resource sizes, cache status, load ordering, and the response `Server-Timing` header. `edge`/`origin`/`cfWorker` are Cloudflare-provided and can be absent until zone RUM/rules are configured.
5. For lifecycle leaks, record repeated player mount/unmount or full navigation in Memory/Performance monitor. Compare JS heap, DOM node and listener counts; take heap snapshots and check detached DOM nodes, timers, subscriptions, and event cleanup.

Playwright is not required for this workflow. The repository's correctness tests remain separate and must not assert environment-dependent durations.

## SSR and bundle report

After `pnpm build`, run:

```bash
pnpm perf:report -- --output perf-results/report.json
```

The report issues `app.request()` against the full Vite-loaded HonoX app and records warmed p50/p95 Node/Vite request durations and final HTML byte counts for home, guide, unit/year, exam-player, and records pages. It also reports route island/client asset closures and raw, gzip, and Brotli sizes for built client JS, CSS, and the Worker bundle. Increase sample count on stable hardware with `PERF_ITERATIONS=50 PERF_WARMUPS=5 pnpm perf:report`.

For a relative comparison, save a candidate report, create a detached worktree at the baseline commit, install/build there, then compare JSON reports:

```bash
pnpm build
pnpm perf:report -- --output /tmp/candidate.json
git worktree add --detach /tmp/fit-redesign-baseline origin/main
(cd /tmp/fit-redesign-baseline && pnpm install --frozen-lockfile && pnpm build && pnpm perf:report -- --output /tmp/baseline.json)
pnpm perf:compare /tmp/baseline.json /tmp/candidate.json
git worktree remove /tmp/fit-redesign-baseline
```

Use the same Node version and runner for both reports. The comparison prints relative changes and never fails at a time threshold; noisy duration changes need repeated runs, while size changes are deterministic for the same build inputs.

This is a same-machine relative regression aid, not a production Worker CPU benchmark: Node timers do not reproduce workerd, Cloudflare isolates, network, cache, browser parsing, execution, or rendering. No hard millisecond limit is used in Vitest. Compare a baseline and candidate on the same Node version/runner; review route HTML bytes, p50/p95, island closures, and all bundle sizes together. If CI timing noise is high, treat duration deltas as a trend and let size/report differences guide review rather than blocking correctness checks.

For a current clean build, inspect the manifest and files under `dist/static/`. Chrome DevTools Coverage on each representative page can show which delivered JS was actually used. Remember that shared client bootstrap and runtime assets are expected on multiple routes; route island closures show potential downloads and do not measure browser parse/execute cost. Use the browser trace to assess those costs.

## Local Worker traces and CPU/memory

`pnpm preview` runs the built Worker locally on workerd using Wrangler. Press `D` in the Wrangler terminal to open Cloudflare DevTools CPU Profiler/heap tools, and `E` to open Local Explorer at `/cdn-cgi/local/explorer`. Local Explorer shows correlated invocation traces/logs and the local D1 binding. Profile requests representative of production data. Local `performance.now()` can measure CPU because timers advance outside I/O in development; production Workers only advance timers across I/O, so never use application `performance.now()` or `Date.now()` deltas for production CPU-bound work. Use Cloudflare CPU quantiles/traces in production, and the local CPU Profiler to identify functions.

## Explicit omissions

- No Hono `hono/timing` or homemade server timing: it can duplicate Cloudflare timing and is not a production CPU timer.
- No custom trace spans: automatic request, `fetch()`, and D1 spans plus the route log suffice for current request paths.
- No Analytics Engine: built-in metrics and route-annotated Workers Logs answer current questions without duplicate storage.
- No OTel destination: the project has no existing external observability backend.
- No Playwright performance thresholds: browser automation is not part of this local profiling workflow, and fixed duration assertions would be machine-dependent.
