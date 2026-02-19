import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-utils"
import { createAuditLog } from "@/lib/audit"
import { sendNotification } from "@/lib/notifications"
import { createTaskSchema } from "@/lib/comms/validations"
import { hasPermission } from "@/lib/rbac"

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  if (!hasPermission(user!.role, "tasks:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = new URL(req.url)
  const conversationId = url.searchParams.get("conversationId") || undefined

  const isAdmin =
    user!.role === "SUPER_ADMIN" || user!.role === "TERMINAL_ADMIN"

  const where: any = {}

  // Non-admins only see tasks they created or are assigned to
  if (!isAdmin) {
    where.OR = [{ assigneeId: user!.id }, { createdByUserId: user!.id }]
  }

  if (conversationId) {
    where.taskLinks = { some: { conversationId } }
  }

  const tasks = await prisma.task.findMany({
    where,
    include: {
      assignee: { select: { id: true, name: true, role: true } },
      createdBy: { select: { id: true, name: true, role: true } },
      taskLinks: true,
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ tasks })
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  if (!hasPermission(user!.role, "tasks:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = createTaskSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const data = parsed.data

  try {
    const task = await prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        assigneeId: data.assigneeId,
        createdByUserId: user!.id,
        dueAt: data.dueAt ? new Date(data.dueAt) : undefined,
        priority: data.priority,
        visibility: data.visibility,
        ...(data.conversationId && data.messageId
          ? {
              taskLinks: {
                create: [
                  {
                    conversationId: data.conversationId,
                    messageId: data.messageId,
                  },
                ],
              },
            }
          : {}),
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
      action: "CREATE",
      after: { title: task.title, priority: task.priority, status: task.status },
    })

    // Notify assignee if set
    if (data.assigneeId && data.assigneeId !== user!.id) {
      await sendNotification({
        userId: data.assigneeId,
        subject: `Task assigned: "${data.title}"`,
        body: `${user!.name} assigned you a task: "${data.title}"`,
      })
    }

    return NextResponse.json({ task }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 })
  }
}
