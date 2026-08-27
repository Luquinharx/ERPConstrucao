"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AlertCircle, Eye, EyeOff, Info, Lock, Mail, User } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { EcraDeAcesso } from "@/components/layout/ecra-de-acesso"
import { useAuth } from "@/hooks/use-auth"
import { mensagemDeErroAuth } from "@/lib/auth-mensagens"

export default function RegisterPage() {
  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [palavraPasse, setPalavraPasse] = useState("")
  const [confirmacao, setConfirmacao] = useState("")
  const [visivel, setVisivel] = useState(false)
  const [aCriar, setACriar] = useState(false)
  const [erro, setErro] = useState("")
  const { register, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user) router.push("/dashboard")
  }, [user, router])

  const submeter = async (evento: React.FormEvent) => {
    evento.preventDefault()
    setErro("")

    if (!nome.trim()) return setErro("Indique o seu nome.")
    if (!email.trim()) return setErro("Indique o email.")
    if (palavraPasse.length < 6) return setErro("A palavra-passe tem de ter pelo menos 6 caracteres.")
    if (palavraPasse !== confirmacao) return setErro("As palavras-passe nao coincidem.")

    setACriar(true)
    try {
      await register(email.trim(), palavraPasse, nome.trim())
      router.push("/dashboard")
    } catch (error) {
      setErro(mensagemDeErroAuth(error, "Nao foi possivel criar a conta. Tente de novo."))
    } finally {
      setACriar(false)
    }
  }

  return (
    <EcraDeAcesso
      titulo="Criar conta"
      descricao="Crie o seu acesso ao sistema."
      voltar={{ href: "/login", texto: "Voltar ao login" }}
      rodape={
        <p className="text-center text-sm text-muted-foreground">
          Ja tem conta?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </p>
      }
    >
      <form onSubmit={submeter} className="space-y-4">
        {erro && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}

        {/* Sem isto, quem se regista entra e ve um sistema vazio sem perceber porque */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            As contas novas entram em modo de <strong>consulta</strong>. Quem administra o sistema atribui depois o
            cargo e as permissoes em Utilizadores e cargos.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="nome">Nome</Label>
          <div className="relative">
            <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="nome"
              autoComplete="name"
              placeholder="Nome completo"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="rounded-full pl-11"
              required
              disabled={aCriar}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
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
              disabled={aCriar}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="palavra-passe">Palavra-passe</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="palavra-passe"
                type={visivel ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Min. 6 caracteres"
                value={palavraPasse}
                onChange={(e) => setPalavraPasse(e.target.value)}
                className="rounded-full pl-11 pr-12"
                required
                disabled={aCriar}
              />
              <button
                type="button"
                onClick={() => setVisivel(!visivel)}
                disabled={aCriar}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={visivel ? "Esconder palavra-passe" : "Mostrar palavra-passe"}
              >
                {visivel ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmacao">Confirmar</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="confirmacao"
                type={visivel ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Repita a palavra-passe"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                className="rounded-full pl-11"
                required
                disabled={aCriar}
              />
            </div>
          </div>
        </div>

        <Button type="submit" className="w-full rounded-full" disabled={aCriar}>
          {aCriar ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              A criar conta...
            </>
          ) : (
            "Criar conta"
          )}
        </Button>
      </form>
    </EcraDeAcesso>
  )
}
