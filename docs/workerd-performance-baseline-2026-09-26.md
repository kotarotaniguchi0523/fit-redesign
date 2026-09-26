# Local workerd performance baseline (2026-09-26)

This is a diagnostic snapshot of `main` (`90bed3c`) and a local SSR payload optimization measured with Wrangler/workerd on 2026-09-26. It is not a production latency benchmark. No deployment, paid feature, or production load test was performed.

## Runtime and configuration

- Wrangler `4.136.1`; pnpm `11.5.0`; workerd is run by `wrangler dev --local`.
- The project does not use `@cloudflare/vite-plugin`. Its Vite build uses `@hono/vite-build/cloudflare-workers` and `@hono/vite-dev-server/cloudflare`.
- Compatibility date: `2025-08-03`; flag: `nodejs_compat`.
- Worker bindings: D1 `DB`, Rate Limiting `PROGRESS_RATE_LIMITER`, and static assets `ASSETS`. There is no application KV, R2, Durable Object, or Worker-side external fetch path.
- `wrangler.jsonc` enables invocation logs and traces (10% log and 5% trace head sampling), with query strings redacted. This run used local observability, not those production sample rates.
- `pnpm build` completed successfully. Local D1 migrations were applied before profiling.

## Measurements

| Request | Status | SSR HTML bytes | Local trace wall p50 / p95 | Client-to-workerd TTFB p50 / p95 |
| --- | ---: | ---: | ---: | ---: |
| `/` | 200 | 67,575 | 3 / 5 ms | 5.97 / 8.55 ms |
| `/guide` | 200 | 9,939 | 1 / 2 ms | 4.41 / 6.28 ms |
| `/unit-base-conversion/2013` | 200 | 21,765 | 2 / 3 ms | 5.16 / 6.64 ms |
| `/unit-base-conversion/2013/exam?exam=1` | 200 | 4,891 | 1 / 2 ms | 4.36 / 6.33 ms |
| `/records` | 200 | 6,784 | 1 / 2 ms | 4.49 / 6.70 ms |
| `/health` | 200 | 15 | 1 / 2 ms | 3.76 / 7.27 ms |

Trace durations are local sampled requests, quantized to milliseconds; they are not production CPU time or user-perceived latency. TTFB includes the local client/runtime path. Route CPU attributes were `0 ms` for these short requests, below the precision useful in this trace output. Do not interpret that as zero CPU.

The sandbox could not resolve Cloudflare's `sparrow.cloudflare.com` metadata endpoint used while populating `Request.cf`; Wrangler logged that lookup failure, but the Worker still started and the tested routes responded. This can make local `cf` metadata differ from production.

Wrangler's `check startup` completed and generated a CPU profile:

- Worker plus assets upload bundle: **759.27 KiB raw / 178.70 KiB gzip**.
- Startup profile window: **87.6 ms**; sampled: **76.3 ms**; active: **55.4 ms** (including **2.1 ms GC**); idle: **20.9 ms**; **43 samples**.
- The profile spread samples across runtime and application frames. With 43 samples and a wrapped/minified Worker bundle without a usable source map, it does not establish one dominant startup function. The smaller standalone `dist/index.js` was 501,280 bytes raw / 150,190 bytes gzip; this is not the same measure as Wrangler's Worker-plus-assets upload bundle.

The route CPU profiles were collected with the Wrangler inspector's CDP `Profiler` domain, after warmups and 30 requests per route. They contain idle and runtime/facade frames and do not provide a stable per-request timing. The exam route profile included named Zod parser frames (`e17._zod.run`, `run`), while all routes included Hono/runtime routing and facade frames. The home route had the largest SSR HTML and more anonymous/minified frames, but the profile does not prove that its JSX tree, list rendering, or serialization is a CPU bottleneck. Preserve the raw profiles outside the repository for deeper source-map-based inspection if a regression appears.

### Home island payload change

Inspecting the actual workerd HTML showed that the `ContinueLearning` island serialized 260 flat location objects. Repeated `unitName`, `year`, `href`, and JSON property names made that one island account for **53,405 bytes** of a **67,575-byte** response. The props were grouped by unit/year, retaining each question ID but storing the repeated display and URL prefix once per group. The client reconstructs the same first matching route as before.

