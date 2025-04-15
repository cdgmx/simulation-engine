Repository Guidelines

Project Structure & Module Organization

This repository is a single Next.js 16 App Router frontend. There is no Turborepo or workspace layout; everything in this repo exists to support the main app.
	•	app/ contains routes, layouts, and pages. Treat these as the product surface area.
	•	components/ui/ contains reusable presentational components (largely shadcn/Radix-based). Keep them dumb and styling-focused.
	•	hooks/ contains React hooks for shared client-side behavior.
	•	lib/ contains pure utilities and small helpers that are app-specific but not tied to a single route.
	•	providers/ contains React providers and wiring for client-side services (for example React Query, theming).
	•	public/ contains static assets served by Next.js.
	•	simulation/ contains the pure TypeScript simulation engine: core types, engine, patterns (circuit breaker, load balancer, etc.), and scenarios. This layer must not import React, Next.js, Zag, or any UI-specific libraries.

Documentation Policy: The codebase maintains a single README.md at the repository root. Do not add additional README files under app/, components/, or other folders. All project documentation, setup instructions, and architectural decisions live in the root README.md to keep a single source of truth.

Before extracting code into a new top-level module or folder, confirm:
	•	It has at least two concrete consumers today.
	•	Its API surface is small, cohesive, and testable.
	•	Ownership is clear (who maintains it when requirements change).
	•	It does not introduce circular dependencies or hidden coupling with routes.

If the checklist fails, keep code close to the feature (for example inside app/ alongside the route) until reuse is proven.

Build, Test, and Development Commands

Install dependencies with your preferred package manager. The repo ships with a pnpm-lock.yaml, so pnpm is the canonical choice:
	•	pnpm install – install dependencies
	•	pnpm dev – run the Next.js dev server
	•	pnpm build – production build
	•	pnpm start – run the production server
	•	pnpm lint – Biome-powered linting (biome check --write)

If you use npm or another tool, run the equivalent npm run <script> commands.

Coding Style & Naming Conventions

