import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-utils"
import { createAuditLog } from "@/lib/audit"
import { sendNotification } from "@/lib/notifications"
import { updateTaskSchema } from "@/lib/comms/validations"
import { hasPermission } from "@/lib/rbac"

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireAuth()
  if (error) return error

  if (!hasPermission(user!.role, "tasks:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const existing = await prisma.task.findUnique({
    where: { id: params.id },
  })

  if (!existing) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 })
  }

  // Ownership check: only creator, assignee, or admins can update
  const isAdmin = user!.role === "SUPER_ADMIN" || user!.role === "TERMINAL_ADMIN"
  const isOwner = existing.createdByUserId === user!.id
  const isAssignee = existing.assigneeId === user!.id

  if (!isAdmin && !isOwner && !isAssignee) {
    return NextResponse.json({ error: "Not authorized to update this task" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = updateTaskSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const data = parsed.data

  try {
    const before = {
      title: existing.title,
      status: existing.status,
      priority: existing.priority,
      assigneeId: existing.assigneeId,
    }

    const task = await prisma.task.update({
      where: { id: params.id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.assigneeId !== undefined ? { assigneeId: data.assigneeId } : {}),
        ...(data.dueAt !== undefined
          ? { dueAt: data.dueAt ? new Date(data.dueAt) : null }
          : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.visibility !== undefined ? { visibility: data.visibility } : {}),
      },
      include: {
        assignee: { select: { id: true, name: true, role: true } },
        createdBy: { select: { id: true, name: true, role: true } },
        taskLinks: true,
      },
    })

    await createAuditLog({
      actorUserId: user!.id,
      entityType: "Task",
      entityId: task.id,
      action: "UPDATE",
      before,
      after: {
        title: task.title,
        status: task.status,
        priority: task.priority,
        assigneeId: task.assigneeId,
      },
    })

    // Notify new assignee if changed
    if (
      data.assigneeId &&
      data.assigneeId !== existing.assigneeId &&
      data.assigneeId !== user!.id
    ) {
      await sendNotification({
        userId: data.assigneeId,
        subject: `Task assigned: "${task.title}"`,
        body: `${user!.name} assigned you a task: "${task.title}"`,
      })
    }

    return NextResponse.json({ task })
  } catch (err) {
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 })
  }
}
