"use client"

import { useState, useEffect } from "react"
import { FirebaseService } from "@/lib/firebase-service"
import { useAuth } from "./use-auth"
import type { Cliente, Funcionario, Material, Servico, Orcamento, MaterialCategory } from "@/lib/types"

export function useFirebaseData<T>(collectionName: string, orderByField = "createdAt") {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  useEffect(() => {
    if (!user) {
      setData([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const unsubscribe = FirebaseService.subscribeToCollection<T>(
      collectionName,
      user.uid,
      (newData) => {
        setData(newData)
        setLoading(false)
      },
      orderByField,
    )

    return () => unsubscribe()
  }, [user, collectionName, orderByField])

  return { data, loading, error, setData }
}

export function useClientes() {
  return useFirebaseData<Cliente>("clientes", "nome")
}

export function useFuncionarios() {
  return useFirebaseData<Funcionario>("funcionarios", "nome")
}

export function useMateriais() {
  return useFirebaseData<Material>("materiais", "nome")
}

export function useCategorias() {
  return useFirebaseData<MaterialCategory>("categorias", "nome")
}

export function useServicos() {
  return useFirebaseData<Servico>("servicos", "nome")
}

export function useOrcamentos() {
  return useFirebaseData<Orcamento>("orcamentos", "dataOrcamento")
}
