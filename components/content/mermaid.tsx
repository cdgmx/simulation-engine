"use client";

import mermaid from "mermaid";
import { useEffect, useRef, useState } from "react";

interface MermaidProps {
	chart: string;
	className?: string;
}

let mermaidInitialized = false;

function initMermaid() {
	if (mermaidInitialized) {
		return;
	}

	mermaid.initialize({
		startOnLoad: false,
		theme: "dark",
		themeVariables: {
			primaryColor: "#0ea5e9",
			primaryTextColor: "#f1f5f9",
			primaryBorderColor: "#38bdf8",
			lineColor: "#64748b",
			secondaryColor: "#1e293b",
			tertiaryColor: "#0f172a",
			background: "#020617",
			mainBkg: "#0f172a",
			secondBkg: "#1e293b",
			nodeBorder: "#38bdf8",
			clusterBkg: "#1e293b",
			clusterBorder: "#475569",
			titleColor: "#f1f5f9",
			edgeLabelBackground: "#1e293b",
			nodeTextColor: "#f1f5f9",
		},
		fontFamily: "inherit",
		securityLevel: "loose",
	});

	mermaidInitialized = true;
}

export function Mermaid({ chart, className }: MermaidProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [svg, setSvg] = useState<string>("");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		initMermaid();

		const renderChart = async () => {
			if (!containerRef.current) {
				return;
			}

			try {
				const id = `mermaid-${Math.random().toString(36).slice(2, 11)}`;
				const { svg: renderedSvg } = await mermaid.render(id, chart);
				setSvg(renderedSvg);
				setError(null);
			} catch (err) {
				const message =
					err instanceof Error ? err.message : "Failed to render diagram";
				setError(message);
				setSvg("");
			}
		};

		renderChart();
	}, [chart]);

	if (error) {
		return (
			<div className="rounded-lg border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-400">
				<p className="font-medium">Diagram render error</p>
				<pre className="mt-2 overflow-auto text-xs">{error}</pre>
			</div>
		);
	}

	return (
		<div
			ref={containerRef}
			className={className}
			// biome-ignore lint/security/noDangerouslySetInnerHtml: Mermaid SVG output is trusted
			dangerouslySetInnerHTML={{ __html: svg }}
		/>
	);
}
