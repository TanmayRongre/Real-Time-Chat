import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  Mail,
  User as UserIcon,
  ArrowLeft,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { api } from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { OtpInput } from "../components/auth/OtpInput";
import { Button } from "../components/ui/Button";
import { AuthResponse } from "../types";

gsap.registerPlugin(useGSAP);

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Animation container refs
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const emailStepRef = useRef<HTMLDivElement>(null);
  const otpStepRef = useRef<HTMLDivElement>(null);
  const otpInputContainerRef = useRef<HTMLDivElement>(null);

  // 30-second resend countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Entrance animation
  useGSAP(
    () => {
      gsap.from(cardRef.current, {
        opacity: 0,
        y: 20,
        duration: 0.6,
        ease: "power3.out",
      });
    },
    { scope: containerRef },
  );

  // Context-safe animations
  const { contextSafe } = useGSAP({ scope: containerRef });

  const triggerShake = contextSafe(() => {
    setOtpError(true);
    gsap.fromTo(
      otpInputContainerRef.current,
      { x: -10 },
      {
        x: 0,
        duration: 0.45,
        ease: "elastic.out(1, 0.3)",
      },
    );
  });

  const transitionToOtp = contextSafe(() => {
    if (!emailStepRef.current || !otpStepRef.current) {
      setStep("otp");
      return;
    }

    gsap.to(emailStepRef.current, {
      opacity: 0,
      x: -24,
      duration: 0.25,
      ease: "power2.in",
      onComplete: () => {
        setStep("otp");
        gsap.fromTo(
          otpStepRef.current,
          { opacity: 0, x: 24 },
          { opacity: 1, x: 0, duration: 0.35, ease: "power2.out" },
        );
      },
    });
  });

  const transitionToEmail = contextSafe(() => {
    if (!otpStepRef.current || !emailStepRef.current) {
      setStep("email");
      return;
    }

    gsap.to(otpStepRef.current, {
      opacity: 0,
      x: 24,
      duration: 0.25,
      ease: "power2.in",
      onComplete: () => {
        setStep("email");
        setOtp("");
        setOtpError(false);
        gsap.fromTo(
          emailStepRef.current,
          { opacity: 0, x: -24 },
          { opacity: 1, x: 0, duration: 0.35, ease: "power2.out" },
        );
      },
    });
  });

  // Handle Step A: Send OTP
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post<AuthResponse & { devOtp?: string }>("/auth/send-otp", {
        email: trimmedEmail,
        name: name.trim() || undefined,
      });

      if (res.data?.devOtp) {
        console.log(`%c[Dev OTP]: ${res.data.devOtp}`, "color: #10b981; font-weight: bold; font-size: 14px;");
      }

      toast.success("Verification code dispatched to your email");
      setResendCooldown(30);
      transitionToOtp();
    } catch (err: any) {
      const errMsg =
        err.response?.data?.error || "Failed to send verification code";
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Step B: Verify OTP
  const handleVerifyOtp = async (codeToVerify?: string) => {
    const targetCode = (codeToVerify || otp).trim();

    if (targetCode.length !== 6) {
      toast.error("Please enter all 6 digits");
      triggerShake();
      return;
    }

    setIsSubmitting(true);
    setOtpError(false);

    try {
      const response = await api.post<AuthResponse>("/auth/verify-otp", {
        email: email.trim().toLowerCase(),
        otp: targetCode,
        name: name.trim() || undefined,
      });

      if (response.data.token && response.data.user) {
        login(response.data.token, response.data.user);
        toast.success(`Welcome, ${response.data.user.name}`);
        navigate("/");
      } else {
        throw new Error(
          "Missing authentication credentials in server response",
        );
      }
    } catch (err: any) {
      const errMsg =
        err.response?.data?.error || "Invalid or expired verification code";
      toast.error(errMsg);
      triggerShake();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resend OTP handler
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await api.post<AuthResponse>("/auth/send-otp", {
        email: email.trim().toLowerCase(),
      });
      setResendCooldown(30);
      setOtp("");
      setOtpError(false);
      toast.success("A fresh code has been sent");
    } catch (err: any) {
      const errMsg = err.response?.data?.error || "Failed to resend code";
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="min-h-screen w-full flex items-center justify-center p-4 bg-[#09090b] text-[#fafafa] relative overflow-hidden"
    >
      {/* Subtle architectural background texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 30%, #1a1a24 0%, transparent 60%)`,
        }}
      />

      {/* Main Card */}
      <div
        ref={cardRef}
        className="w-full max-w-md relative z-10 bg-[#121215] border border-[#27272a] rounded-2xl p-7 sm:p-8 shadow-2xl backdrop-blur-md"
      >
        {/* Brand header */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-lg bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center text-[#10b981]">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-sm tracking-tight text-[#fafafa]">
              LiveChat
            </span>
            <span className="text-xs text-[#71717a] ml-2">Studio Edition</span>
          </div>
        </div>

        {/* STEP A: Email Entry */}
        {step === "email" && (
          <div ref={emailStepRef} className="space-y-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#fafafa]">
                Welcome to LiveChat
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-[#a1a1aa] leading-relaxed">
                Enter your email address to log in or create your account with a
                secure one-time passcode.
              </p>
            </div>

            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#a1a1aa] block">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#71717a] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    autoFocus
                    className="w-full h-11 pl-10 pr-3.5 bg-[#09090b] border border-[#27272a] hover:border-[#3f3f46] focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981]/40 rounded-xl text-sm text-[#fafafa] placeholder:text-[#52525b] outline-none transition-all duration-150"
                  />
                </div>
              </div>

              {/* Display Name field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-[#a1a1aa] block">
                    Display Name
                  </label>
                  <span className="text-[11px] text-[#71717a]">Optional</span>
                </div>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-[#71717a] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex Smith"
                    className="w-full h-11 pl-10 pr-3.5 bg-[#09090b] border border-[#27272a] hover:border-[#3f3f46] focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981]/40 rounded-xl text-sm text-[#fafafa] placeholder:text-[#52525b] outline-none transition-all duration-150"
                  />
                </div>
              </div>

              <Button
                type="submit"
                loading={isSubmitting}
                className="w-full mt-2"
              >
                Continue with Passcode
              </Button>
            </form>

            <div className="pt-2 border-t border-[#27272a]/60 text-center">
              <p className="text-[11px] text-[#71717a] leading-relaxed">
                By signing in, you agree to secure end-to-end messaging and
                session encryption.
              </p>
            </div>
          </div>
        )}

        {/* STEP B: 6-Digit OTP Entry */}
        {step === "otp" && (
          <div ref={otpStepRef} className="space-y-6">
            <div>
              <button
                type="button"
                onClick={transitionToEmail}
                className="inline-flex items-center gap-1.5 text-xs text-[#a1a1aa] hover:text-[#fafafa] transition-colors mb-3.5 group cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
                Change email
              </button>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#fafafa]">
                Enter 6-digit code
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-[#a1a1aa]">
                We sent a temporary code to{" "}
                <span className="text-[#fafafa] font-medium font-mono-numbers">
                  {email}
                </span>
                .
              </p>
            </div>

            <div ref={otpInputContainerRef} className="py-2">
              <OtpInput
                value={otp}
                onChange={(newVal) => {
                  setOtp(newVal);
                  if (otpError) setOtpError(false);
                }}
                onComplete={handleVerifyOtp}
                disabled={isSubmitting}
                hasError={otpError}
              />
            </div>

            <div className="space-y-3">
              <Button
                type="button"
                onClick={() => handleVerifyOtp()}
                loading={isSubmitting}
                className="w-full"
              >
                Verify & Enter
              </Button>

              <div className="flex items-center justify-between text-xs text-[#71717a] pt-1">
                <span>Didn't receive code?</span>
                {resendCooldown > 0 ? (
                  <span className="font-mono-numbers text-[#a1a1aa]">
                    Resend in {resendCooldown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1 text-[#10b981] hover:text-[#059669] font-medium transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Resend code
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
