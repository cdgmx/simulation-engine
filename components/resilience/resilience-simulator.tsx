"use client";

import { motion } from "framer-motion";
import {
	ChevronDown,
	ChevronUp,
	Info,
	Pause,
	Play,
	RefreshCw,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { useResilienceSimulator } from "@/hooks/use-resilience-simulator";
import { useResilienceStore } from "@/hooks/use-resilience-store";
import { HeroFlow } from "./hero-flow";
import { ResilienceCharts } from "./resilience-charts";
import { ResilienceControls } from "./resilience-controls";
import { ResilienceMetrics } from "./resilience-metrics";
import { SimulationStatus } from "./simulation-status";

interface ResilienceSimulatorProps {
	guideRail?: ReactNode;
}

const WHAT_IS_THIS = `This simulation demonstrates how microservices protect themselves from cascading failures.
Watch requests (colored dots) flow through the system. When failures occur, resilience patterns like circuit breakers and rate limiters activate to prevent total system collapse.`;

const LEGEND_ITEMS = [
	{ color: "bg-sky-400", label: "Pending request" },
	{ color: "bg-emerald-400", label: "Success" },
	{ color: "bg-red-400", label: "Failed" },
	{ color: "bg-amber-400", label: "Timeout" },
	{ color: "bg-violet-400", label: "Rejected (rate limited)" },
	{ color: "bg-orange-400", label: "Retrying" },
];

export function ResilienceSimulator({ guideRail }: ResilienceSimulatorProps) {
	const { snapshot, isRunning, start, pause, reset } = useResilienceSimulator();
	const config = useResilienceStore((state) => state.config);
	const [showInfo, setShowInfo] = useState(false);
	const [showControls, setShowControls] = useState(true);

	const actionHandler = () => {
		if (isRunning) {
			pause();
		} else {
			start();
		}
	};

	return (
		<div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
			{/* Header */}
			<header className="border-b border-slate-800/60 bg-slate-900/50 backdrop-blur-sm">
				<div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
					<div className="flex items-center gap-3">
						<h1 className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-xl font-bold text-transparent">
							Microservice Resilience Simulator
						</h1>
						<button
							type="button"
							onClick={() => setShowInfo(!showInfo)}
							className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
							aria-label="What is this?"
						>
							<Info size={16} />
						</button>
					</div>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={actionHandler}
							className={`flex items-center gap-2 rounded-lg px-4 py-2 font-semibold text-white transition-colors ${
								isRunning
									? "bg-amber-600 hover:bg-amber-500"
									: "bg-emerald-600 hover:bg-emerald-500"
							}`}
						>
							{isRunning ? <Pause size={16} /> : <Play size={16} />}
							<span>{isRunning ? "Pause" : "Start"}</span>
						</button>
						<button
							type="button"
							onClick={reset}
							className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500 hover:text-white"
						>
							<RefreshCw size={14} />
							<span>Reset</span>
						</button>
					</div>
				</div>

				{/* Info panel */}
				{showInfo && (
					<motion.div
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: "auto" }}
						exit={{ opacity: 0, height: 0 }}
						className="border-t border-slate-800/60 bg-slate-900/80 px-4 py-3"
					>
						<div className="mx-auto max-w-7xl">
							<p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
								{WHAT_IS_THIS}
							</p>
							<div className="mt-3 flex flex-wrap gap-4">
								{LEGEND_ITEMS.map((item) => (
									<div
										key={item.label}
										className="flex items-center gap-2 text-xs text-slate-400"
									>
										<div className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
										<span>{item.label}</span>
									</div>
								))}
							</div>
						</div>
					</motion.div>
				)}
			</header>

			{/* Main content */}
			<main className="flex flex-1 flex-col lg:flex-row">
				{/* Sidebar controls */}
				<aside
					className={`border-b border-slate-800/60 bg-slate-900/30 lg:border-b-0 lg:border-r lg:w-80 ${
						showControls ? "" : "lg:w-auto"
					}`}
				>
					<button
						type="button"
						onClick={() => setShowControls(!showControls)}
						className="flex w-full items-center justify-between border-b border-slate-800/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:bg-slate-800/30 lg:hidden"
					>
						<span>Controls</span>
						{showControls ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
					</button>
					<div
						className={`${showControls ? "block" : "hidden"} p-4 lg:block lg:max-h-[calc(100vh-60px)] lg:overflow-y-auto`}
					>
						<ResilienceControls />
						{guideRail && (
							<div className="mt-6 border-t border-slate-800/40 pt-6">
								{guideRail}
							</div>
						)}
					</div>
				</aside>

				{/* Hero canvas area */}
				<div className="flex flex-1 flex-col">
					{/* Live status */}
					<div className="border-b border-slate-800/40 bg-slate-900/20 px-6 py-4">
						<SimulationStatus
							snapshot={snapshot}
							config={config}
							isRunning={isRunning}
						/>
					</div>

					{/* Hero flow visualization */}
					<div className="relative flex-1 min-h-[500px] lg:min-h-[600px]">
						<HeroFlow snapshot={snapshot} config={config} />

						{/* Overlay instructions when paused and no requests */}
						{!isRunning && snapshot.requests.length === 0 && (
							<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
								<motion.div
									initial={{ opacity: 0, scale: 0.95 }}
									animate={{ opacity: 1, scale: 1 }}
									className="rounded-2xl border border-slate-700/50 bg-slate-900/90 px-8 py-6 text-center backdrop-blur-sm"
								>
									<div className="text-lg font-semibold text-slate-200">
										Click Start to begin the simulation
									</div>
									<p className="mt-2 max-w-sm text-sm text-slate-400">
										Watch how requests flow through the system and how
										resilience patterns protect against failures.
									</p>
								</motion.div>
							</div>
						)}
					</div>

					{/* Metrics strip */}
					<div className="border-t border-slate-800/40 bg-slate-900/30 px-6 py-5">
						<ResilienceMetrics snapshot={snapshot} />
					</div>

					{/* Charts */}
					<div className="border-t border-slate-800/40 bg-slate-900/20 px-6 py-5">
						<ResilienceCharts />
					</div>
				</div>
			</main>
		</div>
	);
}
