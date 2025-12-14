import * as net from "node:net";
import * as amqplib from "amqplib";

export const TEST_REDIS_URL =
  process.env.CELERYPLUS_TEST_REDIS_URL || "redis://localhost:6379/0";

export const TEST_AMQP_URL =
  process.env.CELERYPLUS_TEST_AMQP_URL || "amqp://localhost:5672/";

function parseHostPort(urlString: string, defaultPort: number): { host: string; port: number } {
  const parsed = new URL(urlString);
  return {
    host: parsed.hostname || "localhost",
    port: parsed.port ? Number(parsed.port) : defaultPort
  };
}

async function isTcpOpen(host: string, port: number, timeoutMs = 750): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const onDone = (ok: boolean) => {
      try {
        socket.removeAllListeners();
        socket.destroy();
      } catch {
        // ignore
      }
      resolve(ok);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => onDone(true));
    socket.once("timeout", () => onDone(false));
    socket.once("error", () => onDone(false));
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function isRedisAvailable(url = TEST_REDIS_URL): Promise<boolean> {
  const { host, port } = parseHostPort(url, 6379);
  return isTcpOpen(host, port);
}

export async function skipIfRedisUnavailable(ctx: any, url = TEST_REDIS_URL): Promise<boolean> {
  const ok = await isRedisAvailable(url);
  if (!ok) ctx?.skip?.();
  return ok;
}

export async function isAmqpAvailable(url = TEST_AMQP_URL): Promise<boolean> {
  const { host, port } = parseHostPort(url, 5672);

  // Fast path: if TCP isn't open, AMQP won't work.
  const tcpOk = await isTcpOpen(host, port);
  if (!tcpOk) return false;

  // Retry a real AMQP handshake (Rabbit can take a bit to become ready).
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const conn = await amqplib.connect(url, { timeout: 1000 } as any);
      await conn.close();
      return true;
    } catch {
      await sleep(250);
    }
  }

  return false;
}

export async function skipIfAmqpUnavailable(ctx: any, url = TEST_AMQP_URL): Promise<boolean> {
  const ok = await isAmqpAvailable(url);
  if (!ok) ctx?.skip?.();
  return ok;
}
