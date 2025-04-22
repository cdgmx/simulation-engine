"use client";

import { useEffect, useRef } from "react";
import type { RequestEntity } from "@/simulation/resilience/types";

interface RequestParticlesProps {
	requests: RequestEntity[];
	width: number;
	height: number;
}

const NODE_POSITIONS = {
	client: 0,
	rateLimiter: 200,
	circuitBreaker: 400,
	gateway: 600,
	serviceB: 800,
};

function getStatusColor(status: RequestEntity["status"]): string {
	switch (status) {
		case "pending":
			return "#38bdf8"; // sky-400
		case "success":
			return "#4ade80"; // green-400
		case "failed":
			return "#f87171"; // red-400
		case "timeout":
			return "#fbbf24"; // amber-400
		case "rejected":
			return "#a78bfa"; // violet-400
		case "retrying":
			return "#fb923c"; // orange-400
		default:
			return "#94a3b8"; // slate-400
	}
}

function getLaneY(lane: RequestEntity["lane"], height: number): number {
	const centerY = height / 2;
	switch (lane) {
		case "bulkhead_1":
			return centerY - 25;
		case "bulkhead_2":
			return centerY + 25;
		default:
			return centerY;
	}
}

function getProgressFromX(x: number): number {
	const minX = 50;
	const maxX = 400;
	const progress = (x - minX) / (maxX - minX);
	if (progress < 0) return 0;
	if (progress > 1) return 1;
	return progress;
}

export function RequestParticles({
	requests,
	width,
	height,
}: RequestParticlesProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const animationRef = useRef<number>(0);
	const requestsRef = useRef<RequestEntity[]>(requests);

	useEffect(() => {
		requestsRef.current = requests;
	}, [requests]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const dpr = window.devicePixelRatio;
		canvas.width = width * dpr;
		canvas.height = height * dpr;
		ctx.scale(dpr, dpr);

		const draw = (time: number) => {
			ctx.clearRect(0, 0, width, height);

			const padding = 80;
			const lineY = height / 2;
			const totalNodeWidth = 900;
			const scale = (width - padding * 2) / totalNodeWidth;
			const offsetX = padding;

			const stagePositions = [
				{ x: offsetX + NODE_POSITIONS.client * scale + 60, label: "Client" },
				{
					x: offsetX + NODE_POSITIONS.rateLimiter * scale + 70,
					label: "Rate Limiter",
				},
				{
					x: offsetX + NODE_POSITIONS.circuitBreaker * scale + 85,
					label: "Circuit Breaker",
				},
				{
					x: offsetX + NODE_POSITIONS.gateway * scale + 50,
					label: "Gateway",
				},
				{
					x: offsetX + NODE_POSITIONS.serviceB * scale + 60,
					label: "Service",
				},
			];

			ctx.strokeStyle = "rgba(71, 85, 105, 0.4)";
			ctx.lineWidth = 2;
			ctx.setLineDash([8, 8]);
			ctx.beginPath();
			ctx.moveTo(stagePositions[0].x, lineY);
			ctx.lineTo(stagePositions[stagePositions.length - 1].x, lineY);
			ctx.stroke();
			ctx.setLineDash([]);

			for (const stage of stagePositions) {
				ctx.fillStyle = "rgba(100, 116, 139, 0.6)";
				ctx.beginPath();
				ctx.arc(stage.x, lineY, 6, 0, Math.PI * 2);
				ctx.fill();

				ctx.fillStyle = "rgba(148, 163, 184, 0.8)";
				ctx.font = "11px Inter, system-ui, sans-serif";
				ctx.textAlign = "center";
				ctx.fillText(stage.label, stage.x, lineY + 28);
			}

			const currentRequests = requestsRef.current;
			const maxVisible = 100;
			const visibleRequests = currentRequests.slice(-maxVisible);

			for (const req of visibleRequests) {
				const progress = getProgressFromX(req.x);
				const screenX = offsetX + progress * totalNodeWidth * scale;
				const screenY = getLaneY(req.lane, height);

				const color = getStatusColor(req.status);

				if (req.status === "retrying") {
					const pulseScale = 1 + 0.3 * Math.sin(time / 150);
					ctx.beginPath();
					ctx.arc(screenX, screenY, 8 * pulseScale, 0, Math.PI * 2);
					ctx.fillStyle = `${color}33`;
					ctx.fill();
				}

				const glowRadius = req.status === "pending" ? 12 : 8;
				const gradient = ctx.createRadialGradient(
					screenX,
					screenY,
					0,
					screenX,
					screenY,
					glowRadius,
				);
				gradient.addColorStop(0, `${color}cc`);
				gradient.addColorStop(0.5, `${color}44`);
				gradient.addColorStop(1, "transparent");
				ctx.fillStyle = gradient;
				ctx.beginPath();
				ctx.arc(screenX, screenY, glowRadius, 0, Math.PI * 2);
				ctx.fill();

				ctx.beginPath();
				ctx.arc(screenX, screenY, 4, 0, Math.PI * 2);
				ctx.fillStyle = color;
				ctx.fill();

				if (req.retryCount > 0) {
					ctx.fillStyle = "#fff";
					ctx.font = "bold 8px Inter, system-ui, sans-serif";
					ctx.textAlign = "center";
					ctx.fillText(req.retryCount.toString(), screenX, screenY + 3);
				}
			}

			if (visibleRequests.length > 0) {
				ctx.fillStyle = "rgba(148, 163, 184, 0.5)";
				ctx.font = "10px Inter, system-ui, sans-serif";
				ctx.textAlign = "left";
				ctx.fillText(`${visibleRequests.length} in-flight`, 12, 20);
			}

			animationRef.current = requestAnimationFrame(draw);
		};

		animationRef.current = requestAnimationFrame(draw);

		return () => {
			cancelAnimationFrame(animationRef.current);
		};
	}, [width, height]);

	return (
		<canvas
			ref={canvasRef}
			style={{ width, height }}
			className="absolute inset-0 pointer-events-none"
		/>
	);
}
