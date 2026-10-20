"use client"

import { useCallback, useEffect, useState } from "react"

import { useAuth } from "@/hooks/use-auth"
import { FirebaseService } from "@/lib/firebase-service"
import type { Orcamento } from "@/lib/types"

/**
 * Carrega uma proposta pelo id, para as paginas da obra.
 *
 * Devolve tambem a lista toda: a numeracao e o passar a obra precisam dela.
 */
export function useObra(id?: string) {
  const { user } = useAuth()
  const [orcamento, setOrcamento] = useState<Orcamento | null>(null)
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [aCarregar, setACarregar] = useState(true)

  const recarregar = useCallback(async () => {
    if (!user || !id) return
    try {
      const lista = await FirebaseService.getOrcamentos(user.uid)
      setOrcamentos(lista)
      setOrcamento(lista.find((o) => o.id === id) || null)
    } finally {
      setACarregar(false)
    }
  }, [user, id])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  return { orcamento, orcamentos, aCarregar, recarregar }
}
