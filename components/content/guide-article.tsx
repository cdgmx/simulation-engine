import Link from "next/link";
import type { ReactNode } from "react";
import type { GuideFrontmatter } from "@/lib/mdx";

interface BreadcrumbItem {
	label: string;
	href?: string;
}

interface GuideArticleProps {
	frontmatter: GuideFrontmatter;
	breadcrumbs: BreadcrumbItem[];
	children: ReactNode;
}

export function GuideArticle({
	frontmatter,
	breadcrumbs,
	children,
}: GuideArticleProps) {
	return (
		<main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 px-4 py-12 text-slate-200 md:px-8 md:py-16">
			<article className="mx-auto w-full max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur">
				<div className="mb-8 space-y-4">
					<nav className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs font-medium uppercase tracking-widest text-slate-400">
						{breadcrumbs.map((crumb, index) => {
							const isLast = index === breadcrumbs.length - 1;

							return (
								<span key={crumb.label} className="flex items-center gap-2">
									{index > 0 && <span>/</span>}
									{crumb.href && !isLast ? (
										<Link
											href={crumb.href}
											className="text-sky-300 transition hover:text-sky-200"
										>
											{crumb.label}
										</Link>
									) : (
										<span className="text-slate-200">{crumb.label}</span>
									)}
								</span>
							);
						})}
					</nav>
					<div>
						<p className="text-sm font-semibold text-sky-300">Guide</p>
						<h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
							{frontmatter.title}
						</h1>
						<p className="mt-3 max-w-2xl text-base text-slate-300">
							{frontmatter.tagline}
						</p>
					</div>
				</div>

				<div className="prose-custom">{children}</div>

				{frontmatter.resources && frontmatter.resources.length > 0 && (
					<section className="mt-12 space-y-4 border-t border-white/10 pt-8">
						<h2 className="text-lg font-semibold tracking-tight text-slate-50">
							Further reading
						</h2>
						<ul className="space-y-3 text-sm">
							{frontmatter.resources.map((resource) => (
								<li key={resource.url}>
									<a
										href={resource.url}
										target="_blank"
										rel="noopener noreferrer"
										className="inline-flex items-center gap-2 text-sky-300 transition hover:text-sky-200"
									>
										<span className="inline-block h-1 w-1 rounded-full bg-sky-400" />
										{resource.title}
									</a>
								</li>
							))}
						</ul>
					</section>
				)}
			</article>
		</main>
	);
}
