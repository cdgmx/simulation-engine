import Link from "next/link";
import { listGuides } from "@/lib/mdx";

const PATTERN_ORDER: string[] = [
	"timeout",
	"retry",
	"circuit-breaker",
	"rate-limit",
	"bulkhead",
];

const PATTERN_ICONS: Record<string, string> = {
	timeout: "⏱",
	retry: "🔄",
	"circuit-breaker": "⚡",
	"rate-limit": "🚦",
	bulkhead: "🛡",
};

function sortGuides<T extends { slug: string }>(guides: T[]): T[] {
	return [...guides].sort((a, b) => {
		const aIndex = PATTERN_ORDER.indexOf(a.slug);
		const bIndex = PATTERN_ORDER.indexOf(b.slug);
		const aOrder = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
		const bOrder = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
		if (aOrder !== bOrder) {
			return aOrder - bOrder;
		}
		return a.slug.localeCompare(b.slug);
	});
}

export function GuideRail() {
	const guides = sortGuides(listGuides("guides"));

	if (guides.length === 0) {
		return null;
	}

	return (
		<aside className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
					Learn the Patterns
				</h2>
				<Link
					href="/learn/patterns"
					className="text-xs font-medium text-sky-400 transition hover:text-sky-300"
				>
					View all →
				</Link>
			</div>

			<div className="flex flex-col gap-2">
				{guides.map((guide) => (
					<Link
						key={guide.slug}
						href={`/learn/patterns/${guide.slug}`}
						className="group flex items-start gap-3 rounded-xl border border-slate-800/60 bg-slate-900/50 p-3 transition hover:border-sky-500/40 hover:bg-slate-800/50"
					>
						<span
							className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800/80 text-base"
							aria-hidden="true"
						>
							{PATTERN_ICONS[guide.slug] ?? "📄"}
						</span>
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-2">
								<span className="text-sm font-semibold text-slate-100 group-hover:text-sky-300">
									{guide.frontmatter.title}
								</span>
							</div>
							<p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-400">
								{guide.frontmatter.tagline}
							</p>
						</div>
					</Link>
				))}
			</div>
		</aside>
	);
}
