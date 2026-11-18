import React from "react";
import { SITE_CONFIG } from "@/config/site";

export type LogoVariant = "horizontal" | "stacked" | "mark" | "mono";
export type LogoSize = "sm" | "md" | "lg";
export type LogoTheme = "light" | "dark";

const SIZE_MAP: Record<LogoVariant, Record<LogoSize, { width: number; height: number }>> = {
  horizontal: {
    sm: { width: 132, height: 32 },
    md: { width: 164, height: 40 },
    lg: { width: 220, height: 54 },
  },
  stacked: {
    sm: { width: 96, height: 66 },
    md: { width: 140, height: 96 },
    lg: { width: 192, height: 132 },
  },
  mark: {
    sm: { width: 28, height: 28 },
    md: { width: 36, height: 36 },
    lg: { width: 52, height: 52 },
  },
  mono: {
    sm: { width: 28, height: 28 },
    md: { width: 36, height: 36 },
    lg: { width: 52, height: 52 },
  },
};

function resolveSrc(variant: LogoVariant, theme: LogoTheme): string {
  if (variant === "horizontal") {
    return theme === "dark"
      ? "/brand/logo-horizontal-cream.svg"
      : "/brand/logo-horizontal-plum.svg";
  }
  if (variant === "stacked") {
    return theme === "dark"
      ? "/brand/logo-stacked-cream.svg"
      : "/brand/logo-stacked-plum.svg";
  }
  if (variant === "mono") {
    return theme === "dark" ? "/brand/mark-mono-cream.svg" : "/brand/mark-mono-plum.svg";
  }
  return "/brand/mark.svg";
}

export function Logo({
  variant = "horizontal",
  size = "md",
  theme = "light",
  className = "",
}: {
  variant?: LogoVariant;
  size?: LogoSize;
  theme?: LogoTheme;
  className?: string;
}) {
  const dims = SIZE_MAP[variant][size];
  const src = resolveSrc(variant, theme);

  return (
    <img
      src={src}
      alt={SITE_CONFIG.name}
      width={dims.width}
      height={dims.height}
      className={`inline-block shrink-0 select-none ${className}`}
    />
  );
}
