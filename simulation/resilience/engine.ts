import {
	type CircuitBreakerState,
	DEFAULT_SIMULATION_CONFIG,
	HISTORY_WINDOW_MS,
	type ProcessingState,
	type RequestEntity,
	type RequestStatus,
	type SimulationConfig,
	type SimulationSnapshot,
} from "./types";

const REQUEST_START_X = 50;
const SERVICE_A_X = 150;
const SERVICE_B_X = 400;
const VELOCITY_HEADROOM = 0.7;
const MIN_TIMEOUT_SECONDS = 0.1;

interface CompletedSample {
	status: RequestStatus;
	latency: number;
	ts: number;
}

export class ResilienceSimulationEngine {
	private config: SimulationConfig;

	private requests: RequestEntity[] = [];

	private queue: RequestEntity[] = [];

	private completedWindow: CompletedSample[] = [];

	private cbState: CircuitBreakerState = "CLOSED";

	private cbFailureCount = 0;

	private cbLastTripTime = 0;

	private readonly circuitBreakerThreshold = 5;

	private readonly circuitBreakerResetMs = 3000;

	private tokens: number;

	private reqIdCounter = 0;

	private lastTick = 0;

	constructor(initialConfig: SimulationConfig = DEFAULT_SIMULATION_CONFIG) {
		this.config = initialConfig;
		this.tokens = initialConfig.rateLimitRPS;
	}

	public updateConfig(next: SimulationConfig): void {
		this.config = next;
		if (!next.rateLimiterEnabled) {
			this.tokens = next.rateLimitRPS;
		}
	}

	public reset(): void {
		this.requests = [];
		this.queue = [];
		this.completedWindow = [];
		this.cbState = "CLOSED";
		this.cbFailureCount = 0;
		this.cbLastTripTime = 0;
		this.tokens = this.config.rateLimitRPS;
		this.reqIdCounter = 0;
		this.lastTick = 0;
	}

	public tick(now: number): SimulationSnapshot {
		if (this.lastTick === 0) {
			this.lastTick = now;
		}
		let delta = now - this.lastTick;
		if (delta < 0) {
			delta = 0;
		}
		this.lastTick = now;
		this.refillTokens(delta);
		this.updateCircuitBreaker(now);
		this.maybeSpawnRequest(now, delta);
		this.processQueue(now);
		this.advanceRequests(now, delta);
		return this.getSnapshot();
	}

	public peek(): SimulationSnapshot {
		return this.getSnapshot();
	}

	private refillTokens(delta: number): void {
		if (!this.config.rateLimiterEnabled) {
			this.tokens = this.config.rateLimitRPS;
			return;
		}
		const refillAmount = (this.config.rateLimitRPS * delta) / 1000;
		const candidate = this.tokens + refillAmount;
		if (candidate > this.config.rateLimitRPS) {
			this.tokens = this.config.rateLimitRPS;
		} else {
			this.tokens = candidate;
		}
	}

	private updateCircuitBreaker(now: number): void {
		if (!this.config.circuitBreakerEnabled) {
			this.cbState = "CLOSED";
			this.cbFailureCount = 0;
			return;
		}
		if (this.cbState === "OPEN") {
			const elapsed = now - this.cbLastTripTime;
			if (elapsed > this.circuitBreakerResetMs) {
				this.cbState = "HALF_OPEN";
				this.cbFailureCount = 0;
			}
		}
	}

	private maybeSpawnRequest(now: number, delta: number): void {
		const probability = (this.config.rps * delta) / 1000;
		const shouldSpawn = Math.random() < probability;
		if (!shouldSpawn) {
			return;
		}
		if (this.config.rateLimiterEnabled && this.tokens < 1) {
			this.recordCompletion("rejected", 0, now);
			return;
		}
		if (this.config.rateLimiterEnabled) {
			this.tokens -= 1;
		}
		let lane: RequestEntity["lane"] = "default";
		if (this.config.bulkheadEnabled) {
			if (Math.random() > 0.5) {
				lane = "bulkhead_1";
			} else {
				lane = "bulkhead_2";
			}
		}
		const request: RequestEntity = {
			id: this.reqIdCounter,
			x: REQUEST_START_X,
			y: this.getLaneY(lane),
			status: "pending",
			startTime: now,
			lane,
			retryCount: 0,
			nextRetryTime: 0,
			processing: null,
		};
		this.reqIdCounter += 1;
		if (this.config.backpressureEnabled) {
			const currentPending = this.requests.filter(
				(entry) => entry.status === "pending",
			).length;
			const occupancy = this.queue.length + currentPending;
			if (occupancy >= this.config.queueSize) {
				this.recordCompletion("rejected", 0, now);
				return;
			}
		}
		if (this.cbState === "OPEN") {
			this.recordCompletion("failed", 0, now);
			return;
		}
		this.requests.push(request);
	}

	private getLaneY(lane: RequestEntity["lane"]): number {
		if (lane === "bulkhead_1") {
			return 120;
		}
		if (lane === "bulkhead_2") {
			return 180;
		}
		return 150;
	}

	private processQueue(now: number): void {
		if (this.queue.length === 0) {
			return;
		}
		const next = this.queue.shift();
		if (!next) {
			return;
		}
		next.startTime = now;
		this.requests.push(next);
	}

