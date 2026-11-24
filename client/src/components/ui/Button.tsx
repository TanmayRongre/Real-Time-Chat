import React, { ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../utils/cn";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10b981]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090b]",
          "disabled:opacity-50 disabled:pointer-events-none active:scale-[0.985]",
          {
            "bg-[#10b981] text-[#09090b] font-semibold hover:bg-[#059669] shadow-sm":
              variant === "primary",
            "bg-[#121215] text-[#fafafa] border border-[#27272a] hover:bg-[#18181c] hover:border-[#3f3f46]":
              variant === "secondary",
            "text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#18181c]":
              variant === "ghost",
            "bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25":
              variant === "danger",
            "h-8 px-3 text-xs gap-1.5": size === "sm",
            "h-11 px-4 text-sm gap-2": size === "md",
            "h-12 px-6 text-base gap-2.5": size === "lg",
          },
          className,
        )}
        {...props}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin text-current" />}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
