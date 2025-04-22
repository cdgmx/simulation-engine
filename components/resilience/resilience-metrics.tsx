"use client";

import { motion } from "framer-motion";
import type { SimulationSnapshot } from "@/simulation/resilience/types";

interface MetricsProps {
	snapshot: SimulationSnapshot;
}

function formatNumber(value: number, fractionDigits = 1) {
	return value.toFixed(fractionDigits);
}

function getBreakerClass(state: SimulationSnapshot["cbState"]) {
	if (state === "OPEN") {
		return "text-red-500";
	}
	if (state === "HALF_OPEN") {
		return "text-amber-400";
	}
	return "text-emerald-400";
}

export function ResilienceMetrics({ snapshot }: MetricsProps) {
	const failureRps =
		(snapshot.metrics.failed +
			snapshot.metrics.timedOut +
			snapshot.metrics.rejected) /
		2;
	const cards = [
		{
			label: "Success RPS",
			value: formatNumber(snapshot.metrics.throughput),
			accent: "text-emerald-400",
			helper: "live",
		},
		{
			label: "Fail RPS",
			value: formatNumber(failureRps),
			accent: "text-red-400",
			helper: "live",
		},
		{
			label: "Avg Latency",
			value: `${snapshot.metrics.avgLatency.toFixed(0)} ms`,
			accent: "text-amber-400",
			helper: "window",
		},
		{
			label: "Queue Depth",
			value: snapshot.metrics.queueLength.toString(),
			accent: "text-sky-400",
			helper: "in-flight",
		},
	];

	return (
		<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
			{cards.map((card, index) => (
				<motion.div
					key={card.label}
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: index * 0.08, duration: 0.4 }}
					className="rounded-xl border border-slate-800 bg-slate-900 p-4"
				>
					<div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
						{card.label}
					</div>
					<div className={`text-2xl font-mono ${card.accent}`}>
						{card.value}
					</div>
					<div className="text-[11px] uppercase tracking-widest text-slate-500">
						{card.helper}
					</div>
				</motion.div>
			))}
			<motion.div
				initial={{ opacity: 0, y: 12 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.4, delay: 0.32 }}
				className="rounded-xl border border-slate-800 bg-slate-900 p-4"
			>
				<div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
					Circuit Breaker
				</div>
				<div
					className={`text-xl font-bold ${getBreakerClass(snapshot.cbState)}`}
				>
					{snapshot.cbState}
				</div>
				<div className="text-[11px] uppercase tracking-widest text-slate-500">
					Failures: {snapshot.cbFailures}
				</div>
			</motion.div>
		</div>
	);
}
