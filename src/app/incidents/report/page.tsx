import { redirect } from "next/navigation"

export default function LegacyIncidentReportRedirect() {
  redirect("/hse/incidents/new")
}
