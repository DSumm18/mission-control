/**
 * Jarvis (OpenClaw) backend — WebSocket RPC to OpenClaw gateway.
 *
 * Protocol:
 * 1. Connect → receive connect.challenge with nonce
 * 2. Send connect request with token auth
 * 3. Use chat.send { sessionKey, idempotencyKey, message } → { runId }
 * 4. Stream deltas from "agent" events with stream: "assistant"
 * 5. Lifecycle phase: "end" signals completion
 *
 * Uses native WebSocket (Node 25.6.1) — no npm deps needed.
 */

import { randomUUID } from "crypto";

const GATEWAY_URL = "ws://127.0.0.1:18789";
const GATEWAY_TOKEN =
  process.env.OPENCLAW_GATEWAY_TOKEN ||
  "e86dfe5a59f0bac1f86bf86b532a05776e128a7cfa46d5f0";
const OPENCLAW_TIMEOUT = 180_000; // ms

export interface OpenClawStreamOptions {
  message: string;
  sessionId?: string;
  agentId?: string;
  context?: string;
}

/**
 * Open a WebSocket to the gateway and complete the connect handshake.
 * Returns the authenticated WebSocket ready for RPC calls.
 */
function connectGateway(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(GATEWAY_URL);
    let connectId: string | null = null;
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        ws.close();
        reject(new Error("OpenClaw gateway connect timeout"));
      }
    }, 10_000);

    ws.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(String(event.data));

        // Step 1: Receive challenge, send connect
        if (
          msg.type === "event" &&
          msg.event === "connect.challenge" &&
          !connectId
        ) {
          connectId = randomUUID();
          ws.send(
            JSON.stringify({
              type: "req",
              id: connectId,
              method: "connect",
              params: {
                minProtocol: 3,
                maxProtocol: 3,
                client: {
                  id: "gateway-client",
                  displayName: "Mission Control",
                  version: "1.0.0",
                  platform: "darwin",
                  mode: "backend",
                },
                caps: [],
                auth: { token: GATEWAY_TOKEN },
                role: "operator",
                scopes: ["operator.admin"],
              },
            }),
          );
          return;
        }

        // Step 2: Connect response
        if (msg.type === "res" && msg.id === connectId) {
          settled = true;
          clearTimeout(timer);
          if (msg.ok) {
            resolve(ws);
          } else {
            ws.close();
            reject(
              new Error(
                `OpenClaw connect failed: ${msg.error?.message || "unknown"}`,
              ),
            );
          }
        }
      } catch {
        // ignore parse errors
      }
    });

    ws.addEventListener("error", () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error("OpenClaw gateway unreachable"));
      }
    });

    ws.addEventListener("close", () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error("OpenClaw gateway closed during connect"));
      }
    });
  });
}

/**
 * Non-streaming call to OpenClaw agent. Returns full response.
 */
export async function openclawCall(
  opts: OpenClawStreamOptions,
): Promise<string> {
  const ws = await connectGateway();
  const sessionKey = opts.sessionId || "mc-bridge-" + randomUUID().slice(0, 8);

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let fullText = "";
    const runIdRef: { current: string | null } = { current: null };

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        ws.close();
        reject(new Error(`OpenClaw timeout after ${OPENCLAW_TIMEOUT / 1000}s`));
      }
    }, OPENCLAW_TIMEOUT);

    const chatId = randomUUID();

    ws.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(String(event.data));

        // chat.send response — get the runId
        if (msg.type === "res" && msg.id === chatId) {
          if (!msg.ok) {
            settled = true;
            clearTimeout(timer);
            ws.close();
            reject(
              new Error(
                `OpenClaw chat.send failed: ${msg.error?.message || "unknown"}`,
              ),
            );
          } else {
            runIdRef.current = msg.payload?.runId || null;
          }
          return;
        }

        // Agent events — data is nested in msg.payload
        if (msg.type === "event" && msg.event === "agent") {
          const p = msg.payload;
          if (!p || p.runId !== runIdRef.current) return;

          // Text delta
          if (p.stream === "assistant" && p.data?.delta) {
            fullText += p.data.delta;
            return;
          }

          // Lifecycle end
          if (p.stream === "lifecycle" && p.data?.phase === "end" && !settled) {
            settled = true;
            clearTimeout(timer);
            ws.close();
            resolve(fullText);
          }
        }
      } catch {
        // ignore
      }
    });

    ws.addEventListener("close", () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(fullText || "");
      }
    });

    // Send the chat message
    const fullMessage = opts.context
      ? `${opts.context}${opts.message}`
      : opts.message;
    ws.send(
      JSON.stringify({
        type: "req",
        id: chatId,
        method: "chat.send",
        params: {
          sessionKey,
          idempotencyKey: randomUUID(),
          message: fullMessage,
        },
      }),
    );
  });
}

