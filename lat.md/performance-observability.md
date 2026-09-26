# Performance observability

Use browser RUM and traces, Cloudflare Worker telemetry, and local SSR/build reports to locate regressions without adding duplicate timing systems.

## Measurement boundaries

Cloudflare owns production Worker and I/O metrics. Browser tools own UX and rendering; local app/build reports are relative comparisons.

`wrangler.jsonc` enables persisted Workers Logs at 10% and Traces at 5%, removes query strings from telemetry, and retains native invocation logs. These sampling rates preserve representative route/trace data within Workers Free event quotas; unsampled requests remain visible in built-in Worker metrics. Platform traces include invocation/version, Ray ID, colo, CPU/wall time, outcome, fetch calls, and D1 operations; the app adds only the HonoX route template to its structured response/error log. Cloudflare's rate-limit binding does not have a documented automatic span, and this app has no KV, R2, Durable Object, or Worker-side outbound `fetch()` calls today.

Cloudflare Web Analytics setup, `cfWorker` Server-Timing availability, and the dashboard's observed metrics depend on the connected Cloudflare zone and cannot be verified by repository tests. The server CSP permits the Cloudflare Web Analytics beacon script. No custom Server-Timing header is added.

## Browser operation timing

Quiz question updates emit a User Timing measure around synchronous UI work. It excludes paint and Worker CPU.

- Implementation: [[app/features/performance/userTiming.ts#measureUserInteraction]]
- Measurement walkthrough: `docs/performance-observability.md`, section “Browser profiling”.

## Local SSR and build report

`pnpm perf:report` records local SSR latency and built asset sizes after a production build. It has no duration thresholds.

- Report implementation: `scripts/perf-report.mjs`.
- Measurement walkthrough: `docs/performance-observability.md`, section “SSR and bundle report”.
