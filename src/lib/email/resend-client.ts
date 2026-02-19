import { Resend } from "resend"
import { logger } from "@/lib/logger"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = process.env.RESEND_FROM_EMAIL ?? "noreply@eipl.app"

export async function sendEmail(params: { to: string; subject: string; html: string }) {
  if (!resend) {
    logger.info({ to: params.to, subject: params.subject }, "[MOCKED EMAIL]")
    return
  }
  const { error } = await resend.emails.send({ from: FROM, ...params })
  if (error) throw new Error(`Resend error: ${error.message}`)
}
