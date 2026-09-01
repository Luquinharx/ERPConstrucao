"use client"

import { useEffect, useState } from "react"
import { Building2, Check, ImageIcon, Loader2, Palette, Upload, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { CampoNumerico } from "@/components/ui/campo-numerico"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { useConfiguracao } from "@/hooks/use-configuracao"
import { FONTES_DISPONIVEIS, PALETAS, corDeTexto } from "@/lib/brand"
import type { ConfiguracaoEmpresa } from "@/lib/types"

/** Limite do logotipo em base64, para nao estourar o documento do Firestore. */
const LIMITE_LOGO_KB = 400

export function IdentidadeDaEmpresa() {
  const { configuracao, guardar, prever } = useConfiguracao()
  const [form, setForm] = useState<ConfiguracaoEmpresa>(configuracao)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => setForm(configuracao), [configuracao])

  // Pre-visualiza cor e fonte enquanto se mexe, sem gravar
  useEffect(() => {
    prever({ corPrimaria: form.corPrimaria, fonte: form.fonte })
  }, [form.corPrimaria, form.fonte, prever])

  const alterar = (campos: Partial<ConfiguracaoEmpresa>) => setForm((atual) => ({ ...atual, ...campos }))

  const carregarLogo = (ficheiro: File) => {
    if (ficheiro.size > LIMITE_LOGO_KB * 1024) {
      toast({
        title: "Imagem demasiado grande",
        description: `O logotipo deve ter menos de ${LIMITE_LOGO_KB} KB. Reduza a imagem e tente de novo.`,
        variant: "destructive",
      })
      return
    }
    const leitor = new FileReader()
    leitor.onload = () => alterar({ logoUrl: String(leitor.result) })
    leitor.readAsDataURL(ficheiro)
  }

  const submeter = async () => {
    setGuardando(true)
    try {
      await guardar(form)
      toast({ title: "Identidade guardada", description: "As alteracoes ja se aplicam ao sistema e as propostas." })
    } catch (error) {
      toast({
        title: "Erro ao guardar",
        description: "Nao foi possivel guardar a configuracao.",
        variant: "destructive",
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Logotipo
          </CardTitle>
          <CardDescription>Aparece no menu lateral e no cabecalho das propostas impressas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-24 w-56 items-center justify-center rounded-lg border bg-background p-3">
              {form.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <span
                  className={
                    form.logoFundo === "escuro"
                      ? "rounded-md bg-neutral-900 p-2"
                      : form.logoFundo === "nenhum"
                        ? ""
                        : "rounded-md p-2 dark:bg-white/95"
                  }
                >
                  <img src={form.logoUrl} alt={form.nome} className="max-h-16 max-w-full object-contain" />
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Sem logotipo</span>
              )}
            </div>

            <div className="space-y-2">
              <input
                id="ficheiro-logo"
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={(e) => {
                  const ficheiro = e.target.files?.[0]
                  if (ficheiro) carregarLogo(ficheiro)
                }}
              />
              <Button type="button" variant="outline" onClick={() => document.getElementById("ficheiro-logo")?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Carregar imagem
              </Button>
              {form.logoUrl && (
                <Button type="button" variant="ghost" className="w-full" onClick={() => alterar({ logoUrl: "" })}>
                  <X className="h-4 w-4 mr-2" />
                  Remover
                </Button>
              )}
              <p className="text-xs text-muted-foreground">PNG, JPG, SVG ou WEBP ate {LIMITE_LOGO_KB} KB.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="logoFundo">Fundo por tras do logotipo</Label>
            <Select
              value={form.logoFundo || "auto"}
              onValueChange={(valor) => alterar({ logoFundo: valor as ConfiguracaoEmpresa["logoFundo"] })}
            >
              <SelectTrigger className="rounded-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automatico - placa clara so no tema escuro</SelectItem>
                <SelectItem value="claro">Sempre claro</SelectItem>
                <SelectItem value="escuro">Sempre escuro</SelectItem>
                <SelectItem value="nenhum">Sem fundo</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Logotipos com tinta escura desaparecem sobre fundo escuro. A placa resolve isso sem alterar a imagem.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="logoUrl">Ou indicar um endereco</Label>
            <Input
              id="logoUrl"
              value={form.logoUrl?.startsWith("data:") ? "" : form.logoUrl || ""}
              onChange={(e) => alterar({ logoUrl: e.target.value })}
              placeholder="/marca/logo-tecknowhow.png"
              className="rounded-full"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Cores e tipografia
          </CardTitle>
          <CardDescription>As mudancas aplicam-se de imediato, para poder ver antes de guardar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Paletas prontas</Label>
            <div className="flex flex-wrap gap-2">
              {PALETAS.map((paleta) => {
                const ativa = form.corPrimaria.toUpperCase() === paleta.primaria.toUpperCase()
                return (
                  <button
                    key={paleta.nome}
                    type="button"
                    onClick={() =>
                      alterar({
                        corPrimaria: paleta.primaria,
                        corSecundaria: paleta.secundaria,
                        corEscura: paleta.escura,
                      })
                    }
                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                      ativa ? "border-primary bg-primary/10" : "hover:bg-accent"
                    }`}
                  >
                    <span className="flex gap-1">
                      {[paleta.primaria, paleta.secundaria, paleta.escura].map((cor) => (
                        <span key={cor} className="h-4 w-4 rounded-full border" style={{ backgroundColor: cor }} />
                      ))}
                    </span>
                    {paleta.nome}
                    {ativa && <Check className="h-3 w-3" />}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { campo: "corPrimaria" as const, rotulo: "Cor principal", ajuda: "Botoes, destaques e cabecalhos" },
              { campo: "corSecundaria" as const, rotulo: "Cor secundaria", ajuda: "Apoio nos documentos" },
              { campo: "corEscura" as const, rotulo: "Cor escura", ajuda: "Cabecalhos de tabela" },
            ].map(({ campo, rotulo, ajuda }) => (
              <div key={campo} className="space-y-2">
                <Label htmlFor={campo}>{rotulo}</Label>
                <div className="flex gap-2">
                  <input
                    id={campo}
                    type="color"
                    value={form[campo]}
                    onChange={(e) => alterar({ [campo]: e.target.value })}
                    className="h-10 w-12 cursor-pointer rounded-md border bg-transparent"
                  />
                  <Input
                    value={form[campo]}
                    onChange={(e) => alterar({ [campo]: e.target.value })}
                    className="rounded-full font-mono text-sm"
                  />
                </div>
                <p className="text-xs text-muted-foreground">{ajuda}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="fonte">Tipo de letra</Label>
            <Select value={form.fonte} onValueChange={(valor) => alterar({ fonte: valor })}>
              <SelectTrigger className="rounded-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONTES_DISPONIVEIS.map((fonte) => (
                  <SelectItem key={fonte.id} value={fonte.id}>
                    {fonte.nome} - {fonte.amostra}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">Pre-visualizacao</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span
                className="rounded-md px-3 py-1.5 text-sm font-semibold"
                style={{ backgroundColor: form.corPrimaria, color: corDeTexto(form.corPrimaria) }}
              >
                {form.nome || "Nome da empresa"}
              </span>
              <span
                className="rounded-md px-3 py-1.5 text-sm font-semibold"
                style={{ backgroundColor: form.corEscura, color: corDeTexto(form.corEscura) }}
              >
                Cabecalho de tabela
              </span>
              <Button size="sm">Botao</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Dados da empresa
          </CardTitle>
          <CardDescription>Impressos no cabecalho das propostas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={(e) => alterar({ nome: e.target.value })}
                className="rounded-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slogan">Descritivo</Label>
              <Input
                id="slogan"
                value={form.slogan || ""}
                onChange={(e) => alterar({ slogan: e.target.value })}
                placeholder="Construcao Civil e Remodelacoes"
                className="rounded-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="razaoSocial">Denominacao social</Label>
              <Input
                id="razaoSocial"
                value={form.razaoSocial || ""}
                onChange={(e) => alterar({ razaoSocial: e.target.value })}
                placeholder="EMPRESA, Lda."
                className="rounded-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capitalSocial">Capital social</Label>
              <Input
                id="capitalSocial"
                value={form.capitalSocial || ""}
                onChange={(e) => alterar({ capitalSocial: e.target.value })}
                placeholder="5.000,00 euros"
                className="rounded-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nif">NIF</Label>
              <Input
                id="nif"
                value={form.nif || ""}
                onChange={(e) => alterar({ nif: e.target.value })}
                className="rounded-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={form.telefone || ""}
                onChange={(e) => alterar({ telefone: e.target.value })}
                className="rounded-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emailEmpresa">Email</Label>
              <Input
                id="emailEmpresa"
                value={form.email || ""}
                onChange={(e) => alterar({ email: e.target.value })}
                className="rounded-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={form.website || ""}
                onChange={(e) => alterar({ website: e.target.value })}
                placeholder="www.tecknowhow.pt"
                className="rounded-full"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="morada">Morada</Label>
              <Input
                id="morada"
                value={form.morada || ""}
                onChange={(e) => alterar({ morada: e.target.value })}
                className="rounded-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="codigoPostal">Codigo postal</Label>
              <Input
                id="codigoPostal"
                value={form.codigoPostal || ""}
                onChange={(e) => alterar({ codigoPostal: e.target.value })}
                className="rounded-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Padroes das propostas</CardTitle>
          <CardDescription>Valores sugeridos ao criar um orcamento e notas do rodape.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div className="space-y-2">
              <Label htmlFor="prefixoOrcamento">Prefixo concurso</Label>
              <Input
                id="prefixoOrcamento"
                value={form.prefixoOrcamento ?? ""}
                onChange={(e) => alterar({ prefixoOrcamento: e.target.value.toUpperCase() })}
                placeholder="CO"
                className="rounded-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prefixoObra">Prefixo obra</Label>
              <Input
                id="prefixoObra"
                value={form.prefixoObra ?? ""}
                onChange={(e) => alterar({ prefixoObra: e.target.value.toUpperCase() })}
                placeholder="O"
                className="rounded-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sufixoOrcamento">Sufixo</Label>
              <Input
                id="sufixoOrcamento"
                value={form.sufixoOrcamento || ""}
                onChange={(e) => alterar({ sufixoOrcamento: e.target.value })}
                placeholder="/2026"
                className="rounded-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="validadeDiasPadrao">Validade (dias)</Label>
              <CampoNumerico
                id="validadeDiasPadrao"
                decimais={0}
                min={1}
                value={form.validadeDiasPadrao ?? 30}
                onChange={(validadeDiasPadrao) => alterar({ validadeDiasPadrao })}
                className="rounded-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="margemPadrao">Margem (%)</Label>
              <CampoNumerico
                id="margemPadrao"
                min={0}
                sufixo="%"
                value={form.margemPadrao ?? 20}
                onChange={(margemPadrao) => alterar({ margemPadrao })}
                className="rounded-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxaIVAPadrao">IVA (%)</Label>
              <CampoNumerico
                id="taxaIVAPadrao"
                min={0}
                max={100}
                sufixo="%"
                value={form.taxaIVAPadrao ?? 23}
                onChange={(taxaIVAPadrao) => alterar({ taxaIVAPadrao })}
                className="rounded-full"
              />
            </div>
          </div>

          {/*
            Cada tipo tem contagem propria: os concursos nao gastam numeros de
            obra nem o contrario. Um concurso adjudicado passa a obra ficando com
            o mesmo numero, por isso ve-se de onde a obra veio.
          */}
          <p className="text-xs text-muted-foreground">
            Concursos saem como{" "}
            <strong className="text-foreground">
              {(form.prefixoOrcamento ?? "CO")}26/0001{form.sufixoOrcamento || ""}
            </strong>{" "}
            e obras como{" "}
            <strong className="text-foreground">
              {(form.prefixoObra ?? "O")}26/0001{form.sufixoOrcamento || ""}
            </strong>
            . Cada tipo conta por si, e um concurso adjudicado passa a obra com o mesmo numero.
          </p>

          <div className="space-y-2">
            <Label htmlFor="notas">Notas do rodape (uma por linha)</Label>
            <Textarea
              id="notas"
              rows={6}
              value={(form.notasOrcamento || []).join("\n")}
              onChange={(e) => alterar({ notasOrcamento: e.target.value.split("\n") })}
              placeholder="Condicoes de pagamento, validade da proposta..."
            />
            <p className="text-xs text-muted-foreground">
              Saem numeradas no fim da proposta, como nas condicoes gerais.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={submeter} disabled={guardando} className="rounded-full min-w-[160px]">
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar identidade"}
        </Button>
      </div>
    </div>
  )
}
