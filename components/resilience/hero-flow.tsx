"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactFlow, {
	Background,
	type Edge,
	type Node,
	ReactFlowProvider,
	useReactFlow,
} from "reactflow";
import type {
	SimulationConfig,
	SimulationSnapshot,
} from "@/simulation/resilience/types";
import { RequestParticles } from "./request-particles";
import "reactflow/dist/style.css";

interface HeroFlowProps {
	snapshot: SimulationSnapshot;
	config: SimulationConfig;
}

type StatusNodeData = {
	label: string;
	subtitle: string;
	status: "active" | "warning" | "danger" | "disabled";
};

function StatusNode({ data }: { data: StatusNodeData }) {
	const statusColors = {
		active: "border-emerald-500/50 bg-emerald-500/10",
		warning: "border-amber-500/50 bg-amber-500/10",
		danger: "border-red-500/50 bg-red-500/10",
		disabled: "border-slate-600/50 bg-slate-800/50",
	};

	const dotColors = {
		active: "bg-emerald-400",
		warning: "bg-amber-400",
		danger: "bg-red-400",
		disabled: "bg-slate-500",
	};

	return (
		<div
			className={`relative rounded-xl border-2 px-5 py-3 shadow-lg backdrop-blur-sm ${statusColors[data.status]}`}
		>
			<div
				className={`absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full ${dotColors[data.status]} ${data.status === "active" ? "animate-pulse" : ""}`}
			/>
			<div className="text-sm font-semibold text-slate-100">{data.label}</div>
			<div className="mt-0.5 text-xs text-slate-400">{data.subtitle}</div>
		</div>
	);
}

const nodeTypes = {
	statusNode: StatusNode,
};

function HeroFlowInner({ snapshot, config }: HeroFlowProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [dimensions, setDimensions] = useState({ width: 800, height: 300 });
	const { fitView } = useReactFlow();

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				setDimensions({
					width: entry.contentRect.width,
					height: entry.contentRect.height,
				});
			}
		});

		observer.observe(container);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		const timer = setTimeout(() => fitView({ padding: 0.2 }), 100);
		return () => clearTimeout(timer);
	}, [fitView]);

	const getNodeStatus = useCallback(
		(nodeId: string): "active" | "warning" | "danger" | "disabled" => {
			switch (nodeId) {
				case "rate-limiter":
					if (!config.rateLimiterEnabled) return "disabled";
					if (snapshot.bucketTokens < 2) return "warning";
					return "active";
				case "circuit-breaker":
					if (!config.circuitBreakerEnabled) return "disabled";
					if (snapshot.cbState === "OPEN") return "danger";
					if (snapshot.cbState === "HALF_OPEN") return "warning";
					return "active";
				case "gateway":
					if (snapshot.metrics.avgLatency > config.timeoutMs * 0.8)
						return "warning";
					return "active";
				case "service":
					if (config.serviceBFailureRate > 0.3) return "danger";
					if (config.serviceBFailureRate > 0.1) return "warning";
					return "active";
				default:
					return "active";
			}
		},
		[config, snapshot],
	);

	const nodes: Node<StatusNodeData>[] = [
		{
			id: "client",
			type: "statusNode",
			position: { x: 0, y: 100 },
			data: {
				label: "Client",
				subtitle: `${config.rps} req/s`,
				status: "active",
			},
		},
		{
			id: "rate-limiter",
			type: "statusNode",
			position: { x: 200, y: 100 },
			data: {
				label: "Rate Limiter",
				subtitle: config.rateLimiterEnabled
					? `${Math.floor(snapshot.bucketTokens)} tokens`
					: "disabled",
				status: getNodeStatus("rate-limiter"),
			},
		},
		{
			id: "circuit-breaker",
			type: "statusNode",
			position: { x: 400, y: 100 },
			data: {
				label: "Circuit Breaker",
				subtitle: config.circuitBreakerEnabled
					? `${snapshot.cbState.toLowerCase()} (${snapshot.cbFailures})`
					: "disabled",
				status: getNodeStatus("circuit-breaker"),
			},
		},
		{
			id: "gateway",
			type: "statusNode",
			position: { x: 600, y: 100 },
			data: {
				label: "Gateway",
				subtitle: `${snapshot.metrics.avgLatency.toFixed(0)}ms avg`,
				status: getNodeStatus("gateway"),
			},
		},
		{
			id: "service",
			type: "statusNode",
			position: { x: 800, y: 100 },
			data: {
				label: "Service B",
				subtitle: `${(config.serviceBFailureRate * 100).toFixed(0)}% fail rate`,
				status: getNodeStatus("service"),
			},
		},
	];

	const edges: Edge[] = [
		{
			id: "e1",
			source: "client",
			target: "rate-limiter",
			animated: true,
			style: { stroke: "#64748b", strokeWidth: 2 },
		},
		{
			id: "e2",
			source: "rate-limiter",
			target: "circuit-breaker",
			animated: config.rateLimiterEnabled,
			style: {
				stroke: config.rateLimiterEnabled ? "#64748b" : "#475569",
				strokeWidth: 2,
			},
		},
		{
			id: "e3",
			source: "circuit-breaker",
			target: "gateway",
			animated: snapshot.cbState !== "OPEN",
			style: {
				stroke: snapshot.cbState === "OPEN" ? "#ef4444" : "#64748b",
				strokeWidth: 2,
			},
		},
		{
			id: "e4",
			source: "gateway",
			target: "service",
			animated: true,
			style: { stroke: "#64748b", strokeWidth: 2 },
		},
	];

	return (
		<div ref={containerRef} className="relative h-full w-full">
			<ReactFlow
				nodes={nodes}
				edges={edges}
				nodeTypes={nodeTypes}
				fitView
				fitViewOptions={{ padding: 0.2 }}
				panOnScroll={false}
				zoomOnScroll={false}
				zoomOnPinch={false}
				panOnDrag={false}
				nodesDraggable={false}
				nodesConnectable={false}
				elementsSelectable={false}
				defaultEdgeOptions={{
					type: "smoothstep",
				}}
				proOptions={{ hideAttribution: true }}
			>
				<Background color="#1e293b" gap={24} size={1} />
			</ReactFlow>
			<RequestParticles
				requests={snapshot.requests}
				width={dimensions.width}
				height={dimensions.height}
			/>
		</div>
	);
}

export function HeroFlow(props: HeroFlowProps) {
	return (
		<ReactFlowProvider>
			<HeroFlowInner {...props} />
		</ReactFlowProvider>
	);
}
