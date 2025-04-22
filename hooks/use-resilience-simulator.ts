"use client";

import { createMachine, type MachineSchema } from "@zag-js/core";
import { useMachine } from "@zag-js/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ResilienceSimulationEngine } from "@/simulation/resilience/engine";
import {
	createEmptySnapshot,
	DEFAULT_SIMULATION_CONFIG,
} from "@/simulation/resilience/types";
import { useResilienceStore } from "./use-resilience-store";

interface ResilienceSchema extends MachineSchema {
	context: Record<string, never>;
	state: "paused" | "running";
	event:
		| { type: "START" }
		| { type: "PAUSE" }
		| { type: "RESET" }
		| { type: "UPDATE" };
}

function createResilienceMachine() {
	return createMachine<ResilienceSchema>({
		initialState: () => "paused",
		states: {
			paused: {
				on: {
					START: { target: "running" },
					UPDATE: {},
					RESET: { target: "paused", reenter: true },
				},
			},
			running: {
				on: {
					PAUSE: { target: "paused" },
					UPDATE: {},
					RESET: { target: "paused", reenter: true },
				},
			},
		},
	});
}

export function useResilienceSimulator() {
	const config = useResilienceStore((state) => state.config);
	const pushHistory = useResilienceStore((state) => state.pushHistory);
	const resetHistory = useResilienceStore((state) => state.resetHistory);
	const engineRef = useRef<ResilienceSimulationEngine | null>(null);
	if (!engineRef.current) {
		engineRef.current = new ResilienceSimulationEngine(
			DEFAULT_SIMULATION_CONFIG,
		);
	}
	const machine = useMemo(() => createResilienceMachine(), []);
	const service = useMachine(machine);
	const state = service.state;
	const send = service.send;
	const isRunning = state.matches("running");
	const initialSnapshotRef = useRef<
		ReturnType<ResilienceSimulationEngine["peek"]>
	>(engineRef.current?.peek() ?? createEmptySnapshot());
	const liveSnapshotRef = useRef(initialSnapshotRef.current);
	const [snapshot, setSnapshot] = useState(initialSnapshotRef.current);
	const isRunningRef = useRef(isRunning);
	useEffect(() => {
		isRunningRef.current = isRunning;
	}, [isRunning]);

	useEffect(() => {
		engineRef.current?.updateConfig(config);
	}, [config]);

	useEffect(() => {
		let frameId: number;
		let lastUiSync = 0;
		let lastHistorySync = 0;
		const loop = (time: number) => {
			const engine = engineRef.current;
			if (engine && isRunningRef.current) {
				const nextSnapshot = engine.tick(time);
				liveSnapshotRef.current = nextSnapshot;
				send({ type: "UPDATE" });
				if (time - lastUiSync >= 200) {
					setSnapshot(nextSnapshot);
					lastUiSync = time;
				}
				if (time - lastHistorySync >= 200) {
					pushHistory(nextSnapshot.metrics);
					lastHistorySync = time;
				}
			}
			frameId = requestAnimationFrame(loop);
		};
		frameId = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(frameId);
	}, [pushHistory, send]);

	const start = () => {
		send({ type: "START" });
	};

	const pause = () => {
		send({ type: "PAUSE" });
	};

	const reset = () => {
		const engine = engineRef.current;
		if (!engine) {
			return;
		}
		engine.reset();
		const nextSnapshot = engine.peek();
		liveSnapshotRef.current = nextSnapshot;
		setSnapshot(nextSnapshot);
		send({ type: "RESET" });
		resetHistory();
	};

	return {
		snapshot,
		isRunning,
		start,
		pause,
		reset,
		liveSnapshotRef,
	};
}
