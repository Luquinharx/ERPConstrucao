import { NextResponse } from "next/server"

import { consultar } from "@/lib/server/pg"

export const dynamic = "force-dynamic"

/** Estado do servidor e da base de dados (pagina /status e monitorizacao). */
export async function GET() {
  try {
    await consultar("SELECT 1")
    return NextResponse.json({ ok: true, bd: true })
  } catch {
    return NextResponse.json({ ok: false, bd: false }, { status: 503 })
  }
}
