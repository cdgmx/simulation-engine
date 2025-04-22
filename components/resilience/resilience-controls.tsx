"use client";

import { motion } from "framer-motion";
import {
	Activity,
	Clock,
	HelpCircle,
	Layers,
	RefreshCw,
	Shield,
	XCircle,
	Zap,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useResilienceStore } from "@/hooks/use-resilience-store";
import type { SimulationConfig } from "@/simulation/resilience/types";
import { PatternInfoDialog } from "./pattern-info-dialog";

const retryModes: Array<SimulationConfig["retryStrategy"]> = [
	"off",
	"fixed",
	"jitter",
];

type NumericConfigKey = {
	[Key in keyof SimulationConfig]: SimulationConfig[Key] extends number
		? Key
		: never;
}[keyof SimulationConfig];

function getRetryButtonClasses(
	current: SimulationConfig["retryStrategy"],
	candidate: SimulationConfig["retryStrategy"],
) {
	if (current === candidate) {
		return "text-[10px] px-2 py-1 rounded uppercase bg-indigo-600 text-white";
	}
	return "text-[10px] px-2 py-1 rounded uppercase bg-slate-800 text-slate-400 hover:bg-slate-700";
}

export function ResilienceControls() {
	const config = useResilienceStore((state) => state.config);
	const updateConfig = useResilienceStore((state) => state.updateConfig);
	const [openDialog, setOpenDialog] = useState<
		"circuit-breaker" | "rate-limit" | "bulkhead" | "retry" | "timeout" | null
	>(null);

	const handleSliderChange = (key: NumericConfigKey, values: number[]) => {
		if (values.length === 0) {
			return;
		}
		updateConfig(key, values[0] as SimulationConfig[NumericConfigKey]);
	};

	const toggleFlag = (key: keyof SimulationConfig) => {
		const current = config[key];
		if (typeof current === "boolean") {
			updateConfig(key, !current as SimulationConfig[typeof key]);
		}
	};

	return (
		<TooltipProvider>
			<motion.div
				initial={{ opacity: 0, y: 12 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.45 }}
				className="space-y-6"
			>
				<PatternInfoDialog
					open={openDialog !== null}
					onOpenChange={(open) => {
						if (!open) {
							setOpenDialog(null);
						}
					}}
					pattern={openDialog || "circuit-breaker"}
				/>
				<section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
					<div className="flex items-center gap-2 text-slate-200">
						<Activity size={18} className="text-blue-400" />
						<span className="font-semibold">Environment Stress</span>
					</div>
					<div className="space-y-4">
						<div>
							<div className="mb-1 flex justify-between text-xs">
								<span>Incoming Traffic (RPS)</span>
								<span className="text-blue-400">{config.rps} req/s</span>
							</div>
							<Slider
								min={1}
								max={50}
								step={1}
								value={[config.rps]}
								onValueChange={(value) => handleSliderChange("rps", value)}
							/>
						</div>
						<div>
							<div className="mb-1 flex justify-between text-xs">
								<span>Service B Latency Base</span>
								<span className="text-amber-400">
									{config.serviceBLatencyBase} ms
								</span>
							</div>
							<Slider
								min={20}
								max={2000}
								step={20}
								value={[config.serviceBLatencyBase]}
								onValueChange={(value) =>
									handleSliderChange("serviceBLatencyBase", value)
								}
							/>
						</div>
						<div>
							<div className="mb-1 flex justify-between text-xs">
								<span>Service B Failure Rate</span>
								<span className="text-red-400">
									{Math.round(config.serviceBFailureRate * 100)}%
								</span>
							</div>
							<Slider
								min={0}
								max={1}
								step={0.05}
								value={[config.serviceBFailureRate]}
								onValueChange={(value) =>
									handleSliderChange("serviceBFailureRate", value)
								}
							/>
						</div>
					</div>
				</section>

				<section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
					<div className="flex items-center gap-2 text-slate-200">
						<Shield size={18} className="text-emerald-400" />
						<span className="font-semibold">Resilience Patterns</span>
					</div>
					<div className="space-y-3">
						<div className="flex items-center justify-between rounded bg-slate-800/50 p-2">
							<div className="flex items-center gap-2 text-sm">
								<Clock size={16} className="text-slate-400" />
								<span>Client Timeout</span>
								<Tooltip>
									<TooltipTrigger asChild>
										<button
											type="button"
											onClick={() => setOpenDialog("timeout")}
											className="text-slate-500 hover:text-slate-300"
										>
											<HelpCircle size={14} />
										</button>
									</TooltipTrigger>
									<TooltipContent>
										<div className="max-w-xs space-y-2 text-xs">
											<p>Sets maximum wait time for operations.</p>
											<Link
												href="/learn/patterns/timeout"
												className="inline-flex text-sky-200 hover:text-sky-100 hover:underline"
											>
												Learn more →
											</Link>
										</div>
									</TooltipContent>
								</Tooltip>
							</div>
							<select
								className="rounded border border-slate-700 bg-slate-950 p-1 text-xs"
								value={config.timeoutMs}
								onChange={(event) =>
									updateConfig(
										"timeoutMs",
										Number(event.target.value) as SimulationConfig["timeoutMs"],
									)
								}
							>
								<option value={200}>Strict (200ms)</option>
								<option value={800}>Normal (800ms)</option>
								<option value={3000}>Lax (3s)</option>
							</select>
						</div>
						<div className="rounded bg-slate-800/50 p-2">
							<div className="mb-2 flex items-center justify-between text-sm">
								<div className="flex items-center gap-2">
									<RefreshCw size={16} className="text-slate-400" />
									<span>Retries</span>
									<Tooltip>
										<TooltipTrigger asChild>
											<button
												type="button"
												onClick={() => setOpenDialog("retry")}
												className="text-slate-500 hover:text-slate-300"
											>
												<HelpCircle size={14} />
											</button>
										</TooltipTrigger>
										<TooltipContent>
											<div className="max-w-xs space-y-2 text-xs">
												<p>
													Automatically retries failed requests with backoff.
												</p>
												<Link
													href="/learn/patterns/retry"
													className="inline-flex text-sky-200 hover:text-sky-100 hover:underline"
												>
													Learn more →
												</Link>
											</div>
										</TooltipContent>
									</Tooltip>
								</div>
							</div>
							<div className="flex gap-2">
								{retryModes.map((mode) => (
									<button
										key={mode}
										type="button"
										className={getRetryButtonClasses(
											config.retryStrategy,
											mode,
										)}
										onClick={() => updateConfig("retryStrategy", mode)}
									>
										{mode}
									</button>
								))}
							</div>
						</div>
						<div className="flex items-center justify-between rounded bg-slate-800/50 p-2">
							<div className="flex items-center gap-2 text-sm">
								<Zap size={16} className="text-slate-400" />
								<span>Circuit Breaker</span>
								<Tooltip>
									<TooltipTrigger asChild>
										<button
											type="button"
											onClick={() => setOpenDialog("circuit-breaker")}
											className="text-slate-500 hover:text-slate-300"
										>
											<HelpCircle size={14} />
										</button>
									</TooltipTrigger>
									<TooltipContent>
										<div className="max-w-xs space-y-2 text-xs">
											<p>
												Prevents cascading failures by failing fast when a
												dependency is unhealthy.
											</p>
											<Link
												href="/learn/patterns/circuit-breaker"
												className="inline-flex text-sky-200 hover:text-sky-100 hover:underline"
											>
												Learn more →
											</Link>
										</div>
									</TooltipContent>
								</Tooltip>
							</div>
							<Switch
								checked={config.circuitBreakerEnabled}
								onCheckedChange={() => toggleFlag("circuitBreakerEnabled")}
							/>
						</div>
						<div className="flex items-center justify-between rounded bg-slate-800/50 p-2">
							<div className="flex items-center gap-2 text-sm">
								<XCircle size={16} className="text-slate-400" />
								<span>Rate Limit</span>
								<Tooltip>
									<TooltipTrigger asChild>
										<button
											type="button"
											onClick={() => setOpenDialog("rate-limit")}
											className="text-slate-500 hover:text-slate-300"
										>
											<HelpCircle size={14} />
										</button>
									</TooltipTrigger>
									<TooltipContent>
										<div className="max-w-xs space-y-2 text-xs">
											<p>Controls request rate using a token bucket.</p>
											<Link
												href="/learn/patterns/rate-limit"
												className="inline-flex text-sky-200 hover:text-sky-100 hover:underline"
											>
												Learn more →
											</Link>
										</div>
									</TooltipContent>
								</Tooltip>
							</div>
							<Switch
								checked={config.rateLimiterEnabled}
								onCheckedChange={() => toggleFlag("rateLimiterEnabled")}
							/>
						</div>
						<div className="flex items-center justify-between rounded bg-slate-800/50 p-2">
							<div className="flex items-center gap-2 text-sm">
								<Layers size={16} className="text-slate-400" />
								<span>Bulkheads</span>
								<Tooltip>
									<TooltipTrigger asChild>
										<button
											type="button"
											onClick={() => setOpenDialog("bulkhead")}
											className="text-slate-500 hover:text-slate-300"
										>
											<HelpCircle size={14} />
										</button>
									</TooltipTrigger>
									<TooltipContent>
										<div className="max-w-xs space-y-2 text-xs">
											<p>
												Isolates resources to prevent one workload from
												affecting others.
											</p>
											<Link
												href="/learn/patterns/bulkhead"
												className="inline-flex text-sky-200 hover:text-sky-100 hover:underline"
											>
												Learn more →
											</Link>
										</div>
									</TooltipContent>
								</Tooltip>
							</div>
							<Switch
								checked={config.bulkheadEnabled}
								onCheckedChange={() => toggleFlag("bulkheadEnabled")}
							/>
						</div>
					</div>
				</section>
			</motion.div>
		</TooltipProvider>
	);
}
