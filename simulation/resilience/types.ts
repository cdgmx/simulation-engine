export type RequestStatus =
	| "pending"
	| "success"
	| "failed"
	| "timeout"
	| "rejected"
	| "retrying";

export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface SimulationConfig {
	rps: number;
	serviceBLatencyBase: number;
	serviceBFailureRate: number;
	timeoutMs: number;
	retryStrategy: "off" | "fixed" | "jitter";
	maxRetries: number;
	circuitBreakerEnabled: boolean;
	rateLimiterEnabled: boolean;
	rateLimitRPS: number;
	bulkheadEnabled: boolean;
	backpressureEnabled: boolean;
	queueSize: number;
}

export interface RequestEntity {
	id: number;
	x: number;
	y: number;
	status: RequestStatus;
	startTime: number;
	lane: "default" | "bulkhead_1" | "bulkhead_2";
	retryCount: number;
	nextRetryTime: number;
	processing?: ProcessingState | null;
}

export interface ProcessingState {
	startTime: number;
	targetLatency: number;
	willFail: boolean;
}

export interface SimulationMetrics {
	success: number;
	failed: number;
	rejected: number;
	timedOut: number;
	throughput: number;
	avgLatency: number;
	queueLength: number;
}

export interface SimulationSnapshot {
	requests: RequestEntity[];
	metrics: SimulationMetrics;
	cbState: CircuitBreakerState;
	cbFailures: number;
	bucketTokens: number;
}

export const HISTORY_WINDOW_MS = 2000;

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
	rps: 10,
	serviceBLatencyBase: 100,
	serviceBFailureRate: 0.05,
	timeoutMs: 800,
	retryStrategy: "off",
	maxRetries: 3,
	circuitBreakerEnabled: false,
	rateLimiterEnabled: false,
	rateLimitRPS: 15,
	bulkheadEnabled: false,
	backpressureEnabled: false,
	queueSize: 50,
};

export function createEmptySnapshot(): SimulationSnapshot {
	return {
		requests: [],
		metrics: {
			success: 0,
			failed: 0,
			rejected: 0,
			timedOut: 0,
			throughput: 0,
			avgLatency: 0,
			queueLength: 0,
		},
		cbState: "CLOSED",
		cbFailures: 0,
		bucketTokens: 0,
	};
}
