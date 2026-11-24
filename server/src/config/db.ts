import mongoose from "mongoose";
import { env } from "./env";

export const connectDB = async (): Promise<void> => {
  try {
    mongoose.connection.on("connected", () => {
      console.log("[Database] Mongoose connected to MongoDB");
    });

    mongoose.connection.on("error", (err) => {
      console.error("[Database] Mongoose connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("[Database] Mongoose disconnected");
    });

    const conn = await mongoose.connect(env.MONGO_URI);
    console.log(
      `[Database] MongoDB Connected successfully: ${conn.connection.host}/${conn.connection.name}`,
    );
  } catch (error) {
    console.error(`[Database Error] Initial connection failure:`, error);
  }
};
