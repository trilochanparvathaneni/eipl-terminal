"use client"

import { useRef, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sparkles, Loader2, FileText, MessageSquarePlus,
  ListTodo, Search, Upload, Send, X,
} from "lucide-react"

interface EiplAssistDrawerProps {
  conversationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Tab = "actions" | "qa" | "upload"
type AssistAction = "summarize" | "draft_reply" | "action_items" | null

// ── helpers ──────────────────────────────────────────────────────────────────

async function fetchThreadText(conversationId: string): Promise<string> {
  const res = await fetch(`/api/comms/conversations/${conversationId}/messages?limit=20`)
  if (!res.ok) return ""
  const data = await res.json()
  return (data.messages as { sender: { name: string }; body: string }[])
    .map((m) => `${m.sender.name}: ${m.body}`)
    .join("\n")
}

async function streamChat(
  prompt: string,
  onDelta: (token: string) => void
): Promise<void> {
  const res = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: prompt }),
  })
  if (!res.ok) throw new Error("AI request failed")

  const reader = res.body?.getReader()
  if (!reader) return
  const decoder = new TextDecoder()
  let buf = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const parts = buf.split("\n\n")
    buf = parts.pop() ?? ""
    for (const part of parts) {
      if (!part.startsWith("data: ")) continue
      try {
        const evt = JSON.parse(part.slice(6))
        if (evt.event === "delta") onDelta(evt.content)
      } catch { /* skip */ }
    }
  }
}

// ── sub-components ────────────────────────────────────────────────────────────

function ResponseBox({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex-1 rounded-md border bg-muted/30 p-4 overflow-y-auto min-h-[120px]">
      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">{label}</p>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
    </div>
  )
}

// ── ActionsTab ────────────────────────────────────────────────────────────────

