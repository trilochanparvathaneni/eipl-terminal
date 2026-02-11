"use client"

import { resolveTheme, type BrandTheme } from "@/lib/brand/theme"

interface BrandMarkProps {
  /** Override resolved theme (useful when tenant context is already available) */
  theme?: BrandTheme
  /** Pixel height of the logo — width scales automatically to preserve aspect ratio */
  size?: number
  /** "icon" crops to square (for favicons etc.), "full" preserves the original ratio */
  variant?: "full" | "icon"
  className?: string
}

/**
 * Renders the brand logo.
 * Uses a plain <img> to avoid Next.js image optimisation blur at small sizes.
 */
export function BrandMark({ theme, size = 40, variant = "full", className = "" }: BrandMarkProps) {
  const t = theme ?? resolveTheme()

  if (variant === "icon") {
    return (
      <div
        className={`shrink-0 rounded-md bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden ${className}`}
        style={{ width: size, height: size }}
      >
        <img
          src={t.logoSrc}
          alt={t.productName}
          width={size}
          height={size}
          className="object-cover"
        />
      </div>
    )
  }

  return (
    <img
      src={t.logoSrc}
      alt={t.productName}
      className={`object-contain w-full max-h-20 ${className}`}
    />
  )
}
