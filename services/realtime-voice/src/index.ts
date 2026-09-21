import { createServer } from "node:http";
import { URL } from "node:url";
import { WebSocketServer } from "ws";

import { config } from "./config.js";
import { CallSession } from "./callSession.js";

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "leadone-realtime-voice" }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: httpServer, path: "/media-stream" });

wss.on("connection", async (ws, req) => {
  const url = new URL(req.url ?? "", "http://localhost");
  const callId = url.searchParams.get("callId");

  if (!callId) {
    console.error("Rejected media stream connection: missing callId query param");
    ws.close(1008, "missing callId");
    return;
  }

  console.log(`[call ${callId}] Twilio media stream connected`);

  try {
    const session = await CallSession.start(ws, callId);
    if (!session) {
      ws.close(1011, "call not found or not configured");
    }
  } catch (err) {
    console.error(`[call ${callId}] failed to start session`, err);
    ws.close(1011, "internal error");
  }
});

httpServer.listen(config.port, () => {
  console.log(`LeadOne realtime voice server listening on :${config.port} (ws path /media-stream)`);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, closing server");
  wss.close();
  httpServer.close(() => process.exit(0));
});
