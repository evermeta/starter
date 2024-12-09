export type HealthStatus = 'up' | 'down' | 'degraded';

export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: Date;
  details: Record<
    string,
    {
      status: HealthStatus;
      message?: string;
      error?: string;
      latency?: number;
    }
  >;
}

export interface HealthChecker {
  name: string;
  check: () => Promise<{
    status: HealthStatus;
    message?: string;
    error?: string;
    latency?: number;
  }>;
  abortController?: AbortController;
}
