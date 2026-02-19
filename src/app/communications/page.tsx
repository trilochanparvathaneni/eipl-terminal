import { getSessionUser } from "@/lib/auth-utils"
import { hasPermission } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { CommsPageClient } from "./comms-page-client"

export const metadata = {
  title: "Communications | EIPL Terminal Ops",
}

export default async function CommunicationsPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (!hasPermission(user.role, "comms:read")) redirect("/dashboard")

  return <CommsPageClient currentUserId={user.id} />
}
