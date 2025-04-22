import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RefreshCw, AlertTriangle, Activity, Shield, Layers, Clock, Zap, XCircle } from 'lucide-react';

/**
 * ------------------------------------------------------------------
 * TYPES & CONSTANTS
 * ------------------------------------------------------------------
 */

type RequestStatus = 'pending' | 'success' | 'failed' | 'timeout' | 'rejected' | 'retrying';

interface SimulationConfig {
  rps: number;
  serviceBLatencyBase: number; // ms
  serviceBFailureRate: number; // 0-1
  timeoutMs: number;
  retryStrategy: 'off' | 'fixed' | 'jitter';
  maxRetries: number;
  circuitBreakerEnabled: boolean;
  rateLimiterEnabled: boolean;
  rateLimitRPS: number;
  bulkheadEnabled: boolean;
  backpressureEnabled: boolean;
  queueSize: number;
}

interface RequestEntity {
  id: number;
  x: number;
  y: number;
  status: RequestStatus;
  startTime: number;
  lane: 'default' | 'bulkhead_1' | 'bulkhead_2'; 
  retryCount: number;
  nextRetryTime: number;
}

type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface SimulationSnapshot {
  requests: RequestEntity[];
  metrics: {
    success: number;
    failed: number;
    rejected: number;
    timedOut: number;
    throughput: number; // rps
    avgLatency: number;
    queueLength: number;
  };
  cbState: CircuitBreakerState;
  cbFailures: number;
  bucketTokens: number;
}

const DEFAULT_CONFIG: SimulationConfig = {
  rps: 10,
  serviceBLatencyBase: 100,
  serviceBFailureRate: 0.05, // 5% base failure
  timeoutMs: 800,
  retryStrategy: 'off',
  maxRetries: 3,
  circuitBreakerEnabled: false,
  rateLimiterEnabled: false,
  rateLimitRPS: 15,
  bulkheadEnabled: false,
  backpressureEnabled: false,
  queueSize: 50,
};

const COLORS = {
  pending: '#3b82f6', // blue
  success: '#10b981', // green
  failed: '#ef4444', // red
  timeout: '#f59e0b', // orange
  rejected: '#6b7280', // gray
  retrying: '#8b5cf6', // purple
  bg: '#111827',
  text: '#f3f4f6'
};

/**
 * ------------------------------------------------------------------
 * SIMULATION ENGINE (The "Worker")
 * ------------------------------------------------------------------
 */
class SimulationEngine {
  private requests: RequestEntity[] = [];
  private config: SimulationConfig = DEFAULT_CONFIG;
  private lastTick = 0;
  
  // Metrics State
  private metricsHistory: { ts: number, success: number, fail: number, latency: number }[] = [];
  private completedWindow: { status: RequestStatus, latency: number, ts: number }[] = [];

  // Circuit Breaker State (XState-ish)
  private cbState: CircuitBreakerState = 'CLOSED';
  private cbFailureCount = 0;
  private cbLastTripTime = 0;
  private CB_THRESHOLD = 5;
  private CB_RESET_TIMEOUT = 3000;

  // Rate Limiter State (Token Bucket)
  private tokens = 0;
  private lastTokenRefill = 0;
  
  // ID Counter
  private reqIdCounter = 0;

  // Queue
  private queue: RequestEntity[] = [];

  constructor() {
    this.tokens = DEFAULT_CONFIG.rateLimitRPS;
    this.lastTokenRefill = performance.now();
  }

  updateConfig(newConfig: SimulationConfig) {
    this.config = newConfig;
    if (!newConfig.rateLimiterEnabled) {
      this.tokens = 9999;
    }
  }

  /**
   * The core discrete event loop
   */
  tick(now: number): SimulationSnapshot {
    const delta = now - this.lastTick;
    this.lastTick = now;

    // 1. Refill Token Bucket
    if (this.config.rateLimiterEnabled) {
      const refillAmount = (this.config.rateLimitRPS * delta) / 1000;
      this.tokens = Math.min(this.config.rateLimitRPS, this.tokens + refillAmount);
    } else {
      this.tokens = 9999;
    }

    // 2. Circuit Breaker State Machine Logic
    this.updateCircuitBreaker(now);

    // 3. Spawn New Requests (Client -> Service A)
    // We probabilistically spawn based on RPS
    const probability = (this.config.rps * delta) / 1000;
    if (Math.random() < probability) {
      this.spawnRequest(now);
    }

    // 4. Process Queue (Backpressure)
    this.processQueue(now);

    // 5. Update In-Flight Requests (Physics & Networking)
    this.updateRequests(now, delta);

    // 6. Calculate Metrics
    return this.getSnapshot(now);
  }

