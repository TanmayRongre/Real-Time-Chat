import http from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { Server } from "socket.io";
import { env } from "./config/env";
import { connectDB } from "./config/db";
import { corsOptions } from "./config/cors";
import { startKeepAlive } from "./utils/keepAlive";
import { registerChatSockets } from "./sockets/chat.socket";
import { errorHandler } from "./middlewares/error.middleware";
import healthRouter from "./routes/health.route";
import authRouter from "./routes/auth.route";
import userRouter from "./routes/user.route";
import chatRouter from "./routes/chat.route";

const app = express();
const httpServer = http.createServer(app);

// Initialize Socket.io with identical production CORS options
export const io = new Server(httpServer, {
  cors: corsOptions,
});

// Middlewares
app.use(helmet());
app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // Handle preflight across all routes
app.use(express.json());
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

// REST Routes
app.use("/api", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/conversations", chatRouter);

// Register Socket handlers
registerChatSockets(io);

// Global Error Handler
app.use(errorHandler);

// Connect Database
connectDB();

const PORT = parseInt(env.PORT, 10) || 5000;

if (process.env.NODE_ENV !== "test") {
  httpServer.listen(PORT, () => {
    console.log(
      `[Server] Running on port ${PORT} in ${process.env.NODE_ENV || env.NODE_ENV || "development"} mode`
    );
    // Initialize Render Keep-Alive self-ping in production
    startKeepAlive();
  });
}

export { app, httpServer };
