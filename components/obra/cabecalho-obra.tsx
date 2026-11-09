"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useConfiguracao } from "@/hooks/use-configuracao"
import { numeroCompleto } from "@/lib/numeracao"
import { getFase } from "@/lib/orcamento-fases"
import type { Orcamento } from "@/lib/types"
import { m, t } from "@/lib/i18n"

const ABAS = [
  ["apuramento", m("Apuramento")],
  ["autos", m("Autos de medição")],
  ["diario", m("Diário (RDO)")],
  ["pagamentos", m("Pagamentos")],
  ["garantia", m("Garantia")],
  ["portal", m("Portal do cliente")],
] as const

/**
 * Cabecalho comum das paginas da obra. Cada aba e uma pagina propria (com
 * endereco), como no editor de propostas: o voltar do browser funciona e da
 * para enviar o link de uma aba concreta.
 */
export function CabecalhoObra({ orcamento, subtitulo }: { orcamento: Orcamento; subtitulo?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const { configuracao } = useConfiguracao()
  const fase = getFase(orcamento.status)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push("/obras")}
            className="rounded-full"
            title={t("Voltar às obras")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{t("Obra {numero}", { numero: numeroCompleto(orcamento, configuracao) })}</h1>
            <p className="text-sm text-muted-foreground">
              {orcamento.cliente.nome}
              {subtitulo ? ` · ${subtitulo}` : ""}
            </p>
          </div>
        </div>
        <Badge variant="outline" className={fase.cor}>
          {t(fase.nome)}
        </Badge>
      </div>
      <nav className="flex flex-wrap gap-1 rounded-lg bg-muted p-1" aria-label={t("Separadores da obra")}>
        {ABAS.map(([rota, nome]) => {
          const href = `/orcamentos/${orcamento.id}/${rota}`
          const ativa = pathname === href
          return (
            <Link
              key={rota}
              href={href}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                ativa ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(nome)}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
