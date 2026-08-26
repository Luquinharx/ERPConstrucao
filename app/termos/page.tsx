"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { LoadingSpinner } from "@/components/ui/loading-spinner"

/**
 * Os termos passaram a ser uma aba em Configuracoes, para nao haver dois
 * lugares a gerir a mesma coisa. Esta rota mantem-se apenas para nao partir
 * ligacoes antigas ou favoritos.
 */
export default function TermosRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/configuracoes?aba=termos")
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <LoadingSpinner size="lg" />
    </div>
  )
}
