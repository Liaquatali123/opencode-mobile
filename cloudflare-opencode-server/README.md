# OpenCode Server on Cloudflare Containers

This folder deploys the **OpenCode server** that the Android app [OpenCode Mobile](https://github.com/dzianisv/opencode-mobile) connects to. It does not deploy the Android app itself.

Source client: https://github.com/dzianisv/opencode-mobile  
Your repository: https://github.com/Liaquatali123/opencode-mobile

## Platform requirements and costs

- Cloudflare Containers require a **Workers Paid** plan (starts at USD $5/month). Container CPU, memory, disk and network usage can add charges. Check current pricing before enabling it.
- A Docker-compatible build is required. Cloudflare Workers Builds can build the Dockerfile when the repository is connected and the build root is set to this folder.
- This uses a `standard-1` container (4 GiB RAM). OpenCode needs outbound Internet access to reach AI providers.
- **Container local disk is ephemeral.** This starter keeps the container warm for up to 24 hours after activity, but Cloudflare can still stop or replace it. Do not keep the only copy of important source code in `/workspace`. Push work to GitHub frequently. Add and test an R2/FUSE or snapshot persistence layer before treating this as durable production storage.
- Never commit passwords or API keys.

## 1. Connect GitHub to Cloudflare

1. Open https://dash.cloudflare.com/
2. Go to **Workers & Pages → Create → Connect to Git**.
3. Select `Liaquatali123/opencode-mobile`.
4. Set the production branch to `main`.
5. Set **Root directory** to `cloudflare-opencode-server`.
6. Set the deploy command to `npx wrangler deploy`.
7. Make sure the project is configured for **Workers Builds / Containers**, not Pages static hosting.
8. Complete the first deployment. The first container image build can take several minutes.

If Cloudflare asks for a build command, use `npm install`. The deploy command must run from this folder.

## 2. Add Cloudflare secrets

After the first Worker deployment, open **Workers & Pages → liaquat-opencode-server → Settings → Variables and Secrets**. Add these as encrypted secrets:

- `OPENCODE_SERVER_PASSWORD` — a long unique password. The mobile app uses username `opencode` and this password. This secret is required.
- `OPENROUTER_API_KEY` — optional. Add this if you want OpenCode to use OpenRouter.

The Worker passes these secrets into the container at startup. Never put them in `wrangler.jsonc`, source code, GitHub, or screenshots.

For local CLI deployment instead:

```bash
npm install
npx wrangler login
npx wrangler secret put OPENCODE_SERVER_PASSWORD
# Optional:
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler deploy
```

## 3. Verify the deployment

Replace the example host with the Worker URL shown in Cloudflare:

```bash
curl https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/healthz
curl -u 'opencode:YOUR_SERVER_PASSWORD' \
  https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/global/health
```

The second command should return JSON containing `"healthy": true`.

## 4. Connect OpenCode Mobile

1. Install the Android app from the official release: https://github.com/dzianisv/opencode-mobile/releases/latest
2. Open the app and choose **Add Connection**.
3. Choose **Tunnel** or manual server connection.
4. Server URL: `https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev`
5. Username: `opencode`
6. Password: the value stored in Cloudflare secret `OPENCODE_SERVER_PASSWORD`.
7. Save and connect.

Use the Worker origin only. Do not append `/api` for this standalone server.

## API routes

All paths other than `/healthz` are forwarded to the OpenCode HTTP API, including server-sent event streams:

- `GET /global/health`
- `GET /doc`
- OpenCode project, session, file and event API routes

The OpenCode server's HTTP Basic authentication protects the API. Keep the Worker URL and password private.

## Persistence warning

Cloudflare Containers use ephemeral local disk by default. If the instance stops, its next start can have a fresh filesystem. This starter is suitable for testing the mobile connection and short-lived work, but is **not yet a durable cloud development workspace**. Commit or push project files to GitHub before leaving a session. Add a tested R2/FUSE or snapshot persistence strategy before relying on it for valuable uncommitted work.

## Architecture

```
OpenCode Mobile (Android)
        |
        | HTTPS + HTTP Basic Auth + SSE
        v
Cloudflare Worker (workers.dev)
        |
        v
Durable Object (single named instance)
        |
        v
Cloudflare Container (OpenCode CLI server :4096)
        |
        v
OpenRouter / other AI provider
```

## Upstream project

The Android client is the MIT-licensed project by `dzianisv`. This folder only supplies a separate server deployment target; it does not repackage or modify the Android client.
