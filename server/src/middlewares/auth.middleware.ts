import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { User, IUser } from "../models/User";

export interface TokenPayload {
  userId: string;
  email: string;
}

export interface AuthRequest extends Request {
  user?: IUser;
  userId?: string;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Access denied. No token provided." });
      return;
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      res.status(401).json({ error: "Access denied. Invalid token format." });
      return;
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;

    const user = await User.findById(decoded.userId);
    if (!user) {
      res.status(401).json({ error: "User not found or token is invalid." });
      return;
    }

    req.user = user;
    req.userId = user._id.toString();
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token." });
  }
};