  private updateCircuitBreaker(now: number) {
    if (!this.config.circuitBreakerEnabled) {
      this.cbState = 'CLOSED';
      return;
    }

    if (this.cbState === 'OPEN') {
      if (now - this.cbLastTripTime > this.CB_RESET_TIMEOUT) {
        this.cbState = 'HALF_OPEN';
        this.cbFailureCount = 0; // Reset for half-open trial
      }
    }
  }

  private spawnRequest(now: number) {
    // Check Rate Limit (Entry Guard)
    if (this.config.rateLimiterEnabled && this.tokens < 1) {
      this.recordCompletion('rejected', 0, now);
      return; // Dropped by Rate Limiter
    }

    if (this.config.rateLimiterEnabled) {
      this.tokens -= 1;
    }

    // Determine Lane (Bulkhead)
    let lane: 'default' | 'bulkhead_1' | 'bulkhead_2' = 'default';
    if (this.config.bulkheadEnabled) {
      lane = Math.random() > 0.5 ? 'bulkhead_1' : 'bulkhead_2';
    }

    const req: RequestEntity = {
      id: this.reqIdCounter++,
      x: 50, // Start at Client
      y: this.getLaneY(lane),
      status: 'pending',
      startTime: now,
      lane,
      retryCount: 0,
      nextRetryTime: 0
    };

    // Check Queue (Backpressure)
    if (this.config.backpressureEnabled) {
      const currentInFlight = this.requests.filter(r => r.status === 'pending').length;
      if (this.queue.length + currentInFlight >= this.config.queueSize) {
        this.recordCompletion('rejected', 0, now);
        return;
      }
    }
    
    // Check Circuit Breaker (Fail Fast)
    if (this.cbState === 'OPEN') {
      // Immediate failure without network travel
      this.recordCompletion('failed', 0, now);
      return;
    }

    this.requests.push(req);
  }

  private getLaneY(lane: string) {
    // Canvas Height is typically 300 in UI
    if (lane === 'bulkhead_1') return 100;
    if (lane === 'bulkhead_2') return 200;
    return 150; // default centered
  }

  private processQueue(now: number) {
    // Simple FIFO processing if we had a distinct holding queue
    // For this visual sim, we treat "in-flight" as the queue visual
  }

  private updateRequests(now: number, delta: number) {
    const SERVICE_A_X = 150;
    const SERVICE_B_X = 400; // The destination
    const SPEED = 0.4 * delta; // px per tick

    // We iterate backwards to allow removal
    for (let i = this.requests.length - 1; i >= 0; i--) {
      const req = this.requests[i];

      // Handle Retries Waiting
      if (req.status === 'retrying') {
        if (now >= req.nextRetryTime) {
          req.status = 'pending';
          req.x = SERVICE_A_X; // Reset to Service A
        } else {
          continue; // Waiting
        }
      }

      // Movement Logic
      if (req.x < SERVICE_B_X) {
        req.x += SPEED;
      }

      // Interaction with Service B
      if (req.x >= SERVICE_B_X && req.status === 'pending') {
        this.attemptServiceCall(req, now);
      }

      // Timeout Check
      if (req.status === 'pending' && (now - req.startTime > this.config.timeoutMs)) {
        this.handleFailure(req, 'timeout', now);
      }
    }
  }

  private attemptServiceCall(req: RequestEntity, now: number) {
    // Simulate Service B Logic
    
    // 1. Bulkhead check (Simulate one pool being broken)
    let failureChance = this.config.serviceBFailureRate;
    let latency = this.config.serviceBLatencyBase + (Math.random() * 200);

    // Scenario: If Bulkhead is ON, make Lane 2 terrible
    if (this.config.bulkheadEnabled && req.lane === 'bulkhead_2') {
       latency += 1000;
       failureChance = 0.8;
    }

    // 2. Determine Outcome
    const isFailure = Math.random() < failureChance;
    
    // We simulate async processing by keeping it 'pending' at X=400 
    // until 'latency' passes. But for simple visual sim, we decide NOW
    // and just delay the removal or state change? 
    // Better: We attach a "processCompleteTime" to the request once it hits the wall.
    
    // Simplified: Use the visual travel time as part of latency, 
    // but add extra wait at the wall.
    // For this engine, let's just resolve immediately upon touching the wall 
    // BUT we add random artificial delay before we mark it done to simulate processing time.
    
    // Actually, to make "Timeout" visible, the dot needs to sit at Service B.
    if (!(req as any).processingStart) {
        (req as any).processingStart = now;
        (req as any).targetLatency = latency;
        (req as any).willFail = isFailure;
    }

    const processTime = now - (req as any).processingStart;
    
    if (processTime >= (req as any).targetLatency) {
        if ((req as any).willFail) {
            this.handleFailure(req, 'failed', now);
        } else {
            // Success
            if (this.config.circuitBreakerEnabled && this.cbState === 'HALF_OPEN') {
                this.cbState = 'CLOSED';
                this.cbFailureCount = 0;
            }
            this.recordCompletion('success', now - req.startTime, now);
            this.removeRequest(req.id);
        }
    }
  }

