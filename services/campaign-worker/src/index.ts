import { Queue } from "bullmq";

import { config } from "./config.js";
import { scanCampaignsOnce } from "./scanner.js";
import { scanCallbacksOnce } from "./callbackScanner.js";
import { startCallWorker } from "./startCallWorker.js";
import type { PlaceCallJobData } from "./placeCall.js";

const queue = new Queue<PlaceCallJobData>("leadone-start-call", {
  connection: { url: config.redisUrl },
});

const worker = startCallWorker();
worker.on("failed", (job, err) => {
  console.error(`start_call job ${job?.id} failed permanently:`, err.message);
});

let scanning = false;

async function tick() {
  if (scanning) {
    console.warn("Previous scan still running, skipping this tick");
    return;
  }
  scanning = true;
  try {
    const [campaignResult, callbacksPlaced] = await Promise.all([
      scanCampaignsOnce(queue),
      scanCallbacksOnce(queue),
    ]);
    if (campaignResult.enqueued > 0 || callbacksPlaced > 0) {
      console.log(
        `Scanned ${campaignResult.campaignsScanned} running campaign(s): enqueued ${campaignResult.enqueued} call(s); placed ${callbacksPlaced} callback(s).`
      );
    }
  } catch (err) {
    console.error("Scan tick failed:", err);
  } finally {
    scanning = false;
  }
}

console.log(`LeadOne campaign worker starting. Scanning every ${config.scanIntervalMs}ms.`);
const interval = setInterval(tick, config.scanIntervalMs);
void tick(); // run immediately on boot instead of waiting for the first interval

async function shutdown() {
  console.log("Shutting down campaign worker...");
  clearInterval(interval);
  await worker.close();
  await queue.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
