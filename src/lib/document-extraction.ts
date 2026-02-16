import path from "path"
import { promises as fs } from "fs"

export interface ExtractedDocumentResult {
  fields: Record<string, string | number>
  warnings: string[]
  confidence: number
}

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, "\n")
}

function matchFirst(text: string, pattern: RegExp): string | null {
  const m = text.match(pattern)
  return m?.[1]?.trim() ?? null
}

function matchSecond(text: string, pattern: RegExp): string | null {
  const m = text.match(pattern)
  return m?.[2]?.trim() ?? null
}

function parseTruckNumber(text: string): string | null {
  const m = text.match(/\b([A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,3}\s?\d{3,4})\b/i)
  return m ? m[1].replace(/\s+/g, "").toUpperCase() : null
}

function parseQuantity(text: string): number | null {
  const m = text.match(/\b(quantity|qty|volume)\s*[:=-]?\s*(\d+(?:\.\d+)?)\s*(kl|l|mt)?\b/i)
  if (!m) return null
  return Number(m[2])
}

export function extractFromDocumentText(
  documentTypeCode: string,
  rawText: string
): ExtractedDocumentResult {
  const text = normalizeText(rawText)
  const fields: Record<string, string | number> = {}
  const warnings: string[] = []

  const bookingNo = matchFirst(text, /\b(BK[0-9A-Z-]{4,})\b/i)
  if (bookingNo) fields.bookingNo = bookingNo.toUpperCase()

  const invoiceNo = matchSecond(text, /\b(invoice\s*(?:no|number)?|inv)\s*[:#-]?\s*([A-Z0-9/-]{4,})/i)
  if (invoiceNo) fields.invoiceNo = invoiceNo.toUpperCase()

  const truckNumber = parseTruckNumber(text)
  if (truckNumber) fields.truckNumber = truckNumber

  const quantity = parseQuantity(text)
  if (quantity != null) fields.quantity = quantity

  const product = matchSecond(text, /\b(product|material|cargo)\s*[:=-]?\s*([A-Z0-9 .-]{3,})/i)
  if (product) fields.productName = product

  const driverLicense = matchSecond(text, /\b(license|dl)\s*(?:no|number)?\s*[:#-]?\s*([A-Z0-9-]{6,})/i)
  if (driverLicense) fields.driverLicenseNo = driverLicense.toUpperCase()

  if (Object.keys(fields).length === 0) {
    warnings.push(`No extractable fields found for ${documentTypeCode}`)
  }

  let confidence = 0.35
  if (fields.bookingNo) confidence += 0.2
  if (fields.truckNumber) confidence += 0.2
  if (fields.quantity != null) confidence += 0.15
  if (fields.productName) confidence += 0.1
  if (fields.invoiceNo || fields.driverLicenseNo) confidence += 0.1
  if (confidence > 0.95) confidence = 0.95

  return { fields, warnings, confidence }
}

export async function readLocalUploadText(fileUrl: string): Promise<string | null> {
  if (!fileUrl.startsWith("/uploads/")) return null
  const ext = path.extname(fileUrl).toLowerCase()
  const textLike = new Set([".txt", ".json", ".csv", ".log"])
  if (!textLike.has(ext)) return null

  const filePath = path.join(process.cwd(), "public", fileUrl.replace(/^\//, ""))
  try {
    return await fs.readFile(filePath, "utf8")
  } catch {
    return null
  }
}

function getLocalUploadPath(fileUrl: string): string | null {
  if (!fileUrl.startsWith("/uploads/")) return null
  return path.join(process.cwd(), "public", fileUrl.replace(/^\//, ""))
}

export async function extractTextFromUploadedDocument(fileUrl: string): Promise<string | null> {
  const filePath = getLocalUploadPath(fileUrl)
  if (!filePath) return null

  const ext = path.extname(fileUrl).toLowerCase()
  const textLike = new Set([".txt", ".json", ".csv", ".log"])
  const imageLike = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"])

  if (textLike.has(ext)) {
    try {
      return await fs.readFile(filePath, "utf8")
    } catch {
      return null
    }
  }

  if (ext === ".pdf") {
    try {
      const pdfParseMod = await import("pdf-parse")
      const pdfParse = (pdfParseMod as any).default || (pdfParseMod as any)
      const buf = await fs.readFile(filePath)
      const parsed = await pdfParse(buf)
      const text = typeof parsed?.text === "string" ? parsed.text.trim() : ""
      return text || null
    } catch {
      return null
    }
  }

  if (imageLike.has(ext)) {
    try {
      const tesseractMod = await import("tesseract.js")
      const recognize =
        (tesseractMod as any).recognize ||
        (tesseractMod as any).default?.recognize
      if (!recognize) return null

      const result = await recognize(filePath, "eng")
      const text = result?.data?.text?.trim?.() || ""
      return text || null
    } catch {
      return null
    }
  }

  return null
}

export interface ValidationResult {
  passed: boolean
  mismatches: string[]
}

export function validateExtractedAgainstBooking(params: {
  fields: Record<string, string | number>
  bookingNo?: string
  bookingProductName?: string
  bookingQuantity?: number
  latestTripTruckNumber?: string | null
}): ValidationResult {
  const mismatches: string[] = []
  const {
    fields,
    bookingNo,
    bookingProductName,
    bookingQuantity,
    latestTripTruckNumber,
  } = params

  if (bookingNo && typeof fields.bookingNo === "string" && fields.bookingNo.toUpperCase() !== bookingNo.toUpperCase()) {
    mismatches.push(`Booking no mismatch (${fields.bookingNo} != ${bookingNo})`)
  }

  if (
    bookingProductName &&
    typeof fields.productName === "string" &&
    !fields.productName.toLowerCase().includes(bookingProductName.toLowerCase())
  ) {
    mismatches.push(`Product mismatch (${fields.productName} != ${bookingProductName})`)
  }

  if (
    latestTripTruckNumber &&
    typeof fields.truckNumber === "string" &&
    fields.truckNumber.toUpperCase() !== latestTripTruckNumber.toUpperCase()
  ) {
    mismatches.push(`Truck number mismatch (${fields.truckNumber} != ${latestTripTruckNumber})`)
  }

  if (bookingQuantity != null && typeof fields.quantity === "number") {
    const delta = Math.abs(fields.quantity - bookingQuantity)
    if (delta > 0.5) {
      mismatches.push(`Quantity mismatch (${fields.quantity} != ${bookingQuantity})`)
    }
  }

  return { passed: mismatches.length === 0, mismatches }
}
