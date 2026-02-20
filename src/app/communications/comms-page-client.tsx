"use client"

import { useState } from "react"
import { ConversationSidebar } from "@/components/comms/conversation-sidebar"
import { MessageThread } from "@/components/comms/message-thread"
import { TaskPanel } from "@/components/comms/task-panel"
import { EiplAssistDrawer } from "@/components/comms/eipl-assist-drawer"
import { Button } from "@/components/ui/button"
import { Sparkles, CheckSquare, MessageSquare } from "lucide-react"

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
    <div className="-m-4 lg:-m-8 -mt-16 lg:-mt-20 pt-12 flex h-screen overflow-hidden">
      {/* Left panel — Conversation list */}
      <div className="w-56 lg:w-64 shrink-0 border-r bg-background flex flex-col">
        <ConversationSidebar
          activeId={activeConvId}
          onSelect={setActiveConvId}
        />
      </div>

      {/* Center panel — Message thread */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeConvId ? (
          <>
            <div className="border-b p-2 flex items-center justify-end gap-2 bg-background">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setTaskPanelOpen((v) => !v)}
              >
                <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
                Tasks
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setAssistOpen(true)}
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
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground" />
              <h2 className="font-semibold text-lg">Communications</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                Select a conversation from the sidebar or create a new one to get started.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Right panel — Task panel */}
      {taskPanelOpen && activeConvId && (
        <div className="w-72 flex-shrink-0 border-l bg-background flex flex-col">
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
