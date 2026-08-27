"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { AlertCircle, CheckCircle2, Mail } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { EcraDeAcesso } from "@/components/layout/ecra-de-acesso"
import { useAuth } from "@/hooks/use-auth"
import { mensagemDeErroAuth } from "@/lib/auth-mensagens"

export default function RecuperarPalavraPassePage() {
  const [email, setEmail] = useState("")
  const [aEnviar, setAEnviar] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState("")
  const { resetPassword } = useAuth()

  const submeter = async (evento: React.FormEvent) => {
    evento.preventDefault()
    setErro("")

    if (!email.trim()) return setErro("Indique o email da conta.")

    setAEnviar(true)
    try {
      await resetPassword(email.trim())
      setEnviado(true)
    } catch (error) {
      setErro(mensagemDeErroAuth(error, "Nao foi possivel enviar o email. Tente de novo."))
    } finally {
      setAEnviar(false)
    }
  }

  return (
    <EcraDeAcesso
      titulo="Recuperar palavra-passe"
      descricao="Enviamos-lhe um link para definir uma nova palavra-passe."
      voltar={{ href: "/login", texto: "Voltar ao login" }}
    >
      {enviado ? (
        <div className="space-y-4">
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Se existir uma conta com <strong>{email}</strong>, o email com o link ja seguiu. Verifique tambem a
              pasta de correio nao solicitado.
            </AlertDescription>
          </Alert>
          <Button asChild className="w-full rounded-full">
            <Link href="/login">Voltar ao login</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={submeter} className="space-y-4">
          {erro && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email da conta</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="nome@empresa.pt"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-full pl-11"
                required
                disabled={aEnviar}
              />
            </div>
          </div>

          <Button type="submit" className="w-full rounded-full" disabled={aEnviar}>
            {aEnviar ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                A enviar...
              </>
            ) : (
              "Enviar link de recuperacao"
            )}
          </Button>
        </form>
      )}
    </EcraDeAcesso>
  )
}
