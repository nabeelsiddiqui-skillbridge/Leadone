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
  // a <Parameter> the voice webhook attaches - delivered here in
  // start.customParameters. Twilio's message sequence on a fresh socket is
  // "connected" first, then "start" - so this waits (up to a timeout) for
  // "start" specifically rather than treating the first message as it.
  const timeout = setTimeout(() => {
    ws.off("message", onMessage);
    console.error("Rejected media stream connection: no start event within timeout");
    ws.close(1008, "no start event");
  }, START_EVENT_TIMEOUT_MS);

  const onMessage = async (raw: WebSocket.RawData) => {
    let message: { event?: string; start?: TwilioStartMessage["start"] };
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return; // not JSON - ignore rather than fail the whole connection over one bad frame
    }

    if (message.event === "connected") return; // expected preamble, nothing to do with it
    if (message.event !== "start" || !message.start) return; // keep waiting for "start"

    ws.off("message", onMessage);
    clearTimeout(timeout);

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

  ws.on("message", onMessage);
});

httpServer.listen(config.port, () => {
  console.log(`LeadOne realtime voice server listening on :${config.port} (ws path /media-stream)`);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, closing server");
  wss.close();
  httpServer.close(() => process.exit(0));
});
