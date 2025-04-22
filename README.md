# Microservice Resilience Simulator

An interactive, front-end “resilience lab” that visualizes how common microservice failure modes emerge under load and how resilience patterns mitigate them.

This is intentionally a simulation (not a real distributed system): you tweak knobs like traffic, latency, and failure rate, then watch request flow + metrics change in real time.

## Why this exists

The goal is to make resilience concepts explainable in minutes:

- Show the “death spiral” (high latency + retries + high traffic) and why it cascades.
- Show how timeouts, retries, circuit breakers, rate limiting, and bulkheads change outcomes.
- Provide an interview/demo-friendly artifact where the viewer can immediately understand what’s happening.

## Run it

This repo ships with a `pnpm-lock.yaml`; pnpm is the canonical choice.

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000.

Useful checks:

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

## How to use the sim (quick demo script)

- Baseline: start the sim and observe steady flow + low error rate.
- Death spiral: increase latency (e.g. ~1000ms), increase RPS (e.g. ~30), set retries to `fixed`, keep circuit breaker off.
- Breaker relief: enable circuit breaker; observe failures shed quickly and the system “breathes”.
- Rate limiting: enable rate limiter with rateLimitRPS below incoming RPS; observe rejected requests and stabilized latency.
- Bulkheads: enable bulkheads; one lane is intentionally “worse” to show isolation.- Learn patterns: each resilience pattern (Circuit Breaker, Rate Limit, Bulkheads, Retries, Timeouts) has a help icon (?) that opens a detailed explanation with diagrams and external resources.
## Architecture (what code does what)

The app is a single Next.js App Router frontend.

**Simulation core (framework-agnostic)**

- The discrete-time simulation engine is in [simulation/resilience/engine.ts](simulation/resilience/engine.ts).
- Types and defaults are in [simulation/resilience/types.ts](simulation/resilience/types.ts).

The engine produces a `SimulationSnapshot` with:

- `requests[]`: per-request entities (position, status, lane, retry count)
- `metrics`: rolling-window throughput, failures, latency, etc.
- circuit breaker state + token bucket state

**Orchestration (UI lifecycle)**

- The simulator hook runs the engine on `requestAnimationFrame` and exposes `start/pause/reset`: [hooks/use-resilience-simulator.ts](hooks/use-resilience-simulator.ts).
- Config + chart history are stored in Zustand: [hooks/use-resilience-store.ts](hooks/use-resilience-store.ts).

**Visualization (what you see)**

- The main page is [app/page.tsx](app/page.tsx) → [components/resilience/resilience-simulator-v2.tsx](components/resilience/resilience-simulator-v2.tsx).
- Topology diagram uses ReactFlow: [components/resilience/hero-flow.tsx](components/resilience/hero-flow.tsx).
- Request “flow” is a canvas overlay drawing particles from `snapshot.requests`: [components/resilience/request-particles.tsx](components/resilience/request-particles.tsx).
- Human-readable narration for what’s happening: [components/resilience/simulation-status.tsx](components/resilience/simulation-status.tsx).
- Metrics + charts: [components/resilience/resilience-metrics.tsx](components/resilience/resilience-metrics.tsx), [components/resilience/resilience-charts.tsx](components/resilience/resilience-charts.tsx).

**Content system (MDX + Mermaid)**

The project includes a reusable MDX-based content system for documentation and guides:

- **Content files:** MDX files live in `content/<collection>/` (e.g., `content/guides/`). Each file uses YAML frontmatter for metadata and standard markdown with Mermaid diagram support.
- **MDX loader:** [lib/mdx.ts](lib/mdx.ts) provides `listGuides(collection)` and `getGuideBySlug(collection, slug)` helpers using `gray-matter` for frontmatter parsing.
- **Components:**
  - [components/content/mermaid.tsx](components/content/mermaid.tsx) — Client-side Mermaid diagram renderer with dark theme.
  - [components/content/mdx-components.tsx](components/content/mdx-components.tsx) — Custom MDX component overrides (headings, code blocks, lists, etc.). Automatically renders `mermaid` code blocks as diagrams.
  - [components/content/guide-article.tsx](components/content/guide-article.tsx) — Reusable article shell with breadcrumbs, hero, and resources section.

**Adding new content:**

1. Create a new `.mdx` file in the appropriate collection folder (e.g., `content/guides/my-topic.mdx`).
2. Add frontmatter with required fields: `id`, `title`, `tagline`, `tooltipBlurb`, `category`, `resources[]`.
3. Write markdown content. Use fenced code blocks with `mermaid` language for diagrams:

   ~~~markdown
   ```mermaid
   flowchart LR
       A[Start] --> B[End]
   ```
   ~~~

4. The content will be automatically available at the corresponding route.

## Notes / limitations

- This is a teaching/demo simulation. It intentionally simplifies reality (no real networking, no real queues, no distributed tracing).
- The topology is primarily illustrative; the particle overlay is the “flow of requests”.
- The historical prototype lives in [resilience-sim.md](resilience-sim.md) (useful for context, not runtime).
