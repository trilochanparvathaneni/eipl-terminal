function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function formatIST(date: Date): string {
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

interface DigestMention {
  conversationTitle: string
  senderName: string
  messageBody: string
  createdAt: Date
}

export function buildDigestHtml(params: {
  recipientName: string
  mentions: DigestMention[]
}): string {
  const { recipientName, mentions } = params

  const rows = mentions
    .map(
      (m) => `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#111827;">
            ${escapeHtml(m.conversationTitle)}
          </p>
          <p style="margin:0 0 6px;font-size:12px;color:#6b7280;">
            From <strong>${escapeHtml(m.senderName)}</strong> &middot; ${escapeHtml(formatIST(m.createdAt))}
          </p>
          <p style="margin:0;font-size:13px;color:#374151;line-height:1.5;">
            ${escapeHtml(m.messageBody.slice(0, 200))}${m.messageBody.length > 200 ? "…" : ""}
          </p>
        </td>
      </tr>`
    )
    .join("")

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background:#1d4ed8;padding:20px 24px;">
              <h1 style="margin:0;color:#ffffff;font-size:18px;">EIPL Communications</h1>
              <p style="margin:4px 0 0;color:#bfdbfe;font-size:13px;">Daily Digest — Unread Mentions</p>
            </td>
          </tr>
          <!-- Greeting -->
          <tr>
            <td style="padding:20px 24px 8px;">
              <p style="margin:0;font-size:14px;color:#374151;">
                Hi <strong>${escapeHtml(recipientName)}</strong>, you have
                <strong>${mentions.length}</strong> unread mention${mentions.length !== 1 ? "s" : ""} since yesterday.
              </p>
            </td>
          </tr>
          <!-- Mentions -->
          <tr>
            <td style="padding:8px 24px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
                ${rows}
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 24px;border-top:1px solid #e5e7eb;margin-top:16px;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">
                You received this digest because you have unread @mentions in EIPL Communications.
                Visit the platform to reply.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
