import { NextResponse, type NextRequest } from "next/server"

import type { PedidoBD } from "@/lib/db/protocolo"
import { uidDaSessao } from "@/lib/server/contas"
import {
  ErroRegra,
  consultarColecao,
  contarColecao,
  gravarLote,
  lerDocumento,
  pedinteDe,
} from "@/lib/server/documentos"

export const dynamic = "force-dynamic"

/** Unica porta de entrada da base de dados a partir do browser. */
export async function POST(req: NextRequest) {
  // So JSON: um formulario de outro site nao consegue mandar este tipo sem pre-verificacao (CSRF)
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ erro: { code: "invalid-argument", message: "Pedido invalido." } }, { status: 415 })
  }
  let pedido: PedidoBD
  try {
    pedido = await req.json()
  } catch {
    return NextResponse.json({ erro: { code: "invalid-argument", message: "JSON invalido." } }, { status: 400 })
  }

  try {
    const p = await pedinteDe(await uidDaSessao())
    switch (pedido.op) {
      case "get":
        return NextResponse.json({ doc: await lerDocumento(p, pedido.colecao, pedido.id) })
      case "query":
        return NextResponse.json({ docs: await consultarColecao(p, pedido.consulta) })
      case "count":
        return NextResponse.json({ count: await contarColecao(p, pedido.consulta) })
      case "commit":
        await gravarLote(p, pedido.escritas)
        return NextResponse.json({ ok: true })
      default:
        return NextResponse.json({ erro: { code: "invalid-argument", message: "Operacao desconhecida." } }, { status: 400 })
    }
  } catch (e) {
    if (e instanceof ErroRegra) {
      const estado = { "permission-denied": 403, "not-found": 404, aborted: 409, "invalid-argument": 400 }[e.code]
      return NextResponse.json({ erro: { code: e.code, message: e.message } }, { status: estado })
    }
    console.error("[api/bd]", e)
    return NextResponse.json({ erro: { code: "internal", message: "Erro no servidor da base de dados." } }, { status: 500 })
  }
}