  private handleFailure(req: RequestEntity, type: 'failed' | 'timeout', now: number) {
    // Circuit Breaker Accounting
    if (this.config.circuitBreakerEnabled) {
        this.cbFailureCount++;
        if (this.cbFailureCount >= this.CB_THRESHOLD) {
            this.cbState = 'OPEN';
            this.cbLastTripTime = now;
        }
    }

    // Retry Logic
    if (this.config.retryStrategy !== 'off' && req.retryCount < this.config.maxRetries) {
        req.retryCount++;
        req.status = 'retrying';
        (req as any).processingStart = undefined; // Reset processing
        
        // Calculate Backoff
        let delay = 100 * Math.pow(2, req.retryCount); // Exponential
        
        if (this.config.retryStrategy === 'jitter') {
            delay = delay * (0.5 + Math.random()); // +/- jitter
        }
        
        req.nextRetryTime = now + delay;
        // Don't remove, it stays in array but waits
    } else {
        // Final Failure
        this.recordCompletion(type, now - req.startTime, now);
        this.removeRequest(req.id);
    }
  }

  private removeRequest(id: number) {
    this.requests = this.requests.filter(r => r.id !== id);
  }

  private recordCompletion(status: RequestStatus, latency: number, now: number) {
    this.completedWindow.push({ status, latency, ts: now });
    
    // Prune old metrics
    const WINDOW_MS = 2000;
    this.completedWindow = this.completedWindow.filter(m => now - m.ts < WINDOW_MS);
  }

  private getSnapshot(now: number): SimulationSnapshot {
    // Calc stats from window
    const total = this.completedWindow.length;
    const success = this.completedWindow.filter(m => m.status === 'success').length;
    const failed = this.completedWindow.filter(m => m.status === 'failed').length;
    const timedOut = this.completedWindow.filter(m => m.status === 'timeout').length;
    const rejected = this.completedWindow.filter(m => m.status === 'rejected').length;
    
    const latencies = this.completedWindow.filter(m => m.status === 'success').map(m => m.latency);
    const avgLatency = latencies.length ? latencies.reduce((a,b) => a+b, 0) / latencies.length : 0;

    return {
      requests: [...this.requests], // Copy for render safety
      metrics: {
        success,
        failed,
        rejected,
        timedOut,
        throughput: total / 2, // approx RPS over 2s window
        avgLatency,
        queueLength: this.requests.length
      },
      cbState: this.cbState,
      cbFailures: this.cbFailureCount,
      bucketTokens: this.tokens
    };
  }
}

/**
 * ------------------------------------------------------------------
 * VISUALIZATION COMPONENTS
 * ------------------------------------------------------------------
 */

// Simple SVG Line Chart
const TimeSeriesChart = ({ data, color, height = 50, label }: { data: number[], color: string, height?: number, label: string }) => {
    const max = Math.max(...data, 10);
    const min = 0;
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 100 - ((val - min) / (max - min)) * 100;
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="flex flex-col flex-1 bg-gray-900 rounded p-2 border border-gray-800">
            <span className="text-xs text-gray-400 mb-1">{label}</span>
            <div className="relative w-full overflow-hidden" style={{ height: `${height}px` }}>
                <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                    <polyline
                        points={points}
                        fill="none"
                        stroke={color}
                        strokeWidth="2"
                    />
                </svg>
            </div>
            <div className="flex justify-between mt-1">
                <span className="text-xs text-gray-500 font-mono">Now</span>
                <span className="text-xs font-bold font-mono" style={{ color }}>{data[data.length-1]?.toFixed(0)}</span>
            </div>
        </div>
    );
};

