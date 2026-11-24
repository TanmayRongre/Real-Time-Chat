import { env } from "./env";

// Parse configured origins from CLIENT_URL (comma-separated or single)
const configuredOrigins = env.CLIENT_URL
  ? env.CLIENT_URL.split(",")
      .map((url) => url.trim().replace(/\/+$/, ""))
      .filter(Boolean)
  : ["http://localhost:5173"];

/**
 * Validates whether an incoming HTTP/WebSocket origin is permitted.
 */
export const isOriginAllowed = (origin: string | undefined): boolean => {
  // Allow requests with no origin (e.g., server-to-server, curl, mobile apps)
  if (!origin) return true;

  const normalizedOrigin = origin.replace(/\/+$/, "");

  // 1. Exact match with any configured CLIENT_URL
  if (configuredOrigins.includes(normalizedOrigin)) {
    return true;
  }

  // 2. Allow all Vercel production & preview deployments (*.vercel.app)
  if (/^https:\/\/[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.vercel\.app$/.test(normalizedOrigin)) {
    return true;
  }

  // 3. Allow localhost / 127.0.0.1 on any port for local development
  if (/^http:\/\/localhost(:\d+)?$/.test(normalizedOrigin) || /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(normalizedOrigin)) {
    return true;
  }

  return false;
};

/**
 * Express & Socket.io compatible CORS origin validator
 */
export const corsOriginValidator = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
): void => {
  if (isOriginAllowed(origin)) {
    callback(null, true);
  } else {
    console.warn(`[CORS Blocked] Request origin not allowed: ${origin}`);
    callback(new Error(`CORS policy does not allow access from origin: ${origin}`));
  }
};

/**
 * Shared CORS Configuration for Express and Socket.io
 */
export const corsOptions = {
  origin: corsOriginValidator,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

