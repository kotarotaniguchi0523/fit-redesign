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

## Quiz player first render

The first question is SSG content; player controls initialize in a separate client module. Measure module delivery, session setup, and timer updates as separate browser costs.

Hono JSX DOM replaces the island root on its first client render, so the static question remains visible while the module loads. The client resolves browser state before that render and shows the usable player immediately.

Vite builds the player island as a separate module once per build. Direct quiz routes emit a manifest-resolved `modulepreload` for that chunk. Listing pages avoid downloading the player for every visit and dynamically import it only when a start or question-timer link receives pointer or keyboard focus. This intent prefetch executes the module but does not mount the player or access local storage. The client resolves the initial attempt/result from local storage during its first render without writing; the layout-effect commit then acquires the tab lock and persists a new attempt. The timer display owns its one-second clock. The controller accumulates and persists the canonical challenge snapshot every five seconds without scheduling a player render; user actions and lifecycle boundaries sync the latest state into the UI. Stable callbacks and memoized controls keep unchanged header, answer, and navigation components out of timer updates.

The player emits `fit-redesign:quiz-player-initialize` across client session resolution and the lock/save commit, and `fit-redesign:quiz-player-mount-to-ready` through the first committed interactive state. These marks start after the island module has loaded. Use Chrome Performance Interaction and Network tracks to include click, navigation, transfer, parse, and module loading; inspect rendering tracks separately because the measures end before paint. Compare cold navigation, link intent prefetch, and direct quiz route loading. The existing first-question and Markdown reuse remains useful but did not address initial activation on its own.

- Page Object readiness and no-JavaScript coverage: [[testing#Challenge client and player#Initial HTML shows the first question before island hydration]].
- Browser measurement: `docs/performance-observability.md`, section “Quiz player first render”.

D1 is accessed only by explicit synchronization. Challenge answer reads use 75-ID chunks with at most six concurrent requests; full history is returned to preserve cross-device merge behavior.
