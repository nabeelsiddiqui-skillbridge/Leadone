import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const config = {
  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  appInternalUrl: process.env.APP_INTERNAL_URL ?? "http://localhost:3000",
  workerSecret: required("CAMPAIGN_WORKER_SECRET"),
  workerId: process.env.HOSTNAME ?? `worker-${process.pid}`,
  // How often the scanner looks for campaigns/callbacks that are due.
  scanIntervalMs: Number(process.env.CAMPAIGN_SCAN_INTERVAL_MS ?? 15_000),
} as const;