const CanvasRenderer = ({ snapshot, config }: { snapshot: SimulationSnapshot, config: SimulationConfig }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Resize
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        // Clear
        ctx.fillStyle = '#0f172a'; // Slate 900
        ctx.fillRect(0, 0, rect.width, rect.height);

        // Draw Lanes/Architecture
        const drawNode = (x: number, y: number, w: number, h: number, label: string, color: string) => {
            ctx.fillStyle = color;
            ctx.fillRect(x, y, w, h);
            ctx.fillStyle = '#fff';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(label, x + w/2, y + h/2 + 4);
        };

        const drawPipe = (y: number, label: string) => {
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(80, y + 15);
            ctx.lineTo(400, y + 15);
            ctx.stroke();
            if (label) {
                ctx.fillStyle = '#475569';
                ctx.fillText(label, 240, y + 35);
            }
        }

        // Service A (Gateway)
        drawNode(20, 100, 60, 100, 'Client', '#3b82f6');
        
        // Service B (Downstream)
        const bColor = config.circuitBreakerEnabled && snapshot.cbState === 'OPEN' ? '#ef4444' : '#10b981';
        drawNode(400, 100, 60, 100, 'Service B', bColor);

        // Lanes
        if (config.bulkheadEnabled) {
            drawPipe(100, "Lane 1 (Premium)");
            drawPipe(200, "Lane 2 (Broken)");
        } else {
            drawPipe(150, "");
        }

        // Draw Requests
        snapshot.requests.forEach(req => {
            ctx.beginPath();
            ctx.arc(req.x, req.y, 4, 0, Math.PI * 2);
            
            let color = COLORS[req.status] || '#fff';
            // Override pending color based on retry
            if (req.status === 'pending' && req.retryCount > 0) color = COLORS.retrying;

            ctx.fillStyle = color;
            ctx.fill();
        });

        // Draw Circuit Breaker Status Visual
        if (config.circuitBreakerEnabled) {
            ctx.fillStyle = snapshot.cbState === 'OPEN' ? '#ef4444' : snapshot.cbState === 'HALF_OPEN' ? '#f59e0b' : '#10b981';
            ctx.fillRect(380, 80, 100, 5); // Status bar above Service B
            ctx.font = '10px sans-serif';
            ctx.fillText(`CB: ${snapshot.cbState}`, 430, 75);
        }

        // Draw Token Bucket Visual
        if (config.rateLimiterEnabled) {
            const bucketHeight = 60;
            const fillPct = Math.min(1, snapshot.bucketTokens / config.rateLimitRPS);
            const x = 50; 
            const y = 220;
            
            ctx.strokeStyle = '#6366f1';
            ctx.strokeRect(x, y, 15, bucketHeight);
            
            ctx.fillStyle = '#6366f1';
            ctx.fillRect(x, y + (bucketHeight * (1 - fillPct)), 15, bucketHeight * fillPct);
            
            ctx.font = '10px sans-serif';
            ctx.fillText("Tokens", x + 7, y + bucketHeight + 12);
        }

    }, [snapshot, config]);

    return (
        <canvas ref={canvasRef} className="w-full h-64 rounded-lg shadow-inner bg-slate-900 border border-slate-700" />
    );
};

/**
 * ------------------------------------------------------------------
 * MAIN APPLICATION
 * ------------------------------------------------------------------
 */