	private advanceRequests(now: number, delta: number): void {
		const deltaSeconds = delta / 1000;
		const velocity = this.getRequestVelocity();
		for (let index = this.requests.length - 1; index >= 0; index -= 1) {
			const request = this.requests[index];
			if (request.status === "retrying") {
				if (now >= request.nextRetryTime) {
					request.status = "pending";
					request.x = SERVICE_A_X;
					request.processing = null;
				} else {
					continue;
				}
			}
			if (request.x < SERVICE_B_X) {
				request.x += velocity * deltaSeconds;
				if (request.x > SERVICE_B_X) {
					request.x = SERVICE_B_X;
				}
			}
			if (request.x >= SERVICE_B_X && request.status === "pending") {
				this.attemptServiceCall(request, now);
			}
			const elapsed = now - request.startTime;
			if (request.status === "pending" && elapsed > this.config.timeoutMs) {
				this.handleFailure(request, "timeout", now);
			}
		}
	}

	private attemptServiceCall(request: RequestEntity, now: number): void {
		let failureChance = this.config.serviceBFailureRate;
		let latency = this.config.serviceBLatencyBase + Math.random() * 200;
		if (this.config.bulkheadEnabled && request.lane === "bulkhead_2") {
			latency += 1000;
			failureChance = 0.8;
		}
		if (!request.processing) {
			request.processing = this.createProcessingState(
				now,
				latency,
				failureChance,
			);
		}
		const processing = request.processing;
		if (!processing) {
			return;
		}
		const elapsed = now - processing.startTime;
		if (elapsed < processing.targetLatency) {
			return;
		}
		if (processing.willFail) {
			this.handleFailure(request, "failed", now);
			return;
		}
		if (this.config.circuitBreakerEnabled && this.cbState === "HALF_OPEN") {
			this.cbState = "CLOSED";
			this.cbFailureCount = 0;
		}
		this.recordCompletion("success", now - request.startTime, now);
		this.removeRequest(request.id);
	}

	private createProcessingState(
		now: number,
		latency: number,
		failureChance: number,
	): ProcessingState {
		const willFail = Math.random() < failureChance;
		return {
			startTime: now,
			targetLatency: latency,
			willFail,
		};
	}

	private handleFailure(
		request: RequestEntity,
		type: "failed" | "timeout",
		now: number,
	): void {
		if (this.config.circuitBreakerEnabled) {
			this.cbFailureCount += 1;
			if (this.cbFailureCount >= this.circuitBreakerThreshold) {
				this.cbState = "OPEN";
				this.cbLastTripTime = now;
			}
		}
		const canRetry =
			this.config.retryStrategy !== "off" &&
			request.retryCount < this.config.maxRetries;
		if (canRetry) {
			request.retryCount += 1;
			request.status = "retrying";
			request.processing = null;
			const baseDelay = 100 * 2 ** request.retryCount;
			let delay = baseDelay;
			if (this.config.retryStrategy === "jitter") {
				const jitterFactor = 0.5 + Math.random();
				delay = baseDelay * jitterFactor;
			}
			request.nextRetryTime = now + delay;
			return;
		}
		this.recordCompletion(type, now - request.startTime, now);
		this.removeRequest(request.id);
	}

	private removeRequest(id: number): void {
		this.requests = this.requests.filter((entry) => entry.id !== id);
	}

	private recordCompletion(
		status: RequestStatus,
		latency: number,
		now: number,
	): void {
		this.completedWindow.push({ status, latency, ts: now });
		this.completedWindow = this.completedWindow.filter(
			(sample) => now - sample.ts < HISTORY_WINDOW_MS,
		);
	}

	private getSnapshot(): SimulationSnapshot {
		const metrics = this.calculateMetrics();
		return {
			requests: this.requests.map((entry) => ({ ...entry })),
			metrics,
			cbState: this.cbState,
			cbFailures: this.cbFailureCount,
			bucketTokens: this.tokens,
		};
	}

	private calculateMetrics(): SimulationSnapshot["metrics"] {
		let success = 0;
		let failed = 0;
		let rejected = 0;
		let timedOut = 0;
		let total = 0;
		const latencyValues: number[] = [];
		for (const sample of this.completedWindow) {
			total += 1;
			if (sample.status === "success") {
				success += 1;
				latencyValues.push(sample.latency);
			}
			if (sample.status === "failed") {
				failed += 1;
			}
			if (sample.status === "rejected") {
				rejected += 1;
			}
			if (sample.status === "timeout") {
				timedOut += 1;
			}
		}
		let avgLatency = 0;
		if (latencyValues.length > 0) {
			let sum = 0;
			for (const entry of latencyValues) {
				sum += entry;
			}
			avgLatency = sum / latencyValues.length;
		}
		const throughput = total / 2;
		return {
			success,
			failed,
			rejected,
			timedOut,
			throughput,
			avgLatency,
			queueLength: this.requests.length,
		};
	}

	private getRequestVelocity(): number {
		const distance = SERVICE_B_X - REQUEST_START_X;
		const timeoutSeconds = Math.max(
			this.config.timeoutMs / 1000,
			MIN_TIMEOUT_SECONDS,
		);
		const safeWindow = Math.max(
			timeoutSeconds * VELOCITY_HEADROOM,
			MIN_TIMEOUT_SECONDS,
		);
		const velocity = distance / safeWindow;
		if (!Number.isFinite(velocity) || velocity <= 0) {
			return distance;
		}
		return velocity;
	}
}
