"use client";

import { motion } from "framer-motion";
import {
	AlertTriangle,
	CheckCircle2,
	Clock,
	Gauge,
	Pause,
	ShieldAlert,
	ShieldCheck,
} from "lucide-react";
import { useMemo } from "react";
import type {
	SimulationConfig,
	SimulationSnapshot,
} from "@/simulation/resilience/types";

interface SimulationStatusProps {
	snapshot: SimulationSnapshot;
	config: SimulationConfig;
	isRunning: boolean;
}

type StatusSeverity = "info" | "success" | "warning" | "danger";

interface StatusItem {
	icon: React.ReactNode;
	message: string;
	severity: StatusSeverity;
	priority: number;
}

function getSeverityClasses(severity: StatusSeverity): string {
	switch (severity) {
		case "success":
			return "bg-emerald-500/10 border-emerald-500/30 text-emerald-300";
		case "warning":
			return "bg-amber-500/10 border-amber-500/30 text-amber-300";
		case "danger":
			return "bg-red-500/10 border-red-500/30 text-red-300";
		default:
			return "bg-sky-500/10 border-sky-500/30 text-sky-300";
	}
}

function getPrimaryStatus(
	snapshot: SimulationSnapshot,
	config: SimulationConfig,
	isRunning: boolean,
): StatusItem {
	if (!isRunning) {
		return {
			icon: <Pause size={16} />,
			message:
				"Simulation paused. Click Start to see requests flow through the system.",
			severity: "info",
			priority: 0,
		};
	}

	if (snapshot.cbState === "OPEN") {
		return {
			icon: <ShieldAlert size={16} />,
			message: `Circuit breaker is OPEN — all requests are blocked after ${snapshot.cbFailures} consecutive failures`,
			severity: "danger",
			priority: 10,
		};
	}

	if (snapshot.cbState === "HALF_OPEN") {
		return {
			icon: <ShieldCheck size={16} />,
			message:
				"Circuit breaker is testing recovery — allowing limited probe requests",
			severity: "warning",
			priority: 9,
		};
	}

	const failRate =
		snapshot.metrics.failed +
		snapshot.metrics.timedOut +
		snapshot.metrics.rejected;
	const total = failRate + snapshot.metrics.success;

	if (total > 5) {
		const failPercent = (failRate / total) * 100;
		if (failPercent > 50) {
			return {
				icon: <AlertTriangle size={16} />,
				message: `High failure rate detected: ${failPercent.toFixed(0)}% of requests are failing`,
				severity: "danger",
				priority: 8,
			};
		}
		if (failPercent > 20) {
			return {
				icon: <AlertTriangle size={16} />,
				message: `Elevated failure rate: ${failPercent.toFixed(0)}% of requests are experiencing issues`,
				severity: "warning",
				priority: 7,
			};
		}
	}

	if (config.rateLimiterEnabled && snapshot.bucketTokens < 2) {
		return {
			icon: <Gauge size={16} />,
			message: `Rate limiter is throttling traffic — only ${Math.floor(snapshot.bucketTokens)} tokens available`,
			severity: "warning",
			priority: 6,
		};
	}

	if (
		snapshot.metrics.avgLatency > config.timeoutMs * 0.9 &&
		snapshot.metrics.success > 0
	) {
		return {
			icon: <Clock size={16} />,
			message: `High latency detected: ${snapshot.metrics.avgLatency.toFixed(0)}ms average (near ${config.timeoutMs}ms timeout)`,
			severity: "warning",
			priority: 5,
		};
	}

	return {
		icon: <CheckCircle2 size={16} />,
		message:
			"System operating normally — requests are flowing through successfully",
		severity: "success",
		priority: 1,
	};
}

export function SimulationStatus({
	snapshot,
	config,
	isRunning,
}: SimulationStatusProps) {
	const status = useMemo(
		() => getPrimaryStatus(snapshot, config, isRunning),
		[snapshot, config, isRunning],
	);

	return (
		<motion.div
			key={status.severity}
			initial={{ opacity: 0, y: -5 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3 }}
			className={`inline-flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm font-medium ${getSeverityClasses(status.severity)}`}
		>
			{status.icon}
			<span>{status.message}</span>
		</motion.div>
	);
}
