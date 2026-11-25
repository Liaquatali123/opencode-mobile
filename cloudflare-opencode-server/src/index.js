import { DurableObject } from "cloudflare:workers";

const PORT = 4096;
const STARTUP_ATTEMPTS = 90;
const STARTUP_DELAY_MS = 1000;

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/healthz") {
      return json({
        ok: true,
        service: "liaquat-opencode-server",
        runtime: "cloudflare-containers",
        note: "Worker is reachable. Check /global/health for OpenCode health."
      });
    }

    const id = env.OPENCODE_CONTAINER.idFromName("primary-opencode-server");
    return env.OPENCODE_CONTAINER.get(id).fetch(request);
  }
};

export class OpenCodeContainer extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.starting = undefined;
  }

  async fetch(request) {
    this.starting ??= this.startAndWait().finally(() => {
      this.starting = undefined;
    });

    try {
      await this.starting;
    } catch (error) {
      console.error("OpenCode container startup failed:", error);
      return json({ error: "OpenCode server failed to start", detail: String(error) }, 503);
    }

    const url = new URL(request.url);
    url.protocol = "http:";
    url.host = "opencode-container";
    const forwarded = new Request(url, request);
    forwarded.headers.delete("host");

    try {
      return await this.ctx.container.getTcpPort(PORT).fetch(forwarded);
    } catch (error) {
      console.error("OpenCode upstream request failed:", error);
      return json({ error: "Could not reach OpenCode container" }, 502);
    }
  }

  async startAndWait() {
    const container = this.ctx.container;

    if (!this.env.OPENCODE_SERVER_PASSWORD) {
      throw new Error("Missing OPENCODE_SERVER_PASSWORD Worker secret");
    }

    if (!container.running) {
      container.start({
        image: container.images.base,
        instance: "standard-1",
        enableInternet: true,
        env: {
          OPENCODE_SERVER_USERNAME: "opencode",
          OPENCODE_SERVER_PASSWORD: this.env.OPENCODE_SERVER_PASSWORD,
          ...(this.env.OPENROUTER_API_KEY
            ? { OPENROUTER_API_KEY: this.env.OPENROUTER_API_KEY }
            : {})
        }
      });
    }

    const timeout = Number(this.env.INACTIVITY_TIMEOUT_MS || "86400000");
    await container.setInactivityTimeout(Number.isFinite(timeout) ? timeout : 86400000);

    const auth = "Basic " + btoa("opencode:" + this.env.OPENCODE_SERVER_PASSWORD);
    const port = container.getTcpPort(PORT);

    for (let attempt = 0; attempt < STARTUP_ATTEMPTS; attempt++) {
      try {
        const response = await port.fetch("http://opencode-container/global/health", {
          headers: { authorization: auth },
          signal: AbortSignal.timeout(3000)
        });
        if (response.ok) {
          await response.body?.cancel();
          return;
        }
        await response.body?.cancel();
      } catch {
        // The container may still be booting.
      }
      await scheduler.wait(STARTUP_DELAY_MS);
    }

    throw new Error("OpenCode did not become healthy on port 4096 within 90 seconds");
  }
}
