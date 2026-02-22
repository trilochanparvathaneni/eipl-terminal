"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { CreateTaskModal } from "./create-task-modal"
import { Plus, CheckSquare } from "lucide-react"
import { cn } from "@/lib/utils"

interface Task {
  id: string
  title: string
  description: string | null
  priority: string
  status: string
  dueAt: string | null
  assignee: { id: string; name: string; role: string } | null
  createdBy: { id: string; name: string; role: string }
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-sky-500/20 text-sky-200",
  IN_PROGRESS: "bg-amber-500/20 text-amber-200",
  DONE: "bg-emerald-500/20 text-emerald-200",
  CANCELLED: "bg-slate-500/20 text-slate-300",
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "text-slate-300",
  MEDIUM: "text-sky-300",
  HIGH: "text-amber-300",
  URGENT: "text-red-300",
}

interface TaskPanelProps {
  conversationId: string
  prefillMessageId?: string | null
  prefillMessageBody?: string | null
  onClearPrefill?: () => void
}

export function TaskPanel({
  conversationId,
  prefillMessageId,
  prefillMessageBody,
  onClearPrefill,
}: TaskPanelProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/comms/tasks?conversationId=${conversationId}`)
      if (res.ok) {
        const data = await res.json()
        setTasks(data.tasks)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  // Auto-open modal when prefill data arrives
  useEffect(() => {
    if (prefillMessageId) {
      setModalOpen(true)
    }
  }, [prefillMessageId])

  async function handleStatusChange(taskId: string, status: string) {
    try {
      await fetch(`/api/comms/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      fetchTasks()
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-white/10 p-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <CheckSquare className="h-4 w-4" />
          Tasks
        </h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setModalOpen(true)}
          title="New task"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {loading && (
          <p className="py-4 text-center text-xs text-slate-400">Loading...</p>
        )}
        {!loading && tasks.length === 0 && (
          <div className="text-center py-8 space-y-2">
            <CheckSquare className="mx-auto h-8 w-8 text-slate-500" />
            <p className="text-xs text-slate-400">No tasks linked to this conversation</p>
          </div>
        )}
        {tasks.map((task) => (
          <div key={task.id} className="space-y-2 rounded-md border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium leading-tight">{task.title}</p>
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 font-medium", STATUS_COLORS[task.status] || "bg-slate-500/20 text-slate-300")}>
                {task.status.replace("_", " ")}
              </span>
            </div>

            {task.description && (
              <p className="line-clamp-2 text-xs text-slate-400">{task.description}</p>
            )}

            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className={cn("font-medium", PRIORITY_COLORS[task.priority])}>
                {task.priority}
              </span>
              {task.dueAt && (
                <span>Due {new Date(task.dueAt).toLocaleDateString()}</span>
              )}
              {task.assignee && (
                <span>→ {task.assignee.name}</span>
              )}
            </div>

            {task.status !== "DONE" && task.status !== "CANCELLED" && (
              <div className="flex gap-1">
                {task.status === "OPEN" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs flex-1"
                    onClick={() => handleStatusChange(task.id, "IN_PROGRESS")}
                  >
                    Start
                  </Button>
                )}
                {task.status === "IN_PROGRESS" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs flex-1"
                    onClick={() => handleStatusChange(task.id, "DONE")}
                  >
                    Mark Done
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-slate-400"
                  onClick={() => handleStatusChange(task.id, "CANCELLED")}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <CreateTaskModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open)
          if (!open && onClearPrefill) onClearPrefill()
        }}
        conversationId={conversationId}
        messageId={prefillMessageId ?? undefined}
        messageBody={prefillMessageBody ?? undefined}
        onCreated={() => {
          fetchTasks()
          if (onClearPrefill) onClearPrefill()
        }}
      />
    </div>
  )
}
