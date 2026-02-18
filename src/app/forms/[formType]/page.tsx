import { getSessionUser } from "@/lib/auth-utils"
import { hasPermission } from "@/lib/rbac"
import { redirect, notFound } from "next/navigation"
import { FORM_SCHEMAS } from "@/lib/ai/form-schemas"
import { FormExtractor } from "@/components/forms/form-extractor"

export default async function FormTypePage({
  params,
}: {
  params: Promise<{ formType: string }>
}) {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (!hasPermission(user.role, "form:submit")) redirect("/dashboard")

  const { formType } = await params
  const schema = FORM_SCHEMAS[formType]
  if (!schema) notFound()

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">{schema.label}</h1>
      <p className="text-muted-foreground mb-6">{schema.description}</p>
      <FormExtractor formType={formType} fields={schema.fields} />
    </div>
  )
}
