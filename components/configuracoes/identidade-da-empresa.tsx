"use client"

import { useEffect, useState } from "react"
import { Building2, Check, ImageIcon, Loader2, Palette, Upload, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { CampoNumerico } from "@/components/ui/campo-numerico"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { useConfiguracao } from "@/hooks/use-configuracao"
import { FONTES_DISPONIVEIS, PALETAS, corDeTexto } from "@/lib/brand"
import type { ConfiguracaoEmpresa } from "@/lib/types"
import { t } from "@/lib/i18n"

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
        title: t("Imagem demasiado grande"),
        description: t("O logótipo deve ter menos de {kb} KB. Reduza a imagem e tente de novo.", { kb: LIMITE_LOGO_KB }),
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
      toast({ title: t("Identidade guardada"), description: t("As alterações já se aplicam ao sistema e às propostas.") })
    } catch (error) {
      toast({
        title: t("Erro ao guardar"),
        description: t("Não foi possível guardar a configuração."),
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
            {t("Logótipo")}
          </CardTitle>
          <CardDescription>{t("Aparece no menu lateral e no cabeçalho das propostas impressas.")}</CardDescription>
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
                <span className="text-xs text-muted-foreground">{t("Sem logótipo")}</span>
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
                {t("Carregar imagem")}
              </Button>
              {form.logoUrl && (
                <Button type="button" variant="ghost" className="w-full" onClick={() => alterar({ logoUrl: "" })}>
                  <X className="h-4 w-4 mr-2" />
                  {t("Remover")}
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                {t("PNG, JPG, SVG ou WEBP até {kb} KB.", { kb: LIMITE_LOGO_KB })}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="logoFundo">{t("Fundo por trás do logótipo")}</Label>
            <Select
              value={form.logoFundo || "auto"}
              onValueChange={(valor) => alterar({ logoFundo: valor as ConfiguracaoEmpresa["logoFundo"] })}
            >
              <SelectTrigger className="rounded-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">{t("Automático - placa clara só no tema escuro")}</SelectItem>
                <SelectItem value="claro">{t("Sempre claro")}</SelectItem>
                <SelectItem value="escuro">{t("Sempre escuro")}</SelectItem>
                <SelectItem value="nenhum">{t("Sem fundo")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("Logótipos com tinta escura desaparecem sobre fundo escuro. A placa resolve isso sem alterar a imagem.")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="logoUrl">{t("Ou indicar um endereço")}</Label>
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
            {t("Cores e tipografia")}
          </CardTitle>
          <CardDescription>{t("As mudanças aplicam-se de imediato, para poder ver antes de guardar.")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>{t("Paletas prontas")}</Label>
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
                    {t(paleta.nome)}
                    {ativa && <Check className="h-3 w-3" />}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { campo: "corPrimaria" as const, rotulo: t("Cor principal"), ajuda: t("Botões, destaques e cabeçalhos") },
              { campo: "corSecundaria" as const, rotulo: t("Cor secundária"), ajuda: t("Apoio nos documentos") },
              { campo: "corEscura" as const, rotulo: t("Cor escura"), ajuda: t("Cabeçalhos de tabela") },
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
            <Label htmlFor="fonte">{t("Tipo de letra")}</Label>
            <Select value={form.fonte} onValueChange={(valor) => alterar({ fonte: valor })}>
              <SelectTrigger className="rounded-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONTES_DISPONIVEIS.map((fonte) => (
                  <SelectItem key={fonte.id} value={fonte.id}>
                    {fonte.nome} - {t(fonte.amostra)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">{t("Pré-visualização")}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span
                className="rounded-md px-3 py-1.5 text-sm font-semibold"
                style={{ backgroundColor: form.corPrimaria, color: corDeTexto(form.corPrimaria) }}
              >
                {form.nome || t("Nome da empresa")}
              </span>
              <span
                className="rounded-md px-3 py-1.5 text-sm font-semibold"
                style={{ backgroundColor: form.corEscura, color: corDeTexto(form.corEscura) }}
              >
                {t("Cabeçalho de tabela")}
              </span>
              <Button size="sm">{t("Botão")}</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {t("Dados da empresa")}
          </CardTitle>
          <CardDescription>{t("Impressos no cabeçalho das propostas.")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nome">{t("Nome")}</Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={(e) => alterar({ nome: e.target.value })}
                className="rounded-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slogan">{t("Descritivo")}</Label>
              <Input
                id="slogan"
                value={form.slogan || ""}
                onChange={(e) => alterar({ slogan: e.target.value })}
                placeholder={t("Construção Civil e Remodelações")}
                className="rounded-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="razaoSocial">{t("Denominação social")}</Label>
              <Input
                id="razaoSocial"
                value={form.razaoSocial || ""}
                onChange={(e) => alterar({ razaoSocial: e.target.value })}
                placeholder={t("EMPRESA, Lda.")}
                className="rounded-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capitalSocial">{t("Capital social")}</Label>
              <Input
                id="capitalSocial"
                value={form.capitalSocial || ""}
                onChange={(e) => alterar({ capitalSocial: e.target.value })}
                placeholder={t("5.000,00 euros")}
                className="rounded-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nif">{t("NIF")}</Label>
              <Input
                id="nif"
                value={form.nif || ""}
                onChange={(e) => alterar({ nif: e.target.value })}
                className="rounded-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">{t("Telefone")}</Label>
              <Input
                id="telefone"
                value={form.telefone || ""}
                onChange={(e) => alterar({ telefone: e.target.value })}
                className="rounded-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emailEmpresa">{t("Email")}</Label>
              <Input
                id="emailEmpresa"
                value={form.email || ""}
                onChange={(e) => alterar({ email: e.target.value })}
                className="rounded-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">{t("Website")}</Label>
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
              <Label htmlFor="morada">{t("Morada")}</Label>
              <Input
                id="morada"
                value={form.morada || ""}
                onChange={(e) => alterar({ morada: e.target.value })}
                className="rounded-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="codigoPostal">{t("Código postal")}</Label>
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
          <CardTitle>{t("Padrões das propostas")}</CardTitle>
          <CardDescription>{t("Valores sugeridos ao criar um orçamento e notas do rodapé.")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div className="space-y-2">
              <Label htmlFor="prefixoOrcamento">{t("Prefixo concurso")}</Label>
              <Input
                id="prefixoOrcamento"
                value={form.prefixoOrcamento ?? ""}
                onChange={(e) => alterar({ prefixoOrcamento: e.target.value.toUpperCase() })}
                placeholder="CO"
                className="rounded-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prefixoObra">{t("Prefixo obra")}</Label>
              <Input
                id="prefixoObra"
                value={form.prefixoObra ?? ""}
                onChange={(e) => alterar({ prefixoObra: e.target.value.toUpperCase() })}
                placeholder="O"
                className="rounded-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sufixoOrcamento">{t("Sufixo")}</Label>
              <Input
                id="sufixoOrcamento"
                value={form.sufixoOrcamento || ""}
                onChange={(e) => alterar({ sufixoOrcamento: e.target.value })}
                placeholder="/2026"
                className="rounded-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="validadeDiasPadrao">{t("Validade (dias)")}</Label>
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
              <Label htmlFor="margemPadrao">{t("Margem (%)")}</Label>
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
              <Label htmlFor="taxaIVAPadrao">{t("IVA (%)")}</Label>
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

          {/* Como nascem as propostas novas; cada proposta pode mudar na aba Preco */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-3 text-sm">
              <Switch
                checked={form.margemItemPadraoAtiva ?? true}
                onCheckedChange={(margemItemPadraoAtiva) => alterar({ margemItemPadraoAtiva })}
              />
              {t("Margem por item ligada nas propostas novas")}
            </label>
            <label className="flex items-center gap-3 text-sm">
              <Switch
                checked={form.margemGlobalPadraoAtiva ?? true}
                onCheckedChange={(margemGlobalPadraoAtiva) => alterar({ margemGlobalPadraoAtiva })}
              />
              {t("Margem global ligada nas propostas novas")}
            </label>
          </div>

          {/*
            Cada tipo tem contagem propria: os concursos nao gastam numeros de
            obra nem o contrario. Um concurso adjudicado passa a obra ficando com
            o mesmo numero, por isso ve-se de onde a obra veio.
          */}
          <p className="text-xs text-muted-foreground">
            {/* A frase traduz-se inteira; {concurso} e {obra} marcam os exemplos a negrito */}
            {t(
              "Concursos saem como {concurso} e obras como {obra}. Cada tipo conta por si, e um concurso adjudicado passa a obra com o mesmo número.",
            )
              .split(/(\{concurso\}|\{obra\})/)
              .map((parte, i) =>
                parte === "{concurso}" ? (
                  <strong key={i} className="text-foreground">
                    {(form.prefixoOrcamento ?? "CO")}26/0001{form.sufixoOrcamento || ""}
                  </strong>
                ) : parte === "{obra}" ? (
                  <strong key={i} className="text-foreground">
                    {(form.prefixoObra ?? "O")}26/0001{form.sufixoOrcamento || ""}
                  </strong>
                ) : (
                  parte
                ),
              )}
          </p>

          <div className="space-y-2">
            <Label htmlFor="notas">{t("Notas do rodapé (uma por linha)")}</Label>
            <Textarea
              id="notas"
              rows={6}
              value={(form.notasOrcamento || []).join("\n")}
              onChange={(e) => alterar({ notasOrcamento: e.target.value.split("\n") })}
              placeholder={t("Condições de pagamento, validade da proposta...")}
            />
            <p className="text-xs text-muted-foreground">
              {t("Saem numeradas no fim da proposta, como nas condições gerais.")}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={submeter} disabled={guardando} className="rounded-full min-w-[160px]">
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : t("Guardar identidade")}
        </Button>
      </div>
    </div>
  )
}
