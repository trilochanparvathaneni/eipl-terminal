"use client"

import { useSession } from "next-auth/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import {
  FileText, Upload, AlertTriangle, CheckCircle, Clock, XCircle,
  ShieldAlert, Info, ExternalLink, CalendarClock,
} from "lucide-react"

// ── Hardcoded Document Types (common for terminal operations) ─────────────

const DOCUMENT_TYPES = [
  { code: "LOADING_ORDER", name: "Loading Order", isMandatory: true },
  { code: "INVOICE", name: "Invoice", isMandatory: true },
  { code: "WEIGHBRIDGE_SLIP", name: "Weighbridge Slip", isMandatory: true },
  { code: "TANK_CALIBRATION_CERT", name: "Tank Calibration Certificate", isMandatory: true },
  { code: "DRIVER_LICENSE", name: "Driver License", isMandatory: true },
  { code: "VEHICLE_RC", name: "Vehicle Registration Certificate", isMandatory: true },
  { code: "INSURANCE", name: "Insurance Certificate", isMandatory: false },
  { code: "HAZMAT_PERMIT", name: "Hazmat Permit", isMandatory: false },
  { code: "POLLUTION_CERT", name: "Pollution Certificate", isMandatory: false },
  { code: "SAFETY_CHECKLIST", name: "Safety Checklist", isMandatory: false },
  { code: "CUSTOMS_CLEARANCE", name: "Customs Clearance", isMandatory: false },
  { code: "PRODUCT_TEST_REPORT", name: "Product Test Report", isMandatory: false },
]

const MANDATORY_DOC_CODES = DOCUMENT_TYPES.filter((d) => d.isMandatory).map((d) => d.code)

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

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-"
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  })
}

function isExpiringSoon(expiryDate: string | null | undefined): boolean {
  if (!expiryDate) return false
  const expiry = new Date(expiryDate)
  const now = new Date()
  const diffDays = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  return diffDays >= 0 && diffDays <= 30
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
  createdAt: string
}

interface BookingRecord {
  id: string
  bookingNo: string
  product?: { name: string }
  client?: { name: string }
  status: string
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function ClientDocumentsPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [uploadOpen, setUploadOpen] = useState(false)
  const [selectedDocType, setSelectedDocType] = useState("")
  const [selectedBooking, setSelectedBooking] = useState("")
  const [fileUrl, setFileUrl] = useState("")
  const [expiryDate, setExpiryDate] = useState("")

  // ── Data Fetching ─────────────────────────────────────────────────────

  const { data: bookingsData } = useQuery({
    queryKey: ["client-bookings"],
    queryFn: async () => {
      const res = await fetch("/api/bookings")
      if (!res.ok) throw new Error("Failed to fetch bookings")
      return res.json()
    },
  })

  const bookings: BookingRecord[] = bookingsData?.bookings || []

  const { data: documentsData, isLoading: docsLoading } = useQuery({
    queryKey: ["client-documents"],
    queryFn: async () => {
      const res = await fetch("/api/documents?linkType=BOOKING")
      if (!res.ok) throw new Error("Failed to fetch documents")
      return res.json()
    },
  })

  const allDocuments: DocumentRecord[] = documentsData?.documents || documentsData || []

  // ── Derived Data ──────────────────────────────────────────────────────

  const requiredDocs = useMemo(
    () => allDocuments.filter((d) => {
      const dt = d.documentType || DOCUMENT_TYPES.find((t) => t.code === d.documentTypeId)
      return dt && MANDATORY_DOC_CODES.includes(typeof dt === "object" ? dt.code : d.documentTypeId)
    }),
    [allDocuments]
  )

  const expiringDocs = useMemo(
    () => allDocuments.filter((d) => isExpiringSoon(d.expiryDate)),
    [allDocuments]
  )

  const rejectedDocs = useMemo(
    () => allDocuments.filter((d) => d.verificationStatus === "REJECTED"),
    [allDocuments]
  )

