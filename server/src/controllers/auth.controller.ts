import { Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import otpGenerator from "otp-generator";
import { User } from "../models/User";
import { Otp } from "../models/Otp";
import { sendOtpEmail } from "../utils/mailer";
import { env } from "../config/env";
import { AuthRequest } from "../middlewares/auth.middleware";

// Zod schemas for input validation
const sendOtpSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  name: z.string().trim().min(1).optional(),
});

const verifyOtpSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  otp: z
    .string()
    .length(6, "OTP must be exactly 6 digits")
    .regex(/^\d+$/, "OTP must contain only numbers"),
  name: z.string().trim().min(1).optional(),
});

export const sendOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = sendOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const { email } = parsed.data;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    const isExistingUser = Boolean(existingUser);

    // Generate 6-digit numeric OTP
    const rawOtp = otpGenerator.generate(6, {
      digits: true,
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false,
    });

    // Hash OTP with bcryptjs
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(rawOtp, salt);

    // Expires in 5 minutes
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Upsert into Otp collection
    await Otp.findOneAndUpdate(
      { email },
      { otpHash, expiresAt },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    // Send email or log fallback
    await sendOtpEmail(email, rawOtp);

    res.status(200).json({
      success: true,
      message: "Verification code sent successfully",
      isExistingUser,
    });
  } catch (error) {
    console.error("[sendOtp Error]", error);
    res.status(500).json({ error: "Failed to process OTP request" });
  }
};

export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = verifyOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const { email, otp, name } = parsed.data;

    // Retrieve active OTP record
    const otpRecord = await Otp.findOne({ email });
    if (!otpRecord) {
      res
        .status(400)
        .json({
          error:
            "Verification code expired or not found. Please request a new code.",
        });
      return;
    }

    // Verify expiration safety check
    if (new Date() > otpRecord.expiresAt) {
      await Otp.deleteOne({ _id: otpRecord._id });
      res
        .status(400)
        .json({
          error: "Verification code has expired. Please request a new code.",
        });
      return;
    }

    // Compare provided OTP with stored hash
    const isMatch = await bcrypt.compare(otp, otpRecord.otpHash);
    if (!isMatch) {
      res
        .status(400)
        .json({
          error: "Invalid verification code. Please check and try again.",
        });
      return;
    }

    // Delete used OTP
    await Otp.deleteOne({ _id: otpRecord._id });

    // Find or create User
    let user = await User.findOne({ email });
    if (!user) {
      const displayName = name || email.split("@")[0];
      user = await User.create({
        email,
        name: displayName,
      });
    }

    // Sign 7-day JWT token
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
      },
      env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatarColor: user.avatarColor,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("[verifyOtp Error]", error);
    res.status(500).json({ error: "Failed to verify OTP" });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized access" });
      return;
    }

    res.status(200).json({
      user: {
        id: req.user._id,
        email: req.user.email,
        name: req.user.name,
        avatarColor: req.user.avatarColor,
        isOnline: req.user.isOnline,
        lastSeen: req.user.lastSeen,
        createdAt: req.user.createdAt,
      },
    });
  } catch (error) {
    console.error("[getMe Error]", error);
    res.status(500).json({ error: "Failed to retrieve profile" });
  }
};
