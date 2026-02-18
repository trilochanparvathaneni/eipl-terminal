import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-utils"
import { hasPermission } from "@/lib/rbac"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"
import { FORM_SCHEMAS } from "@/lib/ai/form-schemas"
import { redactParams } from "@/lib/ai/redact"

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error
  if (!hasPermission(user!.role, "form:submit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { formType, formData, extractedData, documentRecordId } = body

  if (!formType || !formData) {
    return NextResponse.json({ error: "formType and formData are required" }, { status: 400 })
  }

  if (!FORM_SCHEMAS[formType]) {
    return NextResponse.json({ error: `Unknown form type: ${formType}` }, { status: 400 })
  }

  const submission = await prisma.formSubmission.create({
    data: {
      userId: user!.id,
      formType,
      formData,
      extractedData: extractedData || undefined,
      documentRecordId: documentRecordId || undefined,
      status: "CONFIRMED",
    },
  })

  await createAuditLog({
    actorUserId: user!.id,
    entityType: "form_submission",
    entityId: submission.id,
    action: "submit",
    after: redactParams({ formType, formData }),
  })

  return NextResponse.json({ submission }, { status: 201 })
}
