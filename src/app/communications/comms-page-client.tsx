"use client"

import { useState } from "react"
import { ConversationSidebar } from "@/components/comms/conversation-sidebar"
import { MessageThread } from "@/components/comms/message-thread"
import { TaskPanel } from "@/components/comms/task-panel"
import { EiplAssistDrawer } from "@/components/comms/eipl-assist-drawer"
import { Button } from "@/components/ui/button"
import { Sparkles, CheckSquare, MessageSquare } from "lucide-react"
import { HelpTooltip } from "@/components/ui/help-tooltip"

interface CommsPageClientProps {
  currentUserId: string
}

export function CommsPageClient({ currentUserId }: CommsPageClientProps) {
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [taskPanelOpen, setTaskPanelOpen] = useState(false)
  const [assistOpen, setAssistOpen] = useState(false)
  const [pendingTaskMessageId, setPendingTaskMessageId] = useState<string | null>(null)
  const [pendingTaskMessageBody, setPendingTaskMessageBody] = useState<string | null>(null)

  function handleCreateTask(messageId: string, messageBody: string) {
    setPendingTaskMessageId(messageId)
    setPendingTaskMessageBody(messageBody)
    setTaskPanelOpen(true)
  }

  return (
    /*
     * Full-bleed layout that fills the viewport from just below the fixed header
     * to the bottom. Negative margins cancel the parent padding added by app-layout,
     * then we add back exactly the header height as top padding.
     * overflow-hidden on the wrapper keeps all scrolling contained within panels.
     */
    <div className="-m-4 -mt-16 flex h-screen overflow-hidden bg-background pt-14 text-foreground lg:-m-8 lg:-mt-20">
      {/* Left panel — Conversation list */}
      <div className="z-10 flex w-56 shrink-0 flex-col border-r border-border bg-card text-card-foreground lg:w-64">
        <ConversationSidebar
          activeId={activeConvId}
          onSelect={setActiveConvId}
        />
      </div>

      {/* Center panel — Message thread */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeConvId ? (
          <>
            <div className="flex items-center justify-end gap-2 border-b border-border bg-card p-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setTaskPanelOpen((v) => !v)}
                title="Open conversation tasks for assignment and tracking."
              >
                <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
                Tasks
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setAssistOpen(true)}
                title="Open AI assistant for this conversation context."
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5 text-violet-500" />
                EIPL Assist
              </Button>
            </div>
            <MessageThread
              conversationId={activeConvId}
              currentUserId={currentUserId}
              onCreateTask={handleCreateTask}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground" />
              <h2 className="inline-flex items-center gap-1.5 text-lg font-semibold">Communications <HelpTooltip description="Messaging workspace for operation coordination." /></h2>
              <p className="max-w-xs text-sm text-muted-foreground">
                Select a conversation from the sidebar or create a new one to get started.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Right panel — Task panel */}
      {taskPanelOpen && activeConvId && (
        <div className="z-10 flex w-72 flex-shrink-0 flex-col border-l border-border bg-card text-card-foreground">
          <TaskPanel
            conversationId={activeConvId}
            prefillMessageId={pendingTaskMessageId}
            prefillMessageBody={pendingTaskMessageBody}
            onClearPrefill={() => {
              setPendingTaskMessageId(null)
              setPendingTaskMessageBody(null)
            }}
          />
        </div>
      )}

      {/* EIPL Assist drawer */}
      {activeConvId && (
        <EiplAssistDrawer
          conversationId={activeConvId}
          open={assistOpen}
          onOpenChange={setAssistOpen}
        />
      )}
    </div>
  )
}
