"use client";

import {
	Area,
	AreaChart,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { useResilienceStore } from "@/hooks/use-resilience-store";

export function ResilienceCharts() {
	const history = useResilienceStore((state) => state.history);
	const chartData = history.throughput.map((_, index) => ({
		id: index,
		throughput: history.throughput[index],
		errors: history.errors[index],
		latency: history.latency[index],
	}));

	return (
		<div className="grid gap-4 md:grid-cols-3">
			<div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
				<div className="text-xs uppercase tracking-wide text-slate-400">
					Throughput
				</div>
				<div className="h-32">
					<ResponsiveContainer width="100%" height="100%">
						<AreaChart
							data={chartData}
							margin={{ top: 10, right: 0, bottom: 0, left: -20 }}
						>
							<defs>
								<linearGradient
									id="throughputGradient"
									x1="0"
									y1="0"
									x2="0"
									y2="1"
								>
									<stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
									<stop offset="95%" stopColor="#10b981" stopOpacity={0} />
								</linearGradient>
							</defs>
							<Tooltip
								contentStyle={{
									background: "#0f172a",
									border: "1px solid #1e293b",
								}}
							/>
							<Area
								type="monotone"
								dataKey="throughput"
								stroke="#10b981"
								fillOpacity={1}
								fill="url(#throughputGradient)"
							/>
						</AreaChart>
					</ResponsiveContainer>
				</div>
			</div>
			<div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
				<div className="text-xs uppercase tracking-wide text-slate-400">
					Errors
				</div>
				<div className="h-32">
					<ResponsiveContainer width="100%" height="100%">
						<LineChart
							data={chartData}
							margin={{ top: 10, right: 0, bottom: 0, left: -20 }}
						>
							<Tooltip
								contentStyle={{
									background: "#0f172a",
									border: "1px solid #1e293b",
								}}
							/>
							<Line
								type="monotone"
								dataKey="errors"
								stroke="#ef4444"
								strokeWidth={2}
								dot={false}
							/>
							<XAxis dataKey="id" hide />
							<YAxis hide />
						</LineChart>
					</ResponsiveContainer>
				</div>
			</div>
			<div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
				<div className="text-xs uppercase tracking-wide text-slate-400">
					Latency
				</div>
				<div className="h-32">
					<ResponsiveContainer width="100%" height="100%">
						<LineChart
							data={chartData}
							margin={{ top: 10, right: 0, bottom: 0, left: -20 }}
						>
							<Tooltip
								contentStyle={{
									background: "#0f172a",
									border: "1px solid #1e293b",
								}}
							/>
							<Line
								type="monotone"
								dataKey="latency"
								stroke="#f59e0b"
								strokeWidth={2}
								dot={false}
							/>
							<XAxis dataKey="id" hide />
							<YAxis hide />
						</LineChart>
					</ResponsiveContainer>
				</div>
			</div>
		</div>
	);
}
