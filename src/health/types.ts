export type HealthStatus = 'up' | 'down' | 'degraded';

export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: Date;
  details: {
    [key: string]: {
      status: HealthStatus;
      message?: string;
      error?: string;
      latency?: number;
    };
  };
}

export interface HealthChecker {
  name: string;
  check: () => Promise<any>;
  abortController?: AbortController;
}
