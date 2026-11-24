import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.string().default("5000"),
  MONGO_URI: z.string().default("mongodb://localhost:27017/realtime_chat"),
  JWT_SECRET: z.string().default("super_secret_jwt_key_phase_1_dev"),
  CLIENT_URL: z.string().default("http://localhost:5173"),
  RENDER_EXTERNAL_URL: z.string().optional(),
  SERVER_URL: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  BREVO_API_KEY: z.string().optional(),
});

export const env = envSchema.parse(process.env);
