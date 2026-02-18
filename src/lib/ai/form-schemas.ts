import { z } from "zod"

interface FieldDef {
  label: string
  type: "text" | "date" | "phone" | "email"
  required: boolean
  redact?: boolean
}

export interface FormSchema {
  label: string
  description: string
  zodSchema: z.ZodObject<any>
  openaiJsonSchema: object
  fields: Record<string, FieldDef>
}

/** Wrapper schema for each extracted field */
function fieldSchema(description: string, required: boolean) {
  return {
    type: "object" as const,
    properties: {
      value: { type: "string", description },
      confidence: { type: "number", description: "Confidence score 0-1" },
      source_quote: { type: "string", description: "Exact text from document that this was extracted from" },
      page_or_section: { type: "string", description: "Page number or section name where found" },
    },
    required: required ? ["value", "confidence"] : ["confidence"],
  }
}

const extractedFieldZod = z.object({
  value: z.string().optional(),
  confidence: z.number(),
  source_quote: z.string().optional(),
  page_or_section: z.string().optional(),
})

// ── Driver Onboarding ────────────────────────────────────────────────────────

const driverOnboardingFields: Record<string, FieldDef> = {
  full_name: { label: "Full Name", type: "text", required: true },
  phone: { label: "Phone Number", type: "phone", required: true },
  license_no: { label: "License Number", type: "text", required: true },
  license_expiry: { label: "License Expiry Date", type: "date", required: true },
  aadhaar_no: { label: "Aadhaar Number", type: "text", required: false, redact: true },
  address: { label: "Address", type: "text", required: true },
  emergency_contact_name: { label: "Emergency Contact Name", type: "text", required: false },
  emergency_contact_phone: { label: "Emergency Contact Phone", type: "phone", required: false },
}

const driverOnboardingSchema: FormSchema = {
  label: "Driver Onboarding",
  description: "Extract driver information from uploaded documents for onboarding",
  zodSchema: z.object(
    Object.fromEntries(
      Object.keys(driverOnboardingFields).map((k) => [k, extractedFieldZod])
    )
  ),
  openaiJsonSchema: {
    name: "driver_onboarding",
    strict: true,
    schema: {
      type: "object",
      properties: Object.fromEntries(
        Object.entries(driverOnboardingFields).map(([key, f]) => [
          key,
          fieldSchema(f.label, f.required),
        ])
      ),
      required: Object.keys(driverOnboardingFields),
      additionalProperties: false,
    },
  },
  fields: driverOnboardingFields,
}

// ── Vendor KYC ───────────────────────────────────────────────────────────────

const vendorKycFields: Record<string, FieldDef> = {
  vendor_name: { label: "Vendor Name", type: "text", required: true },
  gstin: { label: "GSTIN", type: "text", required: true },
  pan: { label: "PAN", type: "text", required: true, redact: true },
  address: { label: "Address", type: "text", required: true },
  bank_account_no: { label: "Bank Account Number", type: "text", required: true, redact: true },
  ifsc: { label: "IFSC Code", type: "text", required: true },
  bank_name: { label: "Bank Name", type: "text", required: true },
  contact_person: { label: "Contact Person", type: "text", required: false },
  contact_phone: { label: "Contact Phone", type: "phone", required: false },
  email: { label: "Email", type: "email", required: false },
}

const vendorKycSchema: FormSchema = {
  label: "Vendor KYC",
  description: "Extract vendor KYC information from uploaded documents",
  zodSchema: z.object(
    Object.fromEntries(
      Object.keys(vendorKycFields).map((k) => [k, extractedFieldZod])
    )
  ),
  openaiJsonSchema: {
    name: "vendor_kyc",
    strict: true,
    schema: {
      type: "object",
      properties: Object.fromEntries(
        Object.entries(vendorKycFields).map(([key, f]) => [
          key,
          fieldSchema(f.label, f.required),
        ])
      ),
      required: Object.keys(vendorKycFields),
      additionalProperties: false,
    },
  },
  fields: vendorKycFields,
}

// ── Registry ─────────────────────────────────────────────────────────────────

export const FORM_SCHEMAS: Record<string, FormSchema> = {
  driver_onboarding: driverOnboardingSchema,
  vendor_kyc: vendorKycSchema,
}
