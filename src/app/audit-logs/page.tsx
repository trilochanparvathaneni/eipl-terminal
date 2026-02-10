"use client"

import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatDateTime } from "@/lib/utils"
import { Eye } from "lucide-react"

export default function AuditLogsPage() {
  const [entityType, setEntityType] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [page, setPage] = useState(1)
  const [selectedLog, setSelectedLog] = useState<any>(null)

  const params = new URLSearchParams()
  if (entityType && entityType !== "ALL") params.set("entityType", entityType)
  if (dateFrom) params.set("dateFrom", dateFrom)
  if (dateTo) params.set("dateTo", dateTo)
  params.set("page", page.toString())
  params.set("limit", "20")

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", entityType, dateFrom, dateTo, page],
    queryFn: async () => {
      const r = await fetch(`/api/audit-logs?${params}`)
      if (!r.ok) throw new Error("Failed")
      return r.json()
    },
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Audit Logs</h1>

      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger><SelectValue placeholder="Entity type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value="Booking">Booking</SelectItem>
                <SelectItem value="TruckTrip">Truck Trip</SelectItem>
                <SelectItem value="GateEvent">Gate Event</SelectItem>
                <SelectItem value="SafetyChecklist">Safety Checklist</SelectItem>
                <SelectItem value="StopWorkOrder">Stop Work Order</SelectItem>
                <SelectItem value="Incident">Incident</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity ID</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.logs?.map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs">{formatDateTime(log.createdAt)}</TableCell>
                        <TableCell>{log.actor?.name}</TableCell>
                        <TableCell>{log.entityType}</TableCell>
                        <TableCell className="font-medium">{log.action}</TableCell>
                        <TableCell className="text-xs font-mono">{log.entityId.slice(0, 8)}...</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => setSelectedLog(log)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!data?.logs || data.logs.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No logs found</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {data?.total > 0 && (
                <div className="flex items-center justify-between p-4 border-t">
                  <p className="text-sm text-muted-foreground">Page {page} of {Math.ceil(data.total / 20)}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={page * 20 >= data.total} onClick={() => setPage(page + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Audit Log Detail</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">Actor</span>
                <span>{selectedLog.actor?.name}</span>
                <span className="text-muted-foreground">Action</span>
                <span className="font-medium">{selectedLog.action}</span>
                <span className="text-muted-foreground">Entity</span>
                <span>{selectedLog.entityType} ({selectedLog.entityId})</span>
                <span className="text-muted-foreground">Timestamp</span>
                <span>{formatDateTime(selectedLog.createdAt)}</span>
                <span className="text-muted-foreground">IP Address</span>
                <span>{selectedLog.ipAddress || "N/A"}</span>
              </div>
              {selectedLog.beforeJson && (
                <div>
                  <p className="font-medium mb-1">Before:</p>
                  <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-40">
                    {JSON.stringify(selectedLog.beforeJson, null, 2)}
                  </pre>
                </div>
              )}
              {selectedLog.afterJson && (
                <div>
                  <p className="font-medium mb-1">After:</p>
                  <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-40">
                    {JSON.stringify(selectedLog.afterJson, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
