import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";

import { config } from "./config.js";
import { CallSession, type TwilioStartMessage } from "./callSession.js";

const START_EVENT_TIMEOUT_MS = 5000;

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

wss.on("connection", (ws) => {
  // Twilio's Media Streams product does not reliably forward query
  // parameters on the <Stream> connection url, so callId travels instead as
  // a <Parameter> the voice webhook attaches - delivered here as
  // start.customParameters on the very first message Twilio sends on this
  // socket. Everything downstream (CallSession) waits for that.
  const timeout = setTimeout(() => {
    console.error("Rejected media stream connection: no start event within timeout");
    ws.close(1008, "no start event");
  }, START_EVENT_TIMEOUT_MS);

  const onFirstMessage = async (raw: WebSocket.RawData) => {
    ws.off("message", onFirstMessage);
    clearTimeout(timeout);

    let message: Partial<TwilioStartMessage>;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      console.error("Rejected media stream connection: first message was not valid JSON");
      ws.close(1008, "invalid start message");
      return;
    }

    if (message.event !== "start" || !message.start) {
      console.error(`Rejected media stream connection: first event was "${message.event}", expected "start"`);
      ws.close(1008, "expected start event first");
      return;
    }

    const callId = message.start.customParameters?.callId;
    if (!callId) {
      console.error("Rejected media stream connection: missing callId custom parameter");
      ws.close(1008, "missing callId");
      return;
    }

    console.log(`[call ${callId}] Twilio media stream connected`);

    try {
      const session = await CallSession.start(ws, callId, message.start);
      if (!session) {
        ws.close(1011, "call not found or not configured");
      }
    } catch (err) {
      console.error(`[call ${callId}] failed to start session`, err);
      ws.close(1011, "internal error");
    }
  };

  ws.on("message", onFirstMessage);
});

httpServer.listen(config.port, () => {
  console.log(`LeadOne realtime voice server listening on :${config.port} (ws path /media-stream)`);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, closing server");
  wss.close();
  httpServer.close(() => process.exit(0));
});
