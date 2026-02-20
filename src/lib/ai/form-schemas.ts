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

// ── Client Onboarding ────────────────────────────────────────────────────────

const clientOnboardingFields: Record<string, FieldDef> = {
  company_name:         { label: "Company Name",         type: "text",  required: true },
  gstin:                { label: "GSTIN",                type: "text",  required: true },
  pan:                  { label: "PAN",                  type: "text",  required: true,  redact: true },
  registered_address:   { label: "Registered Address",   type: "text",  required: true },
  contact_person:       { label: "Contact Person",       type: "text",  required: true },
  contact_email:        { label: "Contact Email",        type: "email", required: true },
  contact_phone:        { label: "Contact Phone",        type: "phone", required: true },
  billing_address:      { label: "Billing Address",      type: "text",  required: false },
  authorized_signatory: { label: "Authorized Signatory", type: "text",  required: false },
}

const clientOnboardingSchema: FormSchema = {
  label: "Client Onboarding",
  description: "Onboard a new client — fill directly or upload documents to auto-fill",
  zodSchema: z.object(
    Object.fromEntries(Object.keys(clientOnboardingFields).map((k) => [k, extractedFieldZod]))
  ),
  openaiJsonSchema: {
    name: "client_onboarding",
    strict: true,
    schema: {
      type: "object",
      properties: Object.fromEntries(
        Object.entries(clientOnboardingFields).map(([key, f]) => [key, fieldSchema(f.label, f.required)])
      ),
      required: Object.keys(clientOnboardingFields),
      additionalProperties: false,
    },
  },
  fields: clientOnboardingFields,
}

// ── Transporter Onboarding ───────────────────────────────────────────────────

const transporterOnboardingFields: Record<string, FieldDef> = {
  company_name:        { label: "Company Name",          type: "text",  required: true },
  gstin:               { label: "GSTIN",                 type: "text",  required: true },
  pan:                 { label: "PAN",                   type: "text",  required: true,  redact: true },
  registered_address:  { label: "Registered Address",    type: "text",  required: true },
  primary_contact:     { label: "Primary Contact",       type: "text",  required: true },
  contact_email:       { label: "Contact Email",         type: "email", required: true },
  contact_phone:       { label: "Contact Phone",         type: "phone", required: true },
  fleet_size:          { label: "Fleet Size",            type: "text",  required: false },
  vehicle_types:       { label: "Vehicle Types",         type: "text",  required: false },
  insurance_policy_no: { label: "Insurance Policy No.",  type: "text",  required: false },
  insurance_expiry:    { label: "Insurance Expiry Date", type: "date",  required: false },
}

const transporterOnboardingSchema: FormSchema = {
  label: "Transporter Onboarding",
  description: "Onboard a new transporter — fill directly or upload documents to auto-fill",
  zodSchema: z.object(
    Object.fromEntries(Object.keys(transporterOnboardingFields).map((k) => [k, extractedFieldZod]))
  ),
  openaiJsonSchema: {
    name: "transporter_onboarding",
    strict: true,
    schema: {
      type: "object",
      properties: Object.fromEntries(
        Object.entries(transporterOnboardingFields).map(([key, f]) => [key, fieldSchema(f.label, f.required)])
      ),
      required: Object.keys(transporterOnboardingFields),
      additionalProperties: false,
    },
  },
  fields: transporterOnboardingFields,
}

// ── Surveyor Onboarding ──────────────────────────────────────────────────────

const surveyorOnboardingFields: Record<string, FieldDef> = {
  full_name:           { label: "Full Name",              type: "text",  required: true },
  company_name:        { label: "Company Name",           type: "text",  required: true },
  registration_no:     { label: "Registration Number",    type: "text",  required: true },
  certification:       { label: "Certification",          type: "text",  required: false },
  certification_expiry:{ label: "Certification Expiry",   type: "date",  required: false },
  email:               { label: "Email",                  type: "email", required: true },
  phone:               { label: "Phone",                  type: "phone", required: true },
  address:             { label: "Address",                type: "text",  required: false },
  area_of_operation:   { label: "Area of Operation",      type: "text",  required: false },
}

const surveyorOnboardingSchema: FormSchema = {
  label: "Surveyor Onboarding",
  description: "Onboard a new surveyor — fill directly or upload documents to auto-fill",
  zodSchema: z.object(
    Object.fromEntries(Object.keys(surveyorOnboardingFields).map((k) => [k, extractedFieldZod]))
  ),
  openaiJsonSchema: {
    name: "surveyor_onboarding",
    strict: true,
    schema: {
      type: "object",
      properties: Object.fromEntries(
        Object.entries(surveyorOnboardingFields).map(([key, f]) => [key, fieldSchema(f.label, f.required)])
      ),
      required: Object.keys(surveyorOnboardingFields),
      additionalProperties: false,
    },
  },
  fields: surveyorOnboardingFields,
}

// ── HSE Contractor ───────────────────────────────────────────────────────────

const hseContractorFields: Record<string, FieldDef> = {
  company_name:     { label: "Company Name",      type: "text",  required: true },
  gstin:            { label: "GSTIN",             type: "text",  required: false },
  services_offered: { label: "Services Offered",  type: "text",  required: true },
  hse_cert_no:      { label: "HSE Certificate No", type: "text", required: false },
  cert_expiry:      { label: "Certificate Expiry", type: "date", required: false },
  contact_person:   { label: "Contact Person",    type: "text",  required: true },
  email:            { label: "Email",             type: "email", required: true },
  phone:            { label: "Phone",             type: "phone", required: true },
}

const hseContractorSchema: FormSchema = {
  label: "HSE Contractor",
  description: "Register an HSE contractor — fill directly or upload documents to auto-fill",
  zodSchema: z.object(
    Object.fromEntries(Object.keys(hseContractorFields).map((k) => [k, extractedFieldZod]))
  ),
  openaiJsonSchema: {
    name: "hse_contractor",
    strict: true,
    schema: {
      type: "object",
      properties: Object.fromEntries(
        Object.entries(hseContractorFields).map(([key, f]) => [key, fieldSchema(f.label, f.required)])
      ),
      required: Object.keys(hseContractorFields),
      additionalProperties: false,
    },
  },
  fields: hseContractorFields,
}

// ── Registry ─────────────────────────────────────────────────────────────────

export const FORM_SCHEMAS: Record<string, FormSchema> = {
  driver_onboarding:       driverOnboardingSchema,
  vendor_kyc:              vendorKycSchema,
  client_onboarding:       clientOnboardingSchema,
  transporter_onboarding:  transporterOnboardingSchema,
  surveyor_onboarding:     surveyorOnboardingSchema,
  hse_contractor:          hseContractorSchema,
}
