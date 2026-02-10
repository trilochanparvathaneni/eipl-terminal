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
        <BrandMark theme={t} size={100} />
        <h1 className="mt-3 text-2xl font-bold text-green-800 leading-tight">
          {t.productName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground italic">{t.tagline}</p>
      </div>
    )
  }

  // variant === "sidebar"
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <BrandMark theme={t} size={42} />
      <div className="min-w-0">
        <h1 className="text-sm font-bold text-green-800 leading-tight truncate">
          {t.productName}
        </h1>
        <p className="text-[10px] text-green-600 leading-tight truncate">
          {t.tagline}
        </p>
      </div>
    </div>
  )
}