| Home response measurement | Before | After | Difference |
| --- | ---: | ---: | ---: |
| SSR HTML | 67,575 B | 29,380 B | −38,195 B (−56.5%) |
| `ContinueLearning` island | 53,519 B | 15,324 B | −38,195 B (−71.4%) |
| Serialized island props | 53,405 B | 15,210 B | −38,195 B (−71.5%) |
| Whole HTML gzip | 4,836 B | 3,638 B | −1,198 B (−24.8%) |
| Whole HTML Brotli | 3,003 B | 2,475 B | −528 B (−17.6%) |

Both captures used the local built Worker and the same HTML byte-counting method. The 50-sample client-to-workerd TTFB was p50/p95 **5.97/8.55 ms before** and **6.65/9.92 ms after**. This noisy local timing did not improve and is not evidence of a latency regression or gain; the observed improvement is the deterministic HTML/props reduction. No production CWV change is claimed.

## I/O, logs, and memory

Local Explorer recorded structured `app.route.response` logs with normalized routes and status, plus correlated root invocation spans. SSR routes produced no D1 child spans. A progress-link write produced a D1 `d1_run` span (4 ms) under a 12 ms root span; its rate-limit binding also appeared as a short fetch-like child operation. Repeated sync requests returned 200; D1 read spans were 0–2 ms (50 reads, average about 0.7 ms). No application exceptions were observed. This isolates the exercised data path as local binding I/O, with no external network service involved.

`Runtime.getHeapUsage` returned **5,955,852 bytes used / 9,170,944 bytes total** for one local Worker runtime observation. A CDP heap snapshot request did not return within the available inspector session, and a forced-GC request also did not complete. Therefore this is only a point reading: no retained-object analysis, post-GC comparison, or memory-growth/leak conclusion is available from this run. Retry snapshots from the Wrangler DevTools Memory panel in an interactive local session.

`wrangler whoami` reported that this environment is not authenticated. Production `wrangler tail`, dashboard CPU/wall-time quantiles, error rates, subrequest metrics, and Worker version were consequently not inspected. No production traffic was generated.

## Findings and next checks

- **CPU / SSR:** No single pathological hot function was established by the minified CPU profiles. The confirmed home SSR waste was repeated island-prop serialization; grouping those values reduced raw SSR HTML by 38.2 KB and Brotli output by 528 bytes in the local build. This does not by itself establish LCP/INP improvement.
- **I/O:** Local D1 and rate-limit child spans are visible and short in this sample. Continue using Local Explorer to follow unusually slow subrequests; do not add timers that duplicate platform spans.
- **Startup / bundle:** Startup work is measurable locally and the startup profile is available at `/tmp/fit-worker-startup.cpuprofile` in the measurement environment. The sampled startup profile did not isolate a dominant module initializer. Review bundle changes together with startup profile changes rather than treating bundle bytes alone as a performance defect.
- **Memory:** Heap usage was readable, but growth/leak testing remains inconclusive because snapshots and forced GC did not complete.
- **Production:** Once authenticated, inspect Workers Metrics quantiles and sampled Observability traces/logs; use `wrangler tail` only with a route/status filter and a short capture. Compare p50/p75/p95/p99 and CPU vs wall time. Do not use application `performance.now()`/`Date.now()` deltas as production CPU measurements.
- **Browser:** The production home page was opened once in the available Chrome browser and its DOM was inspected. Chrome DevTools MCP tools are not configured in this workspace, so no browser performance trace, LCP/INP/CLS, network waterfall, or memory snapshot was captured. Playwright was not run. The Cloudflare `web-perf` skill is installed at `.agents/skills/web-perf`; its DevTools trace workflow needs Chrome DevTools MCP in a session where that server is configured.

No absolute-time CI assertion was added. For future regressions, compare the same route/build on the same local workerd setup and use the dedicated `pnpm perf:report` only as a separate Node/Vite relative SSR and size report; it is not a Worker CPU benchmark.