export default function ResilienceSimulator() {
  const [engine] = useState(() => new SimulationEngine());
  const [config, setConfig] = useState<SimulationConfig>(DEFAULT_CONFIG);
  const [snapshot, setSnapshot] = useState<SimulationSnapshot | null>(null);
  const [isRunning, setIsRunning] = useState(true);
  
  // Historical data for charts (last 30 pts)
  const [chartHistory, setChartHistory] = useState({
      throughput: Array(30).fill(0),
      errors: Array(30).fill(0),
      latency: Array(30).fill(0)
  });

  // Main Loop
  useEffect(() => {
    let frameId: number;
    
    const loop = () => {
      if (isRunning) {
        const snap = engine.tick(performance.now());
        setSnapshot(snap);
        
        // Push to history sparsely (every 10th frame approx to slow down charts)
        if (Math.random() > 0.9) {
            setChartHistory(prev => ({
                throughput: [...prev.throughput.slice(1), snap.metrics.throughput],
                errors: [...prev.errors.slice(1), snap.metrics.failed],
                latency: [...prev.latency.slice(1), snap.metrics.avgLatency]
            }));
        }
      }
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [engine, isRunning]);

  // Sync Config
  useEffect(() => {
    engine.updateConfig(config);
  }, [config, engine]);

  const updateField = <K extends keyof SimulationConfig>(key: K, val: SimulationConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: val }));
  };

  if (!snapshot) return <div className="p-10 text-white">Initializing Physics Engine...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-8 flex flex-col gap-6">
      
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Microservice Resilience Simulator
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Visualize the impact of circuit breakers, rate limits, and retries in real-time.
          </p>
        </div>
        <div className="flex items-center gap-3">
            <button 
                onClick={() => setIsRunning(!isRunning)}
                className={`flex items-center gap-2 px-4 py-2 rounded font-medium transition-colors ${isRunning ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
            >
                {isRunning ? <><Pause size={18}/> Pause Sim</> : <><Play size={18}/> Resume Sim</>}
            </button>
        </div>
      </header>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT: CONTROLS */}
        <div className="lg:col-span-1 space-y-6">
            
            {/* World Controls */}
            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-sm">
                <h3 className="flex items-center gap-2 font-semibold text-slate-200 mb-4">
                    <Activity size={18} className="text-blue-400" /> Environment Stress
                </h3>
                
                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span>Incoming Traffic (RPS)</span>
                            <span className="text-blue-400">{config.rps} req/s</span>
                        </div>
                        <input 
                            type="range" min="1" max="50" value={config.rps} 
                            onChange={(e) => updateField('rps', Number(e.target.value))}
                            className="w-full accent-blue-500"
                        />
                    </div>

                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span>Service B Latency Base</span>
                            <span className="text-amber-400">{config.serviceBLatencyBase} ms</span>
                        </div>
                        <input 
                            type="range" min="20" max="2000" step="50" value={config.serviceBLatencyBase} 
                            onChange={(e) => updateField('serviceBLatencyBase', Number(e.target.value))}
                            className="w-full accent-amber-500"
                        />
                    </div>

                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span>Service B Failure Rate</span>
                            <span className="text-red-400">{(config.serviceBFailureRate * 100).toFixed(0)}%</span>
                        </div>
                        <input 
                            type="range" min="0" max="1" step="0.05" value={config.serviceBFailureRate} 
                            onChange={(e) => updateField('serviceBFailureRate', Number(e.target.value))}
                            className="w-full accent-red-500"
                        />
                    </div>
                </div>
            </div>

            {/* Pattern Controls */}
            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-sm">
                <h3 className="flex items-center gap-2 font-semibold text-slate-200 mb-4">
                    <Shield size={18} className="text-emerald-400" /> Resilience Patterns
                </h3>

                <div className="space-y-4">
                    
                    {/* Timeouts */}
                    <div className="flex items-center justify-between p-2 bg-slate-800/50 rounded">
                        <div className="flex items-center gap-2">
                            <Clock size={16} className="text-slate-400"/>
                            <span className="text-sm">Client Timeout</span>
                        </div>
                        <select 
                            className="bg-slate-950 border border-slate-700 text-xs p-1 rounded"
                            value={config.timeoutMs}
                            onChange={(e) => updateField('timeoutMs', Number(e.target.value))}
                        >
                            <option value={200}>Strict (200ms)</option>
                            <option value={800}>Normal (800ms)</option>
                            <option value={3000}>Lax (3s)</option>
                        </select>
                    </div>

                    {/* Retries */}
                    <div className="space-y-2 p-2 bg-slate-800/50 rounded">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <RefreshCw size={16} className="text-slate-400"/>
                                <span className="text-sm">Retries</span>
                            </div>
                            <div className="flex gap-1">
                                {(['off', 'fixed', 'jitter'] as const).map(mode => (
                                    <button
                                        key={mode}
                                        onClick={() => updateField('retryStrategy', mode)}
                                        className={`text-[10px] px-2 py-1 rounded uppercase ${config.retryStrategy === mode ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                                    >
                                        {mode}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Circuit Breaker */}
                    <div className="flex items-center justify-between p-2 bg-slate-800/50 rounded">
                        <div className="flex items-center gap-2">
                            <Zap size={16} className="text-slate-400"/>
                            <span className="text-sm">Circuit Breaker</span>
                        </div>
                        <button
                            onClick={() => updateField('circuitBreakerEnabled', !config.circuitBreakerEnabled)}
                            className={`w-10 h-5 rounded-full relative transition-colors ${config.circuitBreakerEnabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
                        >
                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${config.circuitBreakerEnabled ? 'left-6' : 'left-1'}`} />
                        </button>
                    </div>

                    {/* Rate Limiting */}
                    <div className="flex items-center justify-between p-2 bg-slate-800/50 rounded">
                        <div className="flex items-center gap-2">
                            <XCircle size={16} className="text-slate-400"/>
                            <span className="text-sm">Rate Limit</span>
                        </div>
                        <button
                            onClick={() => updateField('rateLimiterEnabled', !config.rateLimiterEnabled)}
                            className={`w-10 h-5 rounded-full relative transition-colors ${config.rateLimiterEnabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
                        >
                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${config.rateLimiterEnabled ? 'left-6' : 'left-1'}`} />
                        </button>
                    </div>

                    {/* Bulkhead */}
                    <div className="flex items-center justify-between p-2 bg-slate-800/50 rounded">
                        <div className="flex items-center gap-2">
                            <Layers size={16} className="text-slate-400"/>
                            <span className="text-sm">Bulkheads</span>
                        </div>
                        <button
                            onClick={() => updateField('bulkheadEnabled', !config.bulkheadEnabled)}
                            className={`w-10 h-5 rounded-full relative transition-colors ${config.bulkheadEnabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
                        >
                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${config.bulkheadEnabled ? 'left-6' : 'left-1'}`} />
                        </button>
                    </div>

                </div>
            </div>
        </div>

        {/* CENTER/RIGHT: VISUALIZATION */}
        <div className="lg:col-span-2 space-y-6">
            
            {/* Real-time Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <div className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Success RPS</div>
                    <div className="text-2xl font-mono text-emerald-400">{snapshot.metrics.throughput.toFixed(1)}</div>
                </div>
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <div className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Fail RPS</div>
                    <div className="text-2xl font-mono text-red-400">
                        {((snapshot.metrics.failed + snapshot.metrics.timedOut + snapshot.metrics.rejected) / 2).toFixed(1)}
                    </div>
                </div>
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <div className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Avg Latency</div>
                    <div className="text-2xl font-mono text-amber-400">{snapshot.metrics.avgLatency.toFixed(0)} <span className="text-sm text-slate-500">ms</span></div>
                </div>
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <div className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">CB State</div>
                    <div className={`text-xl font-mono font-bold ${snapshot.cbState === 'OPEN' ? 'text-red-500' : snapshot.cbState === 'HALF_OPEN' ? 'text-amber-500' : 'text-emerald-500'}`}>
                        {snapshot.cbState}
                    </div>
                </div>
            </div>

            {/* Canvas Animation */}
            <div className="relative">
                <CanvasRenderer snapshot={snapshot} config={config} />
                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end pointer-events-none">
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div> <span className="text-[10px] text-slate-400">Pending</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div> <span className="text-[10px] text-slate-400">Success</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div> <span className="text-[10px] text-slate-400">Failed</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-orange-500"></div> <span className="text-[10px] text-slate-400">Timeout</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-purple-500"></div> <span className="text-[10px] text-slate-400">Retrying</span>
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="flex flex-col md:flex-row gap-4 h-32">
                <TimeSeriesChart data={chartHistory.throughput} color="#10b981" label="Throughput (req/s)" />
                <TimeSeriesChart data={chartHistory.errors} color="#ef4444" label="Errors (fail/s)" />
                <TimeSeriesChart data={chartHistory.latency} color="#f59e0b" label="Latency (ms)" />
            </div>

            {/* Tutorial / Context */}
            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 text-sm text-slate-400">
                <h4 className="font-bold text-slate-300 mb-2 flex items-center gap-2"><AlertTriangle size={14}/> Scenarios to Try:</h4>
                <ul className="list-disc pl-5 space-y-1">
                    <li><strong>The Death Spiral:</strong> Set Latency high (1000ms), RPS high (30), and turn on "Retries (Fixed)" with no Circuit Breaker. Watch latency explode.</li>
                    <li><strong>Circuit Breaker Protection:</strong> In the scenario above, enable Circuit Breaker. Watch it "snap" open, giving the system breathing room.</li>
                    <li><strong>Bulkhead Defense:</strong> Turn on Bulkheads. The system simulates Lane 2 breaking (high latency). Notice how Lane 1 (top pipe) continues flowing smoothly.</li>
                </ul>
            </div>
        </div>

      </div>
    </div>
  );
}