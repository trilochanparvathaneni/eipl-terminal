import { describe, expect, it } from "vitest"
import {
  extractFromDocumentText,
  validateExtractedAgainstBooking,
} from "@/lib/document-extraction"

describe("document extraction", () => {
  it("extracts booking/truck/quantity fields from text", () => {
    const text = `
      Booking: BK26DEMO01
      Truck No: TN22AB1234
      Quantity: 24 KL
      Product: Methanol
    `

    const result = extractFromDocumentText("LOADING_ORDER", text)
    expect(result.fields.bookingNo).toBe("BK26DEMO01")
    expect(result.fields.truckNumber).toBe("TN22AB1234")
    expect(result.fields.quantity).toBe(24)
    expect(result.fields.productName).toBe("Methanol")
  })

  it("flags mismatches against booking context", () => {
    const validation = validateExtractedAgainstBooking({
      fields: {
        bookingNo: "BK26DEMO99",
        truckNumber: "TN22AB9999",
        quantity: 12,
      },
      bookingNo: "BK26DEMO01",
      bookingQuantity: 24,
      latestTripTruckNumber: "TN22AB1234",
    })

    expect(validation.passed).toBe(false)
    expect(validation.mismatches.length).toBeGreaterThan(0)
  })
})
