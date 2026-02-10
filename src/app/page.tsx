"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { getRoleDashboardPath } from "@/lib/rbac"

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      router.replace(getRoleDashboardPath(session.user.role as any))
    } else if (status === "unauthenticated") {
      router.replace("/login")
    }
  }, [status, session, router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  )
}
