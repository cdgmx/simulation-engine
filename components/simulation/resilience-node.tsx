"use client";

import type { Node, NodeProps } from "reactflow";

export type ResilienceNodeData = {
	title: string;
	subtitle: string;
};

export type ResilienceNode = Node<ResilienceNodeData, "resilienceNode">;

export function ResilienceNodeComponent({
	data,
}: NodeProps<ResilienceNodeData>) {
	return (
		<div className="rounded-2xl border border-emerald-900/60 bg-slate-900/80 px-4 py-2 shadow-sm">
			<div className="text-sm font-semibold text-slate-100">{data.title}</div>
			<div className="mt-0.5 text-xs text-slate-400">{data.subtitle}</div>
		</div>
	);
}