  // What's missing per booking
  const missingByBooking = useMemo(() => {
    const result: { booking: BookingRecord; missingTypes: typeof DOCUMENT_TYPES }[] = []
    for (const bk of bookings) {
      const docsForBooking = allDocuments.filter((d) => d.linkId === bk.id && d.linkType === "BOOKING")
      const uploadedCodes = new Set(
        docsForBooking.map((d) => d.documentType?.code || d.documentTypeId)
      )
      const missing = DOCUMENT_TYPES.filter((t) => t.isMandatory && !uploadedCodes.has(t.code))
      if (missing.length > 0) {
        result.push({ booking: bk, missingTypes: missing })
      }
    }
    return result
  }, [allDocuments, bookings])

  // ── Upload Mutation ───────────────────────────────────────────────────

  const uploadDoc = useMutation({
    mutationFn: async (data: {
      documentTypeCode: string
      linkType: string
      linkId: string
      fileUrl: string
      expiryDate?: string
    }) => {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to upload document")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Document uploaded", description: "Your document has been submitted for verification." })
      setUploadOpen(false)
      resetForm()
      queryClient.invalidateQueries({ queryKey: ["client-documents"] })
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" })
    },
  })

  function resetForm() {
    setSelectedDocType("")
    setSelectedBooking("")
    setFileUrl("")
    setExpiryDate("")
  }

  function handleUpload() {
    if (!selectedDocType || !selectedBooking || !fileUrl) return
    uploadDoc.mutate({
      documentTypeCode: selectedDocType,
      linkType: "BOOKING",
      linkId: selectedBooking,
      fileUrl,
      expiryDate: expiryDate || undefined,
    })
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  function getBookingLabel(linkId: string): string {
    const bk = bookings.find((b) => b.id === linkId)
    return bk ? bk.bookingNo : linkId.slice(0, 8)
  }

  function getDocTypeName(doc: DocumentRecord): string {
    if (doc.documentType?.name) return doc.documentType.name
    const found = DOCUMENT_TYPES.find((t) => t.code === doc.documentTypeId)
    return found?.name || doc.documentTypeId
  }

  // ── Document Table Renderer ───────────────────────────────────────────

  function renderDocTable(docs: DocumentRecord[]) {
    if (docs.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-sm text-muted-foreground">No documents found in this category</p>
        </div>
      )
    }

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document Type</TableHead>
              <TableHead>Linked To</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead>Expiry Date</TableHead>
              <TableHead>File</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell className="font-medium">
                  {getDocTypeName(doc)}
                  {doc.version > 1 && (
                    <span className="ml-1 text-xs text-muted-foreground">v{doc.version}</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs font-mono">
                    {getBookingLabel(doc.linkId)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={statusBadgeClass(doc.verificationStatus)}>
                    {doc.verificationStatus}
                  </Badge>
                  {doc.verificationStatus === "REJECTED" && doc.rejectionReason && (
                    <p className="text-xs text-red-600 mt-1 max-w-[200px] truncate" title={doc.rejectionReason}>
                      {doc.rejectionReason}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(doc.createdAt)}
                </TableCell>
                <TableCell>
                  {doc.expiryDate ? (
                    <span className={isExpiringSoon(doc.expiryDate) ? "text-orange-600 font-medium" : ""}>
                      {formatDate(doc.expiryDate)}
                      {isExpiringSoon(doc.expiryDate) && (
                        <CalendarClock className="inline h-3.5 w-3.5 ml-1 text-orange-500" />
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 text-xs"
                  >
                    View <ExternalLink className="h-3 w-3" />
                  </a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Document Vault</h1>
            <p className="text-sm text-muted-foreground">
              Manage and track all your booking documents
            </p>
          </div>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4 mr-2" /> Upload Document
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-muted-foreground">Total</span>
            </div>
            <p className="text-2xl font-bold mt-1">{allDocuments.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-muted-foreground">Pending</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-yellow-600">
              {allDocuments.filter((d) => d.verificationStatus === "PENDING").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">Verified</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-green-600">
              {allDocuments.filter((d) => d.verificationStatus === "VERIFIED").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-muted-foreground">Issues</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-red-600">
              {rejectedDocs.length + expiringDocs.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Document List */}
      <Card>
        <CardContent className="p-0">
          <Tabs defaultValue="all">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-4 pt-3">
              <TabsTrigger value="all" className="text-sm">
                All Documents ({allDocuments.length})
              </TabsTrigger>
              <TabsTrigger value="required" className="text-sm">
                Required ({requiredDocs.length})
              </TabsTrigger>
              <TabsTrigger value="expiring" className="text-sm">
                Expiring Soon ({expiringDocs.length})
              </TabsTrigger>
              <TabsTrigger value="rejected" className="text-sm">
                Rejected ({rejectedDocs.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              {docsLoading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              ) : (
                renderDocTable(allDocuments)
              )}
            </TabsContent>

            <TabsContent value="required">
              {renderDocTable(requiredDocs)}
            </TabsContent>

            <TabsContent value="expiring">
              {expiringDocs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <CheckCircle className="h-12 w-12 text-green-400 mb-4" />
                  <p className="text-sm text-muted-foreground">No documents expiring in the next 30 days</p>
                </div>
              ) : (
                renderDocTable(expiringDocs)
              )}
            </TabsContent>

            <TabsContent value="rejected">
              {renderDocTable(rejectedDocs)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* What's Missing Section */}
      {missingByBooking.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              What&apos;s Missing
            </CardTitle>
            <CardDescription>
              Mandatory documents not yet uploaded for your bookings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {missingByBooking.map(({ booking, missingTypes }) => (
              <div key={booking.id} className="border border-amber-200 rounded-lg p-3 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">{booking.bookingNo}</Badge>
                    {booking.product && (
                      <span className="text-xs text-muted-foreground">{booking.product.name}</span>
                    )}
                  </div>
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                    {missingTypes.length} missing
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {missingTypes.map((dt) => (
                    <Badge
                      key={dt.code}
                      variant="outline"
                      className="text-xs border-red-200 text-red-700 bg-red-50 cursor-pointer hover:bg-red-100"
                      onClick={() => {
                        setSelectedDocType(dt.code)
                        setSelectedBooking(booking.id)
                        setUploadOpen(true)
                      }}
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      {dt.name}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {missingByBooking.length === 0 && bookings.length > 0 && allDocuments.length > 0 && (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="py-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-800">All mandatory documents uploaded</p>
              <p className="text-xs text-green-600">
                All your bookings have the required documents. Pending documents are awaiting admin verification.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={(open) => { if (!open) { setUploadOpen(false); resetForm() } else setUploadOpen(true) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload a document and link it to a booking for verification.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Document Type *</Label>
              <Select value={selectedDocType} onValueChange={setSelectedDocType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((dt) => (
                    <SelectItem key={dt.code} value={dt.code}>
                      {dt.name}
                      {dt.isMandatory && " (Required)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Linked Booking *</Label>
              <Select value={selectedBooking} onValueChange={setSelectedBooking}>
                <SelectTrigger>
                  <SelectValue placeholder="Select booking" />
                </SelectTrigger>
                <SelectContent>
                  {bookings.map((bk) => (
                    <SelectItem key={bk.id} value={bk.id}>
                      {bk.bookingNo}{bk.product ? ` - ${bk.product.name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {bookings.length === 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" /> No bookings found. Create a booking first.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>File URL *</Label>
              <Input
                placeholder="https://storage.example.com/doc.pdf"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter the URL of your uploaded file
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Expiry Date (optional)</Label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadOpen(false); resetForm() }}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedDocType || !selectedBooking || !fileUrl || uploadDoc.isPending}
            >
              {uploadDoc.isPending ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
