import { getSessionUser } from "@/lib/auth-utils"
import { hasPermission } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { ChatPageClient } from "./chat-page-client"

export default async function ChatPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (!hasPermission(user.role, "chat:use")) redirect("/dashboard")

  return <ChatPageClient />
}
