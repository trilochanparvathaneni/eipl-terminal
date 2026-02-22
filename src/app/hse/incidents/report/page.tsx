import { redirect } from "next/navigation"

export default function LegacyHseIncidentReportRedirect() {
  redirect("/hse/incidents/new")
}
