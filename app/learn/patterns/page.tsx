import Link from "next/link";
import { listGuides } from "@/lib/mdx";

export default function PatternsIndexPage() {
	const guides = listGuides("guides");
	const totalGuides = guides.length;

	return (
		<main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 px-4 py-12 text-slate-200 md:px-10 md:py-16">
			<div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
				<section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur">
					<nav className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
						<Link
							href="/"
							className="text-sky-300 transition hover:text-sky-100"
						>
							Simulator
						</Link>
						<span>/</span>
						<span className="text-slate-200">Patterns</span>
					</nav>
					<div className="mt-6 space-y-4">
						<div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1 text-xs font-semibold tracking-wide text-slate-200">
							<span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
							{totalGuides} resilience patterns
						</div>
						<h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
							Resilience Patterns
						</h1>
						<p className="max-w-3xl text-base text-slate-200">
							Mini field guides covering the throttles, fallbacks, and isolation
							tricks used in the simulator. Each entry explains the problem, the
							control loop, failure modes, and how the sim animates it.
						</p>
					</div>
					<div className="mt-8 grid gap-6 text-sm text-slate-300 md:grid-cols-3">
						<div className="rounded-2xl border border-white/10 bg-white/5 p-4">
							<p className="text-xs uppercase tracking-[0.3em] text-slate-400">
								Why
							</p>
							<p className="mt-2 text-base text-slate-100">
								Cut failure blast radius with proven patterns.
							</p>
						</div>
						<div className="rounded-2xl border border-white/10 bg-white/5 p-4">
							<p className="text-xs uppercase tracking-[0.3em] text-slate-400">
								How
							</p>
							<p className="mt-2 text-base text-slate-100">
								Step-by-step explanations plus Mermaid diagrams.
							</p>
						</div>
						<div className="rounded-2xl border border-white/10 bg-white/5 p-4">
							<p className="text-xs uppercase tracking-[0.3em] text-slate-400">
								In the sim
							</p>
							<p className="mt-2 text-base text-slate-100">
								See how each control shows up in the visual flow.
							</p>
						</div>
					</div>
				</section>

				<section className="grid gap-6 md:grid-cols-2">
					{guides.map((guide) => (
						<Link
							key={guide.slug}
							href={`/learn/patterns/${guide.slug}`}
							className="group rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-800/80 p-6 shadow-xl shadow-slate-950/30 transition hover:-translate-y-1 hover:border-sky-400/60"
						>
							<div className="flex items-start justify-between">
								<div>
									<p className="text-sm uppercase tracking-[0.3em] text-slate-400">
										Guide
									</p>
									<h2 className="mt-2 text-2xl font-semibold text-white">
										{guide.frontmatter.title}
									</h2>
								</div>
								<span className="rounded-full bg-slate-800/80 px-3 py-1 text-xs font-semibold text-sky-300">
									Open ↗
								</span>
							</div>
							<p className="mt-4 text-base leading-7 text-slate-200">
								{guide.frontmatter.tagline}
							</p>
							<div className="mt-6 text-sm font-semibold text-sky-300">
								Explore the pattern →
							</div>
						</Link>
					))}
				</section>
			</div>
		</main>
	);
}