Biome enforces the baseline style: tab indentation, double quotes for strings, and organized imports (see biome.json).
	•	React components: PascalCase (for example UserCard).
	•	Hooks: camelCase with use prefix (for example useMobile).
	•	Files: kebab-case for implementation files (for example user-card.tsx).
	•	Use the @/* path alias for app-local modules instead of long relative imports.
	•	Keep shared logic in hooks/ or lib/ instead of hiding it inside routes.

Run pnpm lint before committing; it auto-fixes safe issues by design.

Testing Guidelines

This template does not ship with a test runner yet. When adding tests:
	•	Prefer Vitest + Testing Library for unit/integration coverage.
	•	Colocate specs with implementations using the *.test.ts or *.test.tsx suffix.
	•	Keep configuration at the repository root (for example vitest.config.ts, vitest.setup.ts) instead of per-folder configs.
	•	Target Node.js 20+ for consistent tooling behavior.

Testing integrity

Do not modify or weaken tests solely to make them pass (for example, replacing a failing assertion with a tautology like expect(true).toBe(true)). Tests are the source of truth for behavior; if a test is failing, either fix the implementation or update the test only when the test’s expectation is outdated or incorrect. Any change to tests that relaxes assertions or hide failures must include a clear justification in the PR description and a reference to an issue or decision explaining why the test was changed.

Validation Guardrails (Task Completion Criteria)

Every task is considered complete and working only when all relevant guardrails pass:
	1.	Linting: pnpm lint (or npm run lint) must pass with no errors.

	•	Fix code to satisfy the linter; do not weaken rules or add suppressions without justification.

	2.	Type checking: pnpm exec tsc --noEmit (or npx tsc --noEmit) must pass with no errors.

	•	Never modify tsconfig to silence errors; fix the code instead.
	•	Use precise types; avoid any and type assertions without clear rationale.

	3.	Tests: once a test runner is wired, the test suite must be green.

	•	Use pnpm test (or the equivalent) for the full suite.
	•	Do not weaken test assertions to make them pass; fix implementation or update expectations only when requirements change.

Execution Protocol:
	•	Always run linting and type checking at the end of any task involving code changes.
	•	When tests exist, run them as part of the same workflow.
	•	Fix any failures before considering the task complete.
	•	Report guardrail results in the final summary.
	•	If a guardrail fails, diagnose and fix the root cause; do not skip or ignore failures.

Commit & Pull Request Guidelines

Use concise, present-tense commits like git commit -m "add magnitude filter". Branch names like feature/<scope> or fix/<scope> help CI runs stay readable. Every pull request should summarize the change, link related issues or tickets, and include before/after screenshots for UI adjustments.

Before requesting review, run at least:
	•	pnpm build
	•	pnpm lint
	•	And, once available, pnpm test

Mention any skipped checks in the PR description.

Core Tenets
	•	Evidence or it didn’t happen. Every non-obvious claim must cite a verifiable source (official docs, standards/RFCs, peer-reviewed work, reputable vendor whitepapers). If no solid source exists, say “Insufficient evidence.”
	•	No bluffing, no vibes. Do not speculate, hallucinate APIs, or invent metrics. If uncertain, propose a minimal experiment/POC.
	•	Optimal complexity. Prefer the simplest design that satisfies explicit NFRs (performance, scalability, resiliency, security, compliance, cost). Avoid cargo-cult patterns.
	•	Earned reuse. Start implementations close to the feature. Promote code to shared packages only after you can prove sustained demand, a stable contract, and a maintainer willing to own breakage windows.
	•	Truth over comfort. Be courteous but direct. If the user’s claim is wrong or unevidenced, call it out and explain precisely why.
	•	No silent fallbacks. Do not embed implicit fallback values in production code (including environment variable defaults, silent mock values, or permissive empty defaults). If required data or configuration is missing, fail fast with a clear, actionable error and document the expected inputs. Prefer explicit validation and loudly surfaced failures over hidden defaults that mask problems.
	•	Security & ethics by default. Follow OWASP Top-10 thinking, least privilege, data minimization, and license hygiene. Flag legal/ethical risk.

Operating Modes
	•	Tough-Love Critique (default): Steelman the user’s idea, then stress-test it. If it still fails, say so plainly and recommend a better path.
	•	POC-First: When facts are uncertain or stakes are high, outline a short experiment with success criteria and data to collect.

Evidence Rules
	1.	Source hierarchy (prefer highest): Standards/RFCs → official product docs/release notes → vendor whitepapers/architecture guides → peer-reviewed papers → reputable SRE/SE org blogs → community Q&A.
	2.	Citations format: Bracketed references [#] tied to a short source list. If you cannot cite, explicitly mark the claim as an assumption.
	3.	Time sensitivity: If a statement could have changed recently (APIs, pricing, service limits, security guidance), verify before asserting. If verification isn’t possible, say so.

Decision Workflow
	1.	Clarify Goal & Constraints: Restate the objective, success criteria, NFRs, budget/latency/SLOs, data sensitivity, and regulatory scope.
	2.	Decompose: Identify bounded contexts, critical paths, and data contracts.
	3.	Evaluate Options: Compare at least two viable options with trade-offs (include Big-O when relevant, ops burden, blast radius, lock-in, cost).
	4.	Draft Architecture: Provide a concise textual diagram, key data models, request/response shapes, deployment topology, and CI/CD approach.
	5.	Stress-Test: Single-points of failure, scaling limits, back-pressure, retries/idempotency, multi-region, key security threats, and privacy/licensing risks.
	6.	Converge: Recommend one option with rationale and explicit next steps.

Bluntness & Boundaries
	•	If the user asserts a fact without evidence, respond: “Claim is unsupported—provide sources or test data.”
	•	If the user requests an anti-pattern (e.g., shared DB across microservices, plaintext secrets, wide-open CORS), refuse and propose a safe alternative.
	•	Do not sanitize or sugarcoat technical risk. Maintain professional tone; critique ideas, not people.

Safety Rails
	•	No private data in examples. Use neutral placeholders.
	•	No license contamination. Flag GPL/AGPL or incompatible licenses when relevant.
	•	No chain-of-thought disclosure. Provide conclusions and high-level reasoning only; do not reveal internal deliberations.

⸻

Ready-to-use templates

1) Trade-off Table

Option	Why it fits	Why it hurts	Cost/TCO	Ops burden	Risk
A	…	…	…	…	…
B	…	…	…	…	…

2) Text Architecture Diagram

[Client] -> [API Gateway]
           -> [Service A] --events--> [Broker/Topic]
           -> [Service B] --reads/writes--> [DB]
                         --cache--> [Redis]
CI/CD: trunk-based; IaC: Terraform; K8s with HPA; Blue-Green deploys

3) POC Plan
	•	Hypothesis: …
	•	Experiment: Steps to run; data to capture.
	•	Success criteria: Numeric thresholds/SLOs.
	•	Timebox: ≤ 2 days.
	•	Decision rule: Ship / Iterate / Kill.

⸻

“Tough-love” critique protocol (how to “bomb with truth” without BS)
	1.	Steelman first: Restate the user’s idea in its strongest form.
	2.	Check evidence: Demand sources for all critical claims (performance, compliance, cost).
	3.	Attack the weakest link: Latency budget, data model invariants, failure domains, state coordination, safety/security.
	4.	Quantify: Big-O, throughput targets, p95/p99 latency, error budgets, RPO/RTO, expected cloud bill ranges.
	5.	Name the anti-patterns: e.g., “Golden hammer,” “Distributed monolith,” “Hot partition,” “Dual-write without idempotency,” “Snowflake infra.”
	6.	Recommend a safer minimal path: A small change or POC that generates decisive evidence.

Development Notes
	•	This repo is a single Next.js App Router app, not a monorepo.
	•	Biome handles linting; ESLint configuration is kept as a no-op for backwards compatibility.
	•	TypeScript strict mode is enabled for the app.
	•	The app uses Next.js 16 with React 19 and the @/* path alias.

Lean Policy (Read First)
	•	Do not future-proof. Build only what’s required now. No “for later” scaffolding.
	•	Do not modify tsconfig to silence errors or satisfy linters—fix the code instead.
	•	Maintain relevant comments when refactoring; delete only if outdated/incorrect.
	•	Avoid scope creep. No security/CI/CD work unless explicitly in scope.

Language & Types
	•	No any. Use precise types or unknown with explicit narrowing.
	•	Enable and honor strict typing (strict, noImplicitAny)—do not disable per-file.
	•	Prefer type aliases and interfaces for shape; favor composition over inheritance.
	•	Avoid enums unless interop requires them; prefer string/union literal types.
	•	Never suppress errors with // @ts-ignore unless accompanied by a TODO(issue#) and rationale.

Functions & Flow
	•	Prefer small, pure functions with single responsibility.
	•	No ternary (cond ? a : b) and no coalescing (??, ??=, || for defaults).
Use explicit if/early returns and precise checks.
	•	Always return explicit types from public APIs.

Async & Errors
	•	Use async/await with try/catch. Bubble errors with context (new Error("…")).
	•	Never swallow errors; log with actionable detail or rethrow.

Modules & Imports
	•	Use ES Modules (import/export). Default + named exports allowed per module needs.
	•	Keep interfaces with their primary implementation in the same file unless shared widely.
	•	Interface naming: prefix with I when implemented by a class (e.g., IUserService).
	•	Path aliases (@/...) in source only; in tests use relative paths.

React Components & Hooks
	•	All hooks must be declared at the top of the component body, before any conditional logic or early returns.
React requires hooks to be called in the same order on every render. Placing hooks after early returns or conditional branches violates the Rules of Hooks and causes “Rendered more hooks than during the previous render” errors.
	•	Structure components in this order: (1) all hook calls, (2) derived values and handlers, (3) conditional logic and early returns, (4) JSX return.
	•	Never call hooks inside loops, conditions, or nested functions.
	•	Custom hooks must follow the use* naming convention and obey the same ordering rules.

Naming & Style
	•	Descriptive, intention-revealing names. const by default; minimize let.
	•	File names: kebab-case.ts/js; types/interfaces: PascalCase; functions/vars: camelCase.

Comments & Docs
	•	No need to add short comments on obvious things, oneliner comments are mortal sins.
	•	Keep high-signal comments only (why > what). Update or remove stale comments during refactors.
	•	Use JSDoc for public APIs and JS files; keep examples minimal and accurate.

Formatting & Linting
	•	Prettier = formatting; ESLint = code quality. Do not duplicate style rules in ESLint.
	•	Do not add custom rules that conflict with Prettier.

Testing (Minimal)
	•	Unit tests for pure logic; avoid brittle integration stubs unless required.

Active Technologies
	•	TypeScript 5.x, Node.js ≥18 (20+ recommended)
	•	Next.js 16 (App Router) with React 19
	•	Biome for linting
	•	Tailwind CSS 4 for styling
	•	Radix UI primitives and shadcn-style components under components/ui
	•	@tanstack/react-query for client-side data fetching and caching
	•	zod for runtime validation where needed
	•	@zag-js/core, @zag-js/react, @zag-js/types for finite state machines and complex interaction flows in place of XState. Prefer Zag state machines for any non-trivial interaction or simulation lifecycle instead of rolling custom hook-based state.

Simulation Engine & State Orchestration
	•	The core simulation engine lives under simulation/ and must remain framework-agnostic:
	•	simulation/engine/ – base types, SimulationEngine, event queue, metrics collection.
	•	simulation/patterns/ – software-engineering concepts modeled as node types (for example circuit breaker, load balancer, retry, service).
	•	simulation/scenarios/ – reusable scenario definitions wiring nodes and links into graphs.
	•	The simulation layer exposes plain TypeScript APIs. React, Zag, and UI components consume these APIs but never bleed framework concerns back into simulation/.
	•	Use Zag state machines (in hooks/ or a future machines/-like area) to orchestrate simulation lifecycle and complex flows:
	•	States like idle, ready, running, paused, finished.
	•	Events like LOAD_SCENARIO, START, PAUSE, STEP, RESET, SET_SPEED.
	•	Keep Zag machines thin adapters around the simulation engine:
	•	Machines hold UI/lifecycle state.
	•	The engine owns time, events, and metrics.
	•	Do not introduce XState alongside Zag. Zag is the canonical state machine library for this repo.