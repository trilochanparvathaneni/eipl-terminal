"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatDateTime } from "@/lib/utils"
import { Bell, Check } from "lucide-react"

export default function NotificationsPage() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const r = await fetch("/api/notifications")
      if (!r.ok) throw new Error("Failed")
      return r.json()
    },
  })

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  })

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold">Notifications</h1>
      {isLoading ? (
        <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
      ) : (
        <div className="space-y-2">
          {data?.notifications?.map((n: any) => (
            <Card key={n.id} className={!n.readAt ? "border-primary/30 bg-primary/5" : ""}>
              <CardContent className="py-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Bell className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{n.subject}</p>
                    <p className="text-sm text-muted-foreground">{n.body}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDateTime(n.createdAt)}</p>
                  </div>
                </div>
                {!n.readAt && (
                  <Button variant="ghost" size="sm" onClick={() => markRead.mutate(n.id)}>
                    <Check className="h-3 w-3 mr-1" /> Read
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
          {(!data?.notifications || data.notifications.length === 0) && (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No notifications</CardContent></Card>
          )}
        </div>
      )}
    </div>
  )
}