/**
 * Async generator that yields text deltas as Jarvis streams its response.
 * Real streaming — yields each delta as it arrives from the gateway.
 */
export async function* openclawStream(
  opts: OpenClawStreamOptions,
): AsyncGenerator<string, void, undefined> {
  const ws = await connectGateway();
  const sessionKey = opts.sessionId || "mc-bridge-" + randomUUID().slice(0, 8);

  // Create a queue for streaming deltas
  const queue: { value: string | null; done: boolean }[] = [];
  let resolveWait: (() => void) | null = null;
  let runId: string | null = null;
  let error: Error | null = null;

  const timer = setTimeout(() => {
    error = new Error(`OpenClaw timeout after ${OPENCLAW_TIMEOUT / 1000}s`);
    queue.push({ value: null, done: true });
    resolveWait?.();
    ws.close();
  }, OPENCLAW_TIMEOUT);

  const chatId = randomUUID();

  ws.addEventListener("message", (event) => {
    try {
      const msg = JSON.parse(String(event.data));

      // chat.send response
      if (msg.type === "res" && msg.id === chatId) {
        if (!msg.ok) {
          error = new Error(
            `OpenClaw chat.send failed: ${msg.error?.message || "unknown"}`,
          );
          queue.push({ value: null, done: true });
          resolveWait?.();
          ws.close();
        } else {
          runId = msg.payload?.runId || null;
        }
        return;
      }

      // Agent events — data is nested in msg.payload
      if (msg.type === "event" && msg.event === "agent") {
        const p = msg.payload;
        if (!p || p.runId !== runId) return;

        // Text delta
        if (p.stream === "assistant" && p.data?.delta) {
          queue.push({ value: p.data.delta, done: false });
          resolveWait?.();
          return;
        }

        // Lifecycle end
        if (p.stream === "lifecycle" && p.data?.phase === "end") {
          clearTimeout(timer);
          queue.push({ value: null, done: true });
          resolveWait?.();
          ws.close();
        }
      }
    } catch {
      // ignore
    }
  });

  ws.addEventListener("close", () => {
    clearTimeout(timer);
    queue.push({ value: null, done: true });
    resolveWait?.();
  });

  // Send the chat message
  const fullMessage = opts.context
    ? `${opts.context}${opts.message}`
    : opts.message;
  ws.send(
    JSON.stringify({
      type: "req",
      id: chatId,
      method: "chat.send",
      params: {
        sessionKey,
        idempotencyKey: randomUUID(),
        message: fullMessage,
      },
    }),
  );

  // Yield deltas as they arrive
  while (true) {
    if (queue.length === 0) {
      await new Promise<void>((r) => {
        resolveWait = r;
      });
    }

    while (queue.length > 0) {
      const item = queue.shift()!;
      if (item.done) {
        if (error) throw error;
        return;
      }
      if (item.value) {
        yield item.value;
      }
    }
  }
}

/**
 * Check gateway health. Returns status object or throws.
 */
export async function openclawHealth(): Promise<Record<string, unknown>> {
  const ws = await connectGateway();

  return new Promise((resolve, reject) => {
    let settled = false;
    const requestId = randomUUID();

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        ws.close();
        reject(new Error("Health check timeout"));
      }
    }, 5_000);

    ws.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(String(event.data));
        if (msg.type === "res" && msg.id === requestId) {
          settled = true;
          clearTimeout(timer);
          ws.close();
          if (msg.ok) {
            resolve(msg.payload || { ok: true });
          } else {
            reject(new Error(msg.error?.message || "Health check failed"));
          }
        }
      } catch {
        // ignore
      }
    });

    ws.send(
      JSON.stringify({
        type: "req",
        id: requestId,
        method: "health",
        params: {},
      }),
    );
  });
}
