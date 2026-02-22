import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "eipl-terminal-ops",
    timestamp: new Date().toISOString(),
  })
}
