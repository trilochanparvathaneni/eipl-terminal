import { getSessionUser } from "@/lib/auth-utils"
import { hasPermission } from "@/lib/rbac"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Building2 } from "lucide-react"

const FORM_TYPES = [
  {
    key: "driver_onboarding",
    title: "Driver Onboarding",
    description: "Upload driver documents to auto-fill onboarding form",
    icon: FileText,
  },
  {
    key: "vendor_kyc",
    title: "Vendor KYC",
    description: "Upload vendor documents to auto-fill KYC verification form",
    icon: Building2,
  },
]

export default async function FormsPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (!hasPermission(user.role, "form:submit")) redirect("/dashboard")

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Document Forms</h1>
      <p className="text-muted-foreground mb-6">
        Upload documents to auto-extract and prefill form fields using AI
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FORM_TYPES.map((form) => (
          <Link key={form.key} href={`/forms/${form.key}`}>
            <Card className="hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                    <form.icon className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{form.title}</CardTitle>
                    <CardDescription>{form.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
