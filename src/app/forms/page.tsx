import { getSessionUser } from "@/lib/auth-utils"
import { hasPermission } from "@/lib/rbac"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Building2, Truck, ClipboardCheck, ShieldCheck } from "lucide-react"

const FORM_TYPES = [
  {
    key: "driver_onboarding",
    title: "Driver Onboarding",
    description: "Fill directly or upload driver documents to auto-fill",
    icon: FileText,
  },
  {
    key: "vendor_kyc",
    title: "Vendor KYC",
    description: "Fill directly or upload vendor documents to auto-fill KYC fields",
    icon: Building2,
  },
  {
    key: "client_onboarding",
    title: "Client Onboarding",
    description: "Fill directly or upload documents to onboard a new client",
    icon: Building2,
  },
  {
    key: "transporter_onboarding",
    title: "Transporter Onboarding",
    description: "Fill directly or upload documents to onboard a new transporter",
    icon: Truck,
  },
  {
    key: "surveyor_onboarding",
    title: "Surveyor Onboarding",
    description: "Fill directly or upload documents to onboard a new surveyor",
    icon: ClipboardCheck,
  },
  {
    key: "hse_contractor",
    title: "HSE Contractor",
    description: "Fill directly or upload documents to register an HSE contractor",
    icon: ShieldCheck,
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
        Fill forms directly or upload documents to auto-extract fields using AI
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
