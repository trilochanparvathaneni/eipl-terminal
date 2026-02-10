"use client"

import { resolveTheme, type BrandTheme } from "@/lib/brand/theme"

interface BrandMarkProps {
  /** Override resolved theme (useful when tenant context is already available) */
  theme?: BrandTheme
  /** Pixel size of the icon (width & height) */
  size?: number
  className?: string
}

/**
 * Renders the brand icon (logo mark) only.
 * Uses a plain <img> to avoid Next.js image optimisation blur at small sizes.
 */
export function BrandMark({ theme, size = 40, className = "" }: BrandMarkProps) {
  const t = theme ?? resolveTheme()

  return (
    <img
      src={t.logoSrc}
      alt={t.productName}
      width={size}
      height={size}
      className={`object-contain shrink-0 ${className}`}
    />
  )
}
