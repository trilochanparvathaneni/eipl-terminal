"use client"

import { resolveTheme, type BrandTheme } from "@/lib/brand/theme"
import { BrandMark } from "./BrandMark"

interface BrandLockupProps {
  /** "sidebar" = compact horizontal, "auth" = large stacked for login page */
  variant: "sidebar" | "auth"
  /** Override resolved theme */
  theme?: BrandTheme
  className?: string
}

/**
 * Full brand lockup: icon + product name + tagline.
 * Two layout variants — sidebar (horizontal, compact) and auth (stacked, prominent).
 */
export function BrandLockup({ variant, theme, className = "" }: BrandLockupProps) {
  const t = theme ?? resolveTheme()

  if (variant === "auth") {
    return (
      <div className={`flex flex-col items-center ${className}`}>
        <BrandMark theme={t} size={80} />
      </div>
    )
  }

  // variant === "sidebar" — logo image already contains name + tagline
  return (
    <div className={`${className}`}>
      <BrandMark theme={t} size={48} />
    </div>
  )
}
