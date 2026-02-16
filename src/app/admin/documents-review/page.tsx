"use client"

import { useSession } from "next-auth/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import {
  ShieldCheck, CheckCircle, XCircle, Clock, FileSearch, ExternalLink,
  Filter, AlertTriangle, FileText, RefreshCw,
} from "lucide-react"

// ── Status Helpers ────────────────────────────────────────────────────────

function statusBadgeClass(status: string): string {
  switch (status) {
    case "PENDING": return "bg-yellow-100 text-yellow-800 border-yellow-300"
    case "VERIFIED": return "bg-green-100 text-green-800 border-green-300"
    case "REJECTED": return "bg-red-100 text-red-800 border-red-300"
    case "EXPIRED": return "bg-orange-100 text-orange-800 border-orange-300"
    default: return "bg-gray-100 text-gray-700"
  }
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "-"
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

// ── Types ─────────────────────────────────────────────────────────────────

interface DocumentRecord {
  id: string
  documentTypeId: string
  documentType?: { id: string; code: string; name: string; isMandatory: boolean }
  linkType: string
  linkId: string
  version: number
  fileUrl: string
  verificationStatus: string
  expiryDate: string | null
  rejectionReason: string | null
  verifiedByUserId: string | null
  verifiedAt: string | null
  extractedMetadata?: {
    confidence?: number
    validation?: { passed?: boolean; mismatches?: string[] }
  } | null
  createdAt: string
}

// ── Known Document Types ──────────────────────────────────────────────────

const DOC_TYPE_OPTIONS = [
  { value: "ALL", label: "All Types" },
  { value: "LOADING_ORDER", label: "Loading Order" },
  { value: "INVOICE", label: "Invoice" },
  { value: "WEIGHBRIDGE_SLIP", label: "Weighbridge Slip" },
  { value: "TANK_CALIBRATION_CERT", label: "Tank Calibration Certificate" },
  { value: "DRIVER_LICENSE", label: "Driver License" },
  { value: "VEHICLE_RC", label: "Vehicle RC" },
  { value: "INSURANCE", label: "Insurance Certificate" },
  { value: "HAZMAT_PERMIT", label: "Hazmat Permit" },
  { value: "POLLUTION_CERT", label: "Pollution Certificate" },
  { value: "SAFETY_CHECKLIST", label: "Safety Checklist" },
  { value: "CUSTOMS_CLEARANCE", label: "Customs Clearance" },
  { value: "PRODUCT_TEST_REPORT", label: "Product Test Report" },
]

const STATUS_OPTIONS = [
  { value: "ALL", label: "All Statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "VERIFIED", label: "Verified" },
  { value: "REJECTED", label: "Rejected" },
  { value: "EXPIRED", label: "Expired" },
]

// ── Main Page ─────────────────────────────────────────────────────────────

export default function AdminDocumentsReviewPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [statusFilter, setStatusFilter] = useState("PENDING")
  const [docTypeFilter, setDocTypeFilter] = useState("ALL")
  const [rejectDialog, setRejectDialog] = useState<{ docId: string; docName: string } | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")

  // ── Data Fetching ─────────────────────────────────────────────────────

  const params = new URLSearchParams()
  if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter)
  if (docTypeFilter && docTypeFilter !== "ALL") params.set("documentType", docTypeFilter)

  const { data: documentsData, isLoading, refetch } = useQuery({
    queryKey: ["admin-documents", statusFilter, docTypeFilter],
    queryFn: async () => {
      const res = await fetch(`/api/documents?${params}`)
      if (!res.ok) throw new Error("Failed to fetch documents")
      return res.json()
    },
  })

  const allDocuments: DocumentRecord[] = documentsData?.documents || documentsData || []

  // ── Stats ─────────────────────────────────────────────────────────────

  const pendingCount = allDocuments.filter((d) => d.verificationStatus === "PENDING").length
  const verifiedCount = allDocuments.filter((d) => d.verificationStatus === "VERIFIED").length
  const rejectedCount = allDocuments.filter((d) => d.verificationStatus === "REJECTED").length

  // ── Verify Mutation ───────────────────────────────────────────────────

  const verifyDoc = useMutation({
    mutationFn: async (docId: string) => {
      const res = await fetch(`/api/documents/${docId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to verify document")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Document verified", description: "The document has been approved." })
      queryClient.invalidateQueries({ queryKey: ["admin-documents"] })
    },
    onError: (err: Error) => {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" })
    },
  })

  // ── Reject Mutation ───────────────────────────────────────────────────

  const rejectDoc = useMutation({
    mutationFn: async (data: { docId: string; reason: string }) => {
      const res = await fetch(`/api/documents/${data.docId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: data.reason }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to reject document")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Document rejected", description: "The document has been rejected with the provided reason." })
      setRejectDialog(null)
      setRejectionReason("")
      queryClient.invalidateQueries({ queryKey: ["admin-documents"] })
    },
    onError: (err: Error) => {
      toast({ title: "Rejection failed", description: err.message, variant: "destructive" })
    },
  })

  // ── Helpers ───────────────────────────────────────────────────────────

  function getDocTypeName(doc: DocumentRecord): string {
    if (doc.documentType?.name) return doc.documentType.name
    const found = DOC_TYPE_OPTIONS.find((t) => t.value === doc.documentTypeId)
    return found?.label || doc.documentTypeId
  }

  function handleRejectSubmit() {
    if (!rejectDialog || !rejectionReason.trim()) return
    rejectDoc.mutate({ docId: rejectDialog.docId, reason: rejectionReason.trim() })
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Document Review Queue</h1>
            <p className="text-sm text-muted-foreground">
              Review, verify, or reject submitted documents
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <Card className={statusFilter === "PENDING" ? "ring-2 ring-yellow-400" : ""}>
          <CardContent className="pt-4 pb-3 px-4 cursor-pointer" onClick={() => setStatusFilter("PENDING")}>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-muted-foreground">Pending Review</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-yellow-600">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card className={statusFilter === "VERIFIED" ? "ring-2 ring-green-400" : ""}>
          <CardContent className="pt-4 pb-3 px-4 cursor-pointer" onClick={() => setStatusFilter("VERIFIED")}>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">Verified</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-green-600">{verifiedCount}</p>
          </CardContent>
        </Card>
        <Card className={statusFilter === "REJECTED" ? "ring-2 ring-red-400" : ""}>
          <CardContent className="pt-4 pb-3 px-4 cursor-pointer" onClick={() => setStatusFilter("REJECTED")}>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-muted-foreground">Rejected</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-red-600">{rejectedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={docTypeFilter} onValueChange={setDocTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by document type" />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Document Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : allDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <FileSearch className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium text-muted-foreground mb-1">No documents found</p>
              <p className="text-sm text-muted-foreground">
                {statusFilter !== "ALL"
                  ? `No documents with status "${statusFilter}". Try adjusting your filters.`
                  : "No documents have been uploaded yet."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Doc Type</TableHead>
                    <TableHead>Uploaded By</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Auto Check</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Uploaded At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allDocuments.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div>
                            <p className="font-medium text-sm">{getDocTypeName(doc)}</p>
                            {doc.documentType?.isMandatory && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 border-blue-200 text-blue-600 mt-0.5">
                                Mandatory
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <Badge variant="outline" className="text-xs mr-1">{doc.linkType}</Badge>
                          <span className="font-mono text-xs text-muted-foreground">
                            {doc.linkId.slice(0, 12)}...
                          </span>
                        </div>
                        {doc.version > 1 && (
                          <span className="text-[10px] text-muted-foreground">v{doc.version}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 text-xs max-w-[150px] truncate"
                          title={doc.fileUrl}
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          {doc.fileUrl.split("/").pop() || "View file"}
                        </a>
                      </TableCell>
                      <TableCell>
                        {doc.extractedMetadata?.validation ? (
                          <div className="space-y-1">
                            <Badge
                              className={
                                doc.extractedMetadata.validation.passed
                                  ? "bg-green-100 text-green-800 border-green-300"
                                  : "bg-red-100 text-red-800 border-red-300"
                              }
                              title={(doc.extractedMetadata.validation.mismatches || []).join(" | ")}
                            >
                              {doc.extractedMetadata.validation.passed ? "PASS" : "FAIL"}
                            </Badge>
                            {typeof doc.extractedMetadata.confidence === "number" && (
                              <p className="text-[10px] text-muted-foreground">
                                conf {(doc.extractedMetadata.confidence * 100).toFixed(0)}%
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusBadgeClass(doc.verificationStatus)}>
                          {doc.verificationStatus}
                        </Badge>
                        {doc.rejectionReason && (
                          <p className="text-[10px] text-red-600 mt-1 max-w-[150px] truncate" title={doc.rejectionReason}>
                            {doc.rejectionReason}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDateTime(doc.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        {doc.verificationStatus === "PENDING" ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              className="h-8 bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => verifyDoc.mutate(doc.id)}
                              disabled={verifyDoc.isPending}
                            >
                              <CheckCircle className="h-3.5 w-3.5 mr-1" />
                              Verify
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-8"
                              onClick={() => setRejectDialog({ docId: doc.id, docName: getDocTypeName(doc) })}
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" />
                              Reject
                            </Button>
                          </div>
                        ) : doc.verificationStatus === "VERIFIED" ? (
                          <span className="text-xs text-green-600 flex items-center justify-end gap-1">
                            <CheckCircle className="h-3.5 w-3.5" />
                            {doc.verifiedAt ? formatDateTime(doc.verifiedAt) : "Verified"}
                          </span>
                        ) : doc.verificationStatus === "REJECTED" ? (
                          <span className="text-xs text-red-600 flex items-center justify-end gap-1">
                            <XCircle className="h-3.5 w-3.5" />
                            Rejected
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={() => { setRejectDialog(null); setRejectionReason("") }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Reject Document
            </DialogTitle>
            <DialogDescription>
              Rejecting: <strong>{rejectDialog?.docName}</strong>. Please provide a reason for the rejection.
              The uploader will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Rejection Reason *</Label>
              <Textarea
                placeholder="e.g., Document is blurry, incorrect document type, expired certificate..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialog(null); setRejectionReason("") }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectSubmit}
              disabled={!rejectionReason.trim() || rejectDoc.isPending}
            >
              {rejectDoc.isPending ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
