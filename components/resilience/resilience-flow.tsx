"use client";

import { useMemo } from "react";
import ReactFlow, { Background, Controls, type Edge } from "reactflow";
import {
	type ResilienceNode,
	ResilienceNodeComponent,
} from "@/components/simulation/resilience-node";
import type {
	SimulationConfig,
	SimulationSnapshot,
} from "@/simulation/resilience/types";
import "reactflow/dist/style.css";

const nodeTypes = {
	resilienceNode: ResilienceNodeComponent,
};

type ResilienceFlowNode = ResilienceNode;

interface Props {
	snapshot: SimulationSnapshot;
	config: SimulationConfig;
}

export function ResilienceFlow({ snapshot, config }: Props) {
	const { metrics, cbState, cbFailures, bucketTokens } = snapshot;

	const nodes = useMemo<ResilienceFlowNode[]>(() => {
		const rateLimiterSubtitle = config.rateLimiterEnabled
			? `${Math.floor(bucketTokens)} tokens`
			: "disabled";
		const breakerSubtitle = config.circuitBreakerEnabled
			? `${cbState.toLowerCase()} ${cbFailures}`
			: "off";
		return [
			{
				id: "client",
				type: "resilienceNode",
				position: { x: 0, y: 0 },
				data: {
					title: "Client",
					subtitle: `${config.rps} req/s`,
				},
			},
			{
				id: "rate-limiter",
				type: "resilienceNode",
				position: { x: 250, y: 0 },
				data: {
					title: "Rate Limiter",
					subtitle: rateLimiterSubtitle,
				},
			},
			{
				id: "circuit-breaker",
				type: "resilienceNode",
				position: { x: 500, y: 0 },
				data: {
					title: "Circuit Breaker",
					subtitle: breakerSubtitle,
				},
			},
			{
				id: "gateway",
				type: "resilienceNode",
				position: { x: 750, y: 0 },
				data: {
					title: "Gateway",
					subtitle: "Service A",
				},
			},
			{
				id: "shared-pool",
				type: "resilienceNode",
				position: { x: 1000, y: 0 },
				data: {
					title: "Shared Pool",
					subtitle: `${metrics.queueLength} in-flight`,
				},
			},
		];
	}, [
		bucketTokens,
		cbFailures,
		cbState,
		config.circuitBreakerEnabled,
		config.rateLimiterEnabled,
		config.rps,
		metrics.queueLength,
	]);

	const edges = useMemo<Edge[]>(
		() => [
			{ id: "e-client-rate", source: "client", target: "rate-limiter" },
			{ id: "e-rate-cb", source: "rate-limiter", target: "circuit-breaker" },
			{ id: "e-cb-gw", source: "circuit-breaker", target: "gateway" },
			{ id: "e-gw-pool", source: "gateway", target: "shared-pool" },
		],
		[],
	);

	return (
		<div className="h-64 w-full overflow-hidden rounded-3xl border border-slate-800/60 bg-slate-950/80">
			<ReactFlow
				nodes={nodes}
				edges={edges}
				nodeTypes={nodeTypes}
				fitView
				fitViewOptions={{ padding: 0.3 }}
				panOnScroll
				zoomOnScroll
				zoomOnPinch
			>
				<Background />
				<Controls />
			</ReactFlow>
		</div>
	);
}
