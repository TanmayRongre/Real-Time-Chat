import { env } from "../config/env";

export const startKeepAlive = (): void => {
  const isProduction = process.env.NODE_ENV === "production" || env.NODE_ENV === "production";
  const targetUrl = process.env.RENDER_EXTERNAL_URL || env.RENDER_EXTERNAL_URL || process.env.SERVER_URL || env.SERVER_URL;

  if (!isProduction) {
    console.log("[Keep-Alive] Skipped (not running in production)");
    return;
  }

  if (!targetUrl) {
    console.log("[Keep-Alive] Skipped (neither RENDER_EXTERNAL_URL nor SERVER_URL defined)");
    return;
  }

  const cleanUrl = targetUrl.replace(/\/+$/, "");
  const pingEndpoint = `${cleanUrl}/api/health`;
  const PING_INTERVAL = 10 * 60 * 1000; // 10 minutes

  console.log(`[Keep-Alive] Initialized self-ping service targeting: ${pingEndpoint} every 10m`);

  // Initial ping after 30 seconds
  setTimeout(async () => {
    await performPing(pingEndpoint);
  }, 30 * 1000);

  // Recurring ping
  setInterval(async () => {
    await performPing(pingEndpoint);
  }, PING_INTERVAL);
};

async function performPing(url: string): Promise<void> {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "Render-KeepAlive-SelfPing/1.0" },
    });

    if (res.ok) {
      console.log(`[Keep-Alive] Pinged /api/health -> ${res.status} OK`);
    } else {
      console.warn(`[Keep-Alive] Pinged /api/health -> returned status ${res.status}`);
    }
  } catch (error: any) {
    // Catch so network hiccups never crash the node process
    console.error(`[Keep-Alive] Ping failed:`, error?.message || error);
  }
}

