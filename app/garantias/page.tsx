"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { listar } from "@/lib/firebase-service"
import { ESTADOS_GARANTIA, estadoGarantia, fimGarantia } from "@/lib/garantias"
import type { Garantia } from "@/lib/types"
import { formatDate } from "@/lib/utils"

/** Todas as obras entregues, com o estado da garantia e ocorrencias em aberto. */
export default function GarantiasPage() {
  const [fichas, setFichas] = useState<Garantia[]>([])
  const [aCarregar, setACarregar] = useState(true)
  useEffect(() => {
    listar<Garantia>("garantias")
      .then((l) => setFichas(l.sort((a, b) => fimGarantia(a).localeCompare(fimGarantia(b)))))
      .finally(() => setACarregar(false))
  }, [])
  if (aCarregar) return <LoadingSpinner size="lg" />

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Pos-obra e garantias</h1>
        <p className="mt-2 text-muted-foreground">Obras entregues, prazo de garantia e reclamacoes em aberto.</p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Obra</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Entregue</TableHead>
                <TableHead>Garantia ate</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Ocorrencias abertas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fichas.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Nenhuma obra entregue ainda. A ficha cria-se na obra, separador Garantia.</TableCell></TableRow>
              ) : (
                fichas.map((g) => {
                  const estado = estadoGarantia(g)
                  const abertas = g.ocorrencias.filter((o) => !o.resolvida).length
                  return (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">
                        <Link href={`/orcamentos/${g.orcamentoId}/garantia`} className="underline">{g.orcamentoNumero}</Link>
                      </TableCell>
                      <TableCell>{g.clienteNome}</TableCell>
                      <TableCell>{formatDate(g.dataEntrega)}</TableCell>
                      <TableCell>{formatDate(fimGarantia(g))}</TableCell>
                      <TableCell><Badge variant="outline" className={ESTADOS_GARANTIA[estado].cor}>{ESTADOS_GARANTIA[estado].nome}</Badge></TableCell>
                      <TableCell className={`text-right ${abertas ? "font-medium text-rose-700" : ""}`}>{abertas}</TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
