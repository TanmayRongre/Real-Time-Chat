import nodemailer from "nodemailer";
import { env } from "../config/env";

const isGmail = env.SMTP_HOST?.toLowerCase().includes("gmail");
const port = Number(env.SMTP_PORT) || 587;
const secure = port === 465;

const hasSmtpConfig = Boolean(
  env.SMTP_USER &&
  env.SMTP_PASS &&
  env.SMTP_USER !== "test_user" &&
  env.SMTP_PASS !== "test_pass"
);

const transporter = hasSmtpConfig
  ? isGmail
    ? nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS, // 16-character App Password (not Gmail login password)
        },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 10000,
      })
    : nodemailer.createTransport({
        host: env.SMTP_HOST || "smtp.gmail.com",
        port,
        secure,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 10000,
      })
  : null;

export const sendOtpEmail = async (
  email: string,
  otp: string,
): Promise<boolean> => {
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Verification Code</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          background-color: #09090b;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #fafafa;
        }
        .container {
          max-width: 480px;
          margin: 40px auto;
          background: #121215;
          border: 1px solid #27272a;
          border-radius: 16px;
          padding: 36px 32px;
        }
        .brand {
          font-size: 13px;
          font-weight: 600;
          color: #10b981;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          margin-bottom: 20px;
        }
        .title {
          font-size: 20px;
          font-weight: 600;
          color: #fafafa;
          margin: 0 0 10px;
          letter-spacing: -0.02em;
        }
        .desc {
          font-size: 14px;
          line-height: 1.5;
          color: #a1a1aa;
          margin: 0 0 24px;
        }
        .otp-box {
          background-color: #18181c;
          border: 1px solid #3f3f46;
          border-radius: 12px;
          padding: 18px;
          text-align: center;
          font-family: 'JetBrains Mono', 'Courier New', Courier, monospace;
          font-size: 32px;
          font-weight: 700;
          letter-spacing: 10px;
          color: #10b981;
          margin-bottom: 24px;
        }
        .footer {
          font-size: 12px;
          color: #71717a;
          line-height: 1.5;
          border-top: 1px solid #27272a;
          padding-top: 16px;
          margin-top: 8px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="brand">LiveChat Verification</div>
        <h1 class="title">Verify your email address</h1>
        <p class="desc">Use the 6-digit code below to securely authenticate your session. This code will expire in 5 minutes.</p>
        <div class="otp-box">${otp}</div>
        <div class="footer">
          If you did not request this verification code, please disregard this email.
        </div>
      </div>
    </body>
    </html>
  `;

  // 1. Brevo HTTPS REST API (Port 443 - Sends to ANY email address in the world for FREE without requiring a custom domain)
  if (env.BREVO_API_KEY) {
    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": env.BREVO_API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          sender: {
            name: "LiveChat",
            email: env.SMTP_USER || "tanmayrongre2008@gmail.com",
          },
          to: [{ email }],
          subject: `${otp} is your LiveChat verification code`,
          htmlContent,
        }),
      });

      if (response.ok) {
        console.log(`[Brevo API] Verification email successfully delivered to ${email}`);
        return true;
      } else {
        const errData = await response.text();
        console.warn(`[Brevo API Warning] (${response.status}):`, errData);
      }
    } catch (brevoErr) {
      console.warn("[Brevo API Network Error]", brevoErr);
    }
  }

  // 2. Resend HTTPS REST API (Port 443 - Bypasses all Render free-tier SMTP blocks)
  if (env.RESEND_API_KEY) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "LiveChat <onboarding@resend.dev>",
          to: [email],
          subject: `${otp} is your LiveChat verification code`,
          html: htmlContent,
        }),
      });

      if (response.ok) {
        console.log(`[Resend API] Verification email delivered successfully to ${email}`);
        return true;
      } else {
        const errData = await response.text();
        console.warn(`[Resend API Warning] Failed to send via Resend (${response.status}):`, errData);
      }
    } catch (resendErr) {
      console.warn("[Resend API Network Error]", resendErr);
    }
  }

  // Developer Fallback: When real SMTP credentials are not yet configured
  if (!transporter) {
    console.log(`\n======================================================`);
    console.log(`[DEV OTP FALLBACK - Add real SMTP credentials in server/.env]`);
    console.log(`Email: ${email} -> OTP Code: ${otp}`);
    console.log(`======================================================\n`);
    return true;
  }

  try {
    const info = await transporter.sendMail({
      from: `"LiveChat" <${env.SMTP_USER}>`,
      to: email,
      subject: `${otp} is your LiveChat verification code`,
      text: `Your LiveChat verification code is: ${otp}. It expires in 5 minutes.`,
      html: htmlContent,
    });
    console.log(`[Email Dispatched] OTP sent to ${email} (Message ID: ${info.messageId})`);
    return true;
  } catch (error) {
    console.error("[Mailer Error] Failed to send email via SMTP, fallback to console log:", error);
    console.log(`\n======================================================`);
    console.log(`[DEV OTP FALLBACK] Email: ${email} -> Code: ${otp}`);
    console.log(`======================================================\n`);
    return true;
  }
};
