"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { getPatternGuide, type PatternId } from "@/lib/pattern-guides";

interface PatternInfoDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	pattern: PatternId;
}

export function PatternInfoDialog({
	open,
	onOpenChange,
	pattern,
}: PatternInfoDialogProps) {
	const guide = getPatternGuide(pattern);
	const howItWorks = guide.sections.find((section) => {
		if (section.heading.startsWith("How")) {
			return true;
		}
		return false;
	});
	const pitfalls = guide.sections.find(
		(section) => section.heading === "Common pitfalls",
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="text-xl">{guide.title}</DialogTitle>
					<DialogDescription className="text-base">
						{guide.tagline}
					</DialogDescription>
				</DialogHeader>

				<div className="flex items-center justify-between gap-3">
					<p className="text-sm text-slate-400">Quick overview</p>
					<Link
						href={`/learn/patterns/${guide.id}`}
						className="text-sm text-sky-400 hover:text-sky-300 hover:underline"
					>
						Open full guide
					</Link>
				</div>

				<div className="space-y-6">
					<div>
						<h3 className="mb-2 font-semibold text-slate-200">How it works</h3>
						<ul className="space-y-2 text-sm text-slate-300">
							{(howItWorks?.bullets || []).map((item) => (
								<li key={item} className="flex gap-2">
									<span className="text-emerald-400">•</span>
									<span>{item}</span>
								</li>
							))}
						</ul>
					</div>

					<div>
						<h3 className="mb-2 font-semibold text-slate-200">
							Common pitfalls
						</h3>
						<ul className="space-y-2 text-sm text-slate-300">
							{(pitfalls?.bullets || []).map((item) => (
								<li key={item} className="flex gap-2">
									<span className="text-sky-400">•</span>
									<span>{item}</span>
								</li>
							))}
						</ul>
					</div>

					<div>
						<h3 className="mb-2 font-semibold text-slate-200">Diagram</h3>
						<pre className="rounded-lg bg-slate-950 p-4 text-xs text-slate-300 overflow-x-auto">
							{guide.diagramAscii}
						</pre>
					</div>

					<div>
						<h3 className="mb-2 font-semibold text-slate-200">
							Further reading
						</h3>
						<ul className="space-y-2">
							{guide.resources.map((resource) => (
								<li key={resource.url}>
									<a
										href={resource.url}
										target="_blank"
										rel="noopener noreferrer"
										className="flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300 hover:underline"
									>
										<ExternalLink size={14} />
										<span>{resource.title}</span>
									</a>
								</li>
							))}
						</ul>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
