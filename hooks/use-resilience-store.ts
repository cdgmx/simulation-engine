"use client";

import { create } from "zustand";
import {
	DEFAULT_SIMULATION_CONFIG,
	type SimulationConfig,
	type SimulationSnapshot,
} from "@/simulation/resilience/types";

const HISTORY_LENGTH = 40;

interface ChartHistory {
	throughput: number[];
	errors: number[];
	latency: number[];
}

interface ResilienceStoreState {
	config: SimulationConfig;
	history: ChartHistory;
	updateConfig: <K extends keyof SimulationConfig>(
		key: K,
		value: SimulationConfig[K],
	) => void;
	setConfig: (next: SimulationConfig) => void;
	pushHistory: (metrics: SimulationSnapshot["metrics"]) => void;
	resetHistory: () => void;
}

function createHistoryBaseline(): ChartHistory {
	const zeroes: number[] = [];
	for (let index = 0; index < HISTORY_LENGTH; index += 1) {
		zeroes.push(0);
	}
	return {
		throughput: [...zeroes],
		errors: [...zeroes],
		latency: [...zeroes],
	};
}

function shiftAndAppend(source: number[], value: number): number[] {
	const clone = source.slice(1);
	clone.push(value);
	return clone;
}

export const useResilienceStore = create<ResilienceStoreState>((set) => ({
	config: { ...DEFAULT_SIMULATION_CONFIG },
	history: createHistoryBaseline(),
	updateConfig: (key, value) =>
		set((state) => ({
			config: { ...state.config, [key]: value },
		})),
	setConfig: (next) =>
		set(() => ({
			config: next,
		})),
	pushHistory: (metrics) =>
		set((state) => ({
			history: {
				throughput: shiftAndAppend(
					state.history.throughput,
					metrics.throughput,
				),
				errors: shiftAndAppend(
					state.history.errors,
					metrics.failed + metrics.timedOut + metrics.rejected,
				),
				latency: shiftAndAppend(state.history.latency, metrics.avgLatency),
			},
		})),
	resetHistory: () =>
		set(() => ({
			history: createHistoryBaseline(),
		})),
}));
