"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import QRCode from "qrcode"
import { Printer } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CampoNumerico } from "@/components/ui/campo-numerico"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { useAuth } from "@/hooks/use-auth"
import { FirebaseService } from "@/lib/firebase-service"
import { codigoEtiqueta } from "@/lib/etiquetas"
import type { Material } from "@/lib/types"
import { matchesSearch } from "@/lib/utils"

/**
 * Etiquetas com QR para os produtos do armazem. O QR leva o id do produto,
 * por isso continua a funcionar se o nome ou o codigo mudarem.
 */
export default function EtiquetasPage() {
  const { user } = useAuth()
  const [produtos, setProdutos] = useState<Material[]>([])
  const [copias, setCopias] = useState<Record<string, number>>({})
  const [qr, setQr] = useState<Record<string, string>>({})
  const [busca, setBusca] = useState("")
  const [aCarregar, setACarregar] = useState(true)

  const carregar = useCallback(async () => {
    if (!user) return
    try {
      const lista = await FirebaseService.getMateriais(user.uid)
      setProdutos(lista.filter((p) => p.controlaEstoque).sort((a, b) => a.nome.localeCompare(b.nome)))
    } finally {
      setACarregar(false)
    }
  }, [user])
  useEffect(() => {
    void carregar()
  }, [carregar])

  // QR so dos escolhidos, gerado no browser
  const escolhidos = useMemo(() => produtos.filter((p) => (copias[p.id!] || 0) > 0), [produtos, copias])
  useEffect(() => {
    for (const p of escolhidos) {
      if (qr[p.id!]) continue
      QRCode.toDataURL(codigoEtiqueta(p.id!), { margin: 1, width: 240 }).then((url) => setQr((a) => ({ ...a, [p.id!]: url })))
    }
  }, [escolhidos, qr])

  const visiveis = produtos.filter((p) => !busca.trim() || matchesSearch(busca, [p.codigo, p.nome]))
  const etiquetas = escolhidos.flatMap((p) => Array.from({ length: copias[p.id!] || 0 }, (_, i) => ({ p, i })))

  if (aCarregar) return <LoadingSpinner size="lg" />

  return (
    <div className="space-y-6 animate-fade-in">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #folha-etiquetas, #folha-etiquetas * { visibility: visible !important; }
          #folha-etiquetas { position: absolute; left: 0; top: 0; width: 100%; }
          @page { size: A4; margin: 8mm; }
        }
      `}</style>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-3xl font-bold">Etiquetas</h1>
          <p className="mt-2 text-muted-foreground">QR para colar nos produtos e equipamentos. Le-se com a camera em Bipar.</p>
        </div>
        <Button onClick={() => window.print()} disabled={etiquetas.length === 0} className="rounded-full">
          <Printer className="mr-2 h-4 w-4" />
          Imprimir {etiquetas.length} etiqueta(s)
        </Button>
      </div>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="text-lg">Produtos com controlo de estoque</CardTitle>
          <CardDescription>Indique quantas etiquetas quer de cada um.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Procurar produto..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          <div className="grid gap-2 sm:grid-cols-2">
            {visiveis.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border p-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{p.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.codigo || "sem codigo"}
                    {p.tipoItem === "equipamento" ? " · equipamento" : ""}
                  </div>
                </div>
                <CampoNumerico
                  tamanho="sm"
                  min={0}
                  decimais={0}
                  aria-label={`Etiquetas ${p.nome}`}
                  value={copias[p.id!] || 0}
                  onChange={(n) => setCopias({ ...copias, [p.id!]: Math.round(n) })}
                  className="w-20"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div id="folha-etiquetas" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" data-testid="folha-etiquetas">
        {etiquetas.map(({ p, i }) => (
          <div key={`${p.id}-${i}`} className="flex items-center gap-2 rounded border bg-white p-2 text-black" style={{ breakInside: "avoid" }}>
            {qr[p.id!] ? <img src={qr[p.id!]} alt={`QR ${p.nome}`} className="h-20 w-20" /> : <div className="h-20 w-20 bg-muted" />}
            <div className="min-w-0 text-[11px] leading-tight">
              <div className="font-semibold">{p.nome}</div>
              <div>{p.codigo || ""}</div>
              <div className="text-[9px] text-gray-500">{p.unidade}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