function ActionsTab({ conversationId }: { conversationId: string }) {
  const [action, setAction] = useState<AssistAction>(null)
  const [response, setResponse] = useState("")
  const [loading, setLoading] = useState(false)

  async function run(type: AssistAction) {
    if (!type || loading) return
    setAction(type)
    setResponse("")
    setLoading(true)
    try {
      const thread = await fetchThreadText(conversationId)
      const prompts: Record<NonNullable<AssistAction>, string> = {
        summarize: `Summarize this conversation thread concisely:\n\n${thread}`,
        draft_reply: `Draft a professional reply to this conversation:\n\n${thread}`,
        action_items: `Extract action items and suggestions from this conversation. Present as a bullet list. Do NOT create tasks automatically — these are suggestions only.\n\n${thread}`,
      }
      await streamChat(prompts[type], (tok) => setResponse((p) => p + tok))
    } catch {
      setResponse("Failed to get AI response. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const labels: Record<NonNullable<AssistAction>, string> = {
    summarize: "Summary",
    draft_reply: "Suggested Reply",
    action_items: "Action Items (Suggestions Only)",
  }

  return (
    <div className="flex flex-col flex-1 space-y-3">
      <p className="text-xs text-muted-foreground">AI-powered actions for this thread.</p>

      <div className="grid grid-cols-3 gap-2">
        <Button variant={action === "summarize" ? "default" : "outline"} size="sm"
          onClick={() => run("summarize")} disabled={loading}>
          <FileText className="h-3.5 w-3.5 mr-1" />Summarize
        </Button>
        <Button variant={action === "draft_reply" ? "default" : "outline"} size="sm"
          onClick={() => run("draft_reply")} disabled={loading}>
          <MessageSquarePlus className="h-3.5 w-3.5 mr-1" />Draft
        </Button>
        <Button variant={action === "action_items" ? "default" : "outline"} size="sm"
          onClick={() => run("action_items")} disabled={loading}>
          <ListTodo className="h-3.5 w-3.5 mr-1" />Actions
        </Button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Thinking…</span>
        </div>
      )}
      {response && <ResponseBox label={labels[action!]} text={response} />}
      {!loading && !response && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <Sparkles className="h-10 w-10 mx-auto text-violet-200" />
            <p className="text-xs text-muted-foreground">
              Choose an action to get AI assistance.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── QATab (Compliance Q&A via RAG) ───────────────────────────────────────────

interface QAMessage { role: "user" | "assistant"; text: string }

function QATab() {
  const [messages, setMessages] = useState<QAMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  async function send() {
    const q = input.trim()
    if (!q || loading) return
    setInput("")
    const userMsg: QAMessage = { role: "user", text: q }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)

    // Start placeholder assistant message
    setMessages((prev) => [...prev, { role: "assistant", text: "" }])

    try {
      const prompt = `You are EIPL Assist. Answer using the compliance and SOP knowledge base.
Search for relevant documentation before answering. Be precise and cite sources where possible.

User question: ${q}`

      await streamChat(prompt, (tok) => {
        setMessages((prev) => {
          const copy = [...prev]
          copy[copy.length - 1] = {
            role: "assistant",
            text: copy[copy.length - 1].text + tok,
          }
          return copy
        })
        endRef.current?.scrollIntoView({ behavior: "smooth" })
      })
    } catch {
      setMessages((prev) => {
        const copy = [...prev]
        copy[copy.length - 1] = { role: "assistant", text: "Error — please retry." }
        return copy
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <p className="text-xs text-muted-foreground mb-2">
        Ask compliance or SOP questions. EIPL Assist searches the knowledge base.
      </p>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-3 min-h-[180px]">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-muted-foreground text-center">
              Try: &quot;What are the MSDS requirements for Methanol loading?&quot;
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-sm rounded-md px-3 py-2 max-w-[95%] whitespace-pre-wrap ${
              m.role === "user"
                ? "ml-auto bg-primary text-primary-foreground"
                : "bg-muted"
            }`}
          >
            {m.text || (loading && i === messages.length - 1 ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin inline" />
            ) : "")}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Ask about compliance or SOPs…"
          disabled={loading}
          className="text-sm"
        />
        <Button size="icon" onClick={send} disabled={loading || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ── UploadTab (SOP / compliance doc upload + OCR) ────────────────────────────

function UploadTab() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<null | { documentId: string; chunkCount: number }>(null)
  const [ocrResult, setOcrResult] = useState<null | Record<string, unknown>>(null)
  const [mode, setMode] = useState<"upload" | "ocr">("upload")
  const [error, setError] = useState("")

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null)
    setResult(null)
    setOcrResult(null)
    setError("")
  }

  async function handleUpload() {
    if (!file || !title.trim() || uploading) return
    setUploading(true)
    setError("")
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("title", title.trim())
      const res = await fetch("/api/ai/upload", { method: "POST", body: fd })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? "Upload failed")
      }
      const data = await res.json()
      setResult(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleOcr() {
    if (!file || uploading) return
    setUploading(true)
    setError("")
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/ai/ocr", { method: "POST", body: fd })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? "OCR failed")
      }
      const data = await res.json()
      setOcrResult(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 space-y-3">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <Button size="sm" variant={mode === "upload" ? "default" : "outline"}
          onClick={() => setMode("upload")} className="flex-1">
          <Upload className="h-3.5 w-3.5 mr-1" />Index SOP Doc
        </Button>
        <Button size="sm" variant={mode === "ocr" ? "default" : "outline"}
          onClick={() => setMode("ocr")} className="flex-1">
          <Search className="h-3.5 w-3.5 mr-1" />OCR Extract
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {mode === "upload"
          ? "Upload a PDF, TXT, or MD file to add it to the knowledge base."
          : "Upload an image or document to extract structured fields via OCR."}
      </p>

      {/* File picker */}
      <div
        className="border-2 border-dashed rounded-md p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        {file ? (
          <div className="flex items-center justify-between">
            <span className="text-sm truncate max-w-[200px]">{file.name}</span>
            <button onClick={(e) => { e.stopPropagation(); setFile(null) }} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Click to select file</p>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept={mode === "upload" ? ".pdf,.txt,.md,.csv" : ".pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff,.txt,.csv"}
        onChange={onFileChange}
      />

      {mode === "upload" && (
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Document title (e.g. 'Methanol Loading SOP')"
          className="text-sm"
        />
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button
        onClick={mode === "upload" ? handleUpload : handleOcr}
        disabled={!file || (mode === "upload" && !title.trim()) || uploading}
        className="w-full"
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {mode === "upload" ? "Upload & Index" : "Extract Fields"}
      </Button>

      {/* Results */}
      {result && (
        <div className="rounded-md border bg-green-50 dark:bg-green-950/20 p-3 text-sm">
          <p className="font-medium text-green-700 dark:text-green-400">Indexed successfully</p>
          <p className="text-xs text-muted-foreground mt-1">
            {result.chunkCount} chunks created · ID: {result.documentId.slice(0, 8)}…
          </p>
        </div>
      )}
      {ocrResult && (
        <div className="rounded-md border bg-muted/30 p-3 overflow-y-auto max-h-[200px]">
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
            Extracted Fields
          </p>
          <pre className="text-xs leading-relaxed whitespace-pre-wrap">
            {JSON.stringify((ocrResult as any).fields ?? ocrResult, null, 2)}
          </pre>
          {(ocrResult as any).confidence && (
            <p className="text-xs text-muted-foreground mt-2">
              Confidence: {Math.round((ocrResult as any).confidence * 100)}% · Source: {(ocrResult as any).source}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Drawer ───────────────────────────────────────────────────────────────

export function EiplAssistDrawer({ conversationId, open, onOpenChange }: EiplAssistDrawerProps) {
  const [tab, setTab] = useState<Tab>("actions")

  function handleOpenChange(value: boolean) {
    if (!value) setTab("actions")
    onOpenChange(value)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:max-w-[420px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            EIPL Assist
          </SheetTitle>
        </SheetHeader>

        {/* Tab bar */}
        <div className="flex gap-1 border-b pb-2 mt-2">
          {(["actions", "qa", "upload"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                tab === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {t === "actions" ? "Thread Actions" : t === "qa" ? "Compliance Q&A" : "Upload SOP"}
            </button>
          ))}
        </div>

        <div className="flex flex-col flex-1 min-h-0 mt-3">
          {tab === "actions" && <ActionsTab conversationId={conversationId} />}
          {tab === "qa"      && <QATab />}
          {tab === "upload"  && <UploadTab />}
        </div>
      </SheetContent>
    </Sheet>
  )
}
