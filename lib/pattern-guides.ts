export type PatternId =
	| "timeout"
	| "retry"
	| "circuit-breaker"
	| "rate-limit"
	| "bulkhead";

export interface PatternGuideResource {
	title: string;
	url: string;
}

export interface PatternGuideSection {
	heading: string;
	paragraphs: string[];
	bullets?: string[];
}

export interface PatternGuide {
	id: PatternId;
	title: string;
	tagline: string;
	tooltipBlurb: string;
	sections: PatternGuideSection[];
	diagramAscii: string;
	resources: PatternGuideResource[];
}

const PATTERN_GUIDES: Record<PatternId, PatternGuide> = {
	timeout: {
		id: "timeout",
		title: "Timeouts",
		tagline: "Bound latency to prevent pile-ups and resource exhaustion.",
		tooltipBlurb:
			"Caps how long a request is allowed to run. Prevents endless waiting and keeps queues from backing up.",
		sections: [
			{
				heading: "What problem it solves",
				paragraphs: [
					"In distributed systems, tail latency and partial failures are normal. A single slow dependency can cause requests to pile up, saturate pools (threads, connections), and then cascade into broader outages.",
					"Timeouts put a hard upper bound on how long you're willing to wait, so the system can fail fast and preserve capacity for other work.",
				],
				bullets: [
					"Limits worst-case latency per hop",
					"Prevents resource leaks (stuck connections / blocked workers)",
					"Creates clear signals for circuit breakers and retries",
				],
			},
			{
				heading: "How it works",
				paragraphs: [
					"A timeout is a deadline. If the operation hasn't finished by the deadline, the caller stops waiting and treats it as a failure.",
					"In well-designed systems, the timeout is paired with cancellation so the downstream work can stop too (when supported).",
				],
				bullets: [
					"Pick timeouts per hop (client → gateway, gateway → service, service → DB)",
					"Use shorter timeouts closer to the user; enforce end-to-end budgets",
					"Treat timeouts as first-class failures in metrics",
				],
			},
			{
				heading: "Common pitfalls",
				paragraphs: [
					"Timeouts that are too long do nothing; timeouts that are too short cause self-inflicted failures.",
					"Timeouts without cancellation can still overload the downstream even if the caller gives up.",
				],
				bullets: [
					"Using a single global timeout for all calls",
					"Retrying aggressively on timeouts without backoff (creates retry storms)",
					"Not aligning timeouts across hops (downstream timeout > upstream timeout wastes work)",
				],
			},
			{
				heading: "How this simulator models it",
				paragraphs: [
					"The simulator assigns each request a deadline. If the simulated latency exceeds that deadline, the request is marked as timed out and counted as a failure.",
					"This is intentionally a simplified model: it focuses on the user-visible effect (bounded waiting) and the knock-on effects on retries and the circuit breaker.",
				],
			},
		],
		diagramAscii: `
Timeline (single request)

Start ───────────────────────────────▶ time
  │
  ├── fast response (200ms) ─────────▶ Success
  │
  ├────────── slow response (600ms) ─▶ Success
  │
  └───────────────────────X
            timeout (800ms)           ▶ Failure
`,
		resources: [
			{
				title:
					"AWS Builders' Library: Timeouts, retries, and backoff with jitter",
				url: "https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/",
			},
		],
	},

	retry: {
		id: "retry",
		title: "Retries",
		tagline: "Recover from transient failures without melting your own system.",
		tooltipBlurb:
			"Automatically re-attempts transient failures. Needs backoff + jitter to avoid synchronized retry storms.",
		sections: [
			{
				heading: "What problem it solves",
				paragraphs: [
					"Many failures are transient: a brief network glitch, a momentary overload, or a short-lived deployment blip. A retry can turn those into successes without user intervention.",
					"But retries are dangerous: they increase load exactly when a system is already struggling. The retry policy must be conservative and well-scoped.",
				],
				bullets: [
					"Good for: timeouts, 503s, connection resets (transient)",
					"Bad for: deterministic failures (4xx), invalid inputs, permanent errors",
				],
			},
			{
				heading: "How it works (backoff + jitter)",
				paragraphs: [
					"A retry policy usually specifies max attempts and a delay schedule. Backoff increases the delay after each failure so you don't instantly hammer the dependency.",
					"Jitter randomizes retry timing across clients so they don't all retry at once (the thundering herd problem).",
				],
				bullets: [
					"Fixed delay: simple but can synchronize clients",
					"Exponential backoff: spreads load more aggressively",
					"Jitter: adds randomness to avoid waves",
					"Max attempts: bounds worst-case latency and load",
				],
			},
			{
				heading: "Common pitfalls",
				paragraphs: [
					"Unbounded retries can turn a partial outage into a full outage.",
					"Retrying non-idempotent operations can cause duplicates (double charges, double writes).",
				],
				bullets: [
					"No jitter (synchronized retry storms)",
					"Retrying too quickly (no backoff)",
					"Retrying everything (including 4xx)",
					"Not enforcing idempotency for write operations",
				],
			},
			{
				heading: "How this simulator models it",
				paragraphs: [
					"Failed requests can be re-attempted based on the selected strategy (off / fixed / jitter). Each attempt is visualized as a new traversal through the pipeline.",
					"The model is intentionally focused on the macro-effect: retries improve success rate under transient errors, but increase load and can worsen saturation under sustained failure.",
				],
			},
		],
		diagramAscii: `
Attempt 1  ──X──▶ wait 100ms
Attempt 2  ──X──▶ wait 200ms
Attempt 3  ──✓──▶ success

With jitter:
  base 200ms → actual 120–280ms (randomized)
`,
		resources: [
			{
				title: "AWS Architecture Blog: Exponential backoff and jitter",
				url: "https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/",
			},
			{
				title:
					"AWS Builders' Library: Timeouts, retries, and backoff with jitter",
				url: "https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/",
			},
		],
	},

	"circuit-breaker": {
		id: "circuit-breaker",
		title: "Circuit Breaker",
		tagline: "Stop calling a failing dependency; recover with probes.",
		tooltipBlurb:
			"Trips open after failures and fails fast, preventing slow failures from exhausting capacity.",
		sections: [
			{
				heading: "What problem it solves",
				paragraphs: [
					"When a dependency is slow or unhealthy, continuing to send requests usually makes things worse: queues grow, timeouts increase, and the caller burns resources waiting.",
					"A circuit breaker detects sustained failure and temporarily stops sending traffic to give the dependency time to recover, while protecting the caller.",
				],
				bullets: [
					"Prevents cascades caused by slow failures",
					"Turns long waits into fast failures",
					"Creates breathing room for recovery",
				],
			},
			{
				heading: "How it works (states)",
				paragraphs: [
					"Circuit breakers usually have three states. In CLOSED, requests flow normally while failures are tracked. If failures exceed a threshold, it trips OPEN and immediately rejects requests. After a cooldown, it moves to HALF_OPEN and allows a small number of probe requests.",
					"If probes succeed, it closes; if they fail, it re-opens and cools down again.",
				],
				bullets: [
					"Threshold: how many failures trigger OPEN",
					"Cooldown: how long to stay OPEN",
					"Probe policy: how many HALF_OPEN requests and success criteria",
				],
			},
			{
				heading: "Common pitfalls",
				paragraphs: [
					"If the circuit is too sensitive, it flaps (opens/closes frequently). If it's too insensitive, it trips too late.",
					"Fail-fast is not the same as success: you still need good fallbacks or error handling.",
				],
				bullets: [
					"Using consecutive-failure thresholds without time windows (too spiky)",
					"No fallback or degraded mode when OPEN",
					"Probe traffic too high (HALF_OPEN becomes load test)",
				],
			},
			{
				heading: "How this simulator models it",
				paragraphs: [
					"The breaker watches request outcomes to Service B. After repeated failures it transitions to OPEN and rejects requests immediately. After a cooldown, it transitions to HALF_OPEN and lets some requests through.",
					"In the flow visualization, OPEN means requests stop at the breaker and fail fast (you'll see fewer particles reach Service B).",
				],
			},
		],
		diagramAscii: `
 CLOSED ──(failure threshold)──▶ OPEN
   ▲                            │
   │                            │ (cooldown)
   │                            ▼
   └────────(healthy probes)── HALF_OPEN
                (fail) ───────▶ OPEN
`,
		resources: [
			{
				title: "Martin Fowler: Circuit Breaker",
				url: "https://martinfowler.com/bliki/CircuitBreaker.html",
			},
			{
				title: "Microsoft Azure Architecture: Circuit Breaker pattern",
				url: "https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker",
			},
		],
	},

	"rate-limit": {
		id: "rate-limit",
		title: "Rate Limiting (Token Bucket)",
		tagline:
			"Smooth bursts, enforce fairness, and protect downstream capacity.",
		tooltipBlurb:
			"Controls how many requests are admitted per second using a token bucket. Excess is rejected quickly.",
		sections: [
			{
				heading: "What problem it solves",
				paragraphs: [
					"Rate limiting protects systems from overload (accidental or malicious) and enforces fairness between clients.",
					"It also smooths bursty traffic so downstream services experience a more stable load profile.",
				],
				bullets: [
					"Prevents overload from spikes",
					"Enforces per-client or global quotas",
					"Improves predictability under load",
				],
			},
			{
				heading: "How token bucket works",
				paragraphs: [
					"Imagine a bucket of tokens. Each request spends one token. Tokens are added back at a fixed rate up to a maximum capacity.",
					"This allows short bursts (spend saved tokens), but enforces a long-term average rate (refill rate).",
				],
				bullets: [
					"Refill rate controls sustained throughput",
					"Bucket size controls burst capacity",
					"On empty bucket: reject quickly (typically 429)",
				],
			},
			{
				heading: "Common pitfalls",
				paragraphs: [
					"Hard rejects can harm UX if clients aren't coded to handle them gracefully.",
					"If you rate-limit only at the edge but not internally, you can still overload internal tiers with fan-out.",
				],
				bullets: [
					"No client guidance (no Retry-After, no backoff)",
					"Limiting only globally, not per-tenant/client",
					"Forgetting burst capacity (bucket size) and causing unnecessary rejects",
				],
			},
			{
				heading: "How this simulator models it",
				paragraphs: [
					"Requests pass through a token bucket. If tokens are available, the request continues; otherwise it is rejected immediately.",
					"In the flow view you’ll see rejected requests stop early at the rate limiter, protecting the rest of the pipeline.",
				],
			},
		],
		diagramAscii: `
Bucket capacity: 10 tokens
Current:         [●●●●●○○○○○]

Request arrives → token available?
  yes → admit
  no  → reject (429)

Refill: +r tokens/sec (up to capacity)
`,
		resources: [
			{
				title: "Wikipedia: Token bucket",
				url: "https://en.wikipedia.org/wiki/Token_bucket",
			},
			{
				title: "Stripe Engineering: Rate limiters",
				url: "https://stripe.com/blog/rate-limiters",
			},
		],
	},

	bulkhead: {
		id: "bulkhead",
		title: "Bulkheads",
		tagline: "Isolate capacity so one problem doesn't sink everything.",
		tooltipBlurb:
			"Partitions resources into separate pools. One noisy tenant/route can't consume all capacity.",
		sections: [
			{
				heading: "What problem it solves",
				paragraphs: [
					"Shared pools are a single blast radius: one slow route, one noisy tenant, or one unhealthy dependency can saturate threads/connections and starve everything else.",
					"Bulkheads isolate capacity into separate pools so failures are contained.",
				],
				bullets: [
					"Containment: prevents cross-talk between workloads",
					"Predictability: protects high-priority traffic",
					"Graceful degradation: one compartment floods, others stay afloat",
				],
			},
			{
				heading: "How it works",
				paragraphs: [
					"You create separate limits per class of work: e.g., separate thread pools, separate connection pools, separate queues.",
					"Once a pool is full, requests in that category are rejected or queued without impacting other categories.",
				],
				bullets: [
					"Partition by tenant, endpoint, or dependency",
					"Set per-pool concurrency limits",
					"Add priority lanes (gold/silver/bronze)",
				],
			},
			{
				heading: "Common pitfalls",
				paragraphs: [
					"Too many partitions can waste capacity and complicate ops.",
					"If you partition but still share a deeper dependency, you may only move the bottleneck.",
				],
				bullets: [
					"Over-partitioning (unused capacity in one pool while another is saturated)",
					"No clear admission strategy when a pool is full",
					"Ignoring downstream shared bottlenecks",
				],
			},
			{
				heading: "How this simulator models it",
				paragraphs: [
					"The simulator treats 'bulkheads' as separate lanes/pools with different quality. Saturation or higher failure in one lane doesn't fully block the other lane.",
					"In the visualization you can see requests distributed across lanes and how a degraded lane doesn’t fully collapse the whole pipeline.",
				],
			},
		],
		diagramAscii: `
Without bulkheads (one pool):
  [■■■■■■■■■■]  ← one bad workload fills it

With bulkheads (two pools):
  Pool A: [■■■■■]  (degraded)
  Pool B: [○○○○○]  (healthy)
`,
		resources: [
			{
				title: "Microsoft Azure Architecture: Bulkhead pattern",
				url: "https://learn.microsoft.com/en-us/azure/architecture/patterns/bulkhead",
			},
			{
				title: "Release It! (book): Bulkheads and stability patterns",
				url: "https://pragprog.com/titles/mnee2/release-it-second-edition/",
			},
		],
	},
};

export function getAllPatternGuides(): PatternGuide[] {
	return Object.values(PATTERN_GUIDES);
}

export function getPatternGuide(id: PatternId): PatternGuide {
	return PATTERN_GUIDES[id];
}

export function isPatternId(value: string): value is PatternId {
	return (
		value === "timeout" ||
		value === "retry" ||
		value === "circuit-breaker" ||
		value === "rate-limit" ||
		value === "bulkhead"
	);
}
