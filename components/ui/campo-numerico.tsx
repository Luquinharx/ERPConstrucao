"use client"

import * as React from "react"

import { cn, round2 } from "@/lib/utils"

/**
 * Le um numero escrito a portuguesa ou a inglesa: "1234,56", "1234.56" ou "1.234,56".
 * Quando aparecem os dois separadores, o ultimo manda (e o outro e milhar).
 */
export function parseNumeroPt(texto: string): number | null {
  const limpo = texto.replace(/[^\d.,+-]/g, "")
  if (!limpo || limpo === "-" || limpo === "+" || limpo === "," || limpo === ".") return null

  const virgula = limpo.lastIndexOf(",")
  const ponto = limpo.lastIndexOf(".")

  let normalizado = limpo
  if (virgula > -1 && ponto > -1) {
    const decimal = virgula > ponto ? "," : "."
    const milhar = decimal === "," ? "." : ","
    normalizado = limpo.split(milhar).join("").replace(decimal, ".")
  } else if (virgula > -1) {
    normalizado = limpo.replace(",", ".")
  }

  const numero = Number.parseFloat(normalizado)
  return Number.isFinite(numero) ? numero : null
}

/**
 * Escreve o numero como o resto da app o mostra: virgula decimal, sem separador de milhar.
 * Com decimais = 2 mostra sempre as duas casas (1 fica "1,00", 1.01 fica "1,01").
 */
function formatar(valor: number, decimais: number): string {
  if (!Number.isFinite(valor)) return ""
  return new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: Math.min(decimais, 2),
    maximumFractionDigits: decimais,
    useGrouping: false,
  }).format(valor)
}

type TamanhoCampo = "sm" | "md"

export interface CampoNumericoProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type" | "step" | "min" | "max" | "size"> {
  value: number | string
  onChange: (valor: number) => void
  min?: number
  max?: number
  /** Casas decimais mostradas quando o campo perde o foco. 0 para contagens inteiras. */
  decimais?: number
  /** Texto fixo colado ao valor, ex.: "EUR", "%", "h". */
  sufixo?: string
  /** sm: linhas de tabela. md: formularios. */
  tamanho?: TamanhoCampo
  alinhamento?: "esquerda" | "centro" | "direita"
}

/**
 * Campo numerico de preenchimento manual.
 *
 * Nao usa <input type="number"> por tres razoes concretas que davam problemas aqui:
 * 1. As setas nativas do Chrome ficam POR CIMA do texto e comiam o valor nas colunas
 *    estreitas da tabela de composicao. Aqui nao ha setas nenhumas: o valor tem o campo todo.
 * 2. Num type="number" o browser devolve "" a meio de "25," ou "25." e o
 *    `parseFloat(...) || 0` da pagina limpava o campo para 0 a meio de escrever um decimal.
 *    Aqui guarda-se o que esta escrito (rascunho) ate sair do campo.
 * 3. O type="number" nao aceita virgula decimal, que e como se escreve em pt-PT.
 *
 * E o mesmo caminho do NumberField da React Aria e do InputNumber do Ant Design.
 */
export const CampoNumerico = React.forwardRef<HTMLInputElement, CampoNumericoProps>(function CampoNumerico(
  {
    value,
    onChange,
    min,
    max,
    decimais = 2,
    sufixo,
    tamanho = "md",
    alinhamento = "direita",
    className,
    disabled,
    onBlur,
    ...props
  },
  ref,
) {
  // Rascunho: o que o utilizador tem escrito. A null, o campo mostra o valor da app.
  const [rascunho, setRascunho] = React.useState<string | null>(null)

  const numero = typeof value === "number" ? value : parseNumeroPt(String(value ?? "")) ?? 0
  const texto = rascunho ?? formatar(numero, decimais)

  const escrever = (bruto: string) => {
    setRascunho(bruto)
    const lido = parseNumeroPt(bruto)
    // Sem limitar aqui: com min=1, escrever "10" passava pelo "1" e saltava para 1.
    onChange(lido === null ? 0 : round2(lido))
  }

  const sair = (evento: React.FocusEvent<HTMLInputElement>) => {
    const lido = parseNumeroPt(texto) ?? min ?? 0
    let resultado = lido
    if (typeof min === "number") resultado = Math.max(min, resultado)
    if (typeof max === "number") resultado = Math.min(max, resultado)
    setRascunho(null)
    onChange(round2(resultado))
    onBlur?.(evento)
  }

  const compacto = tamanho === "sm"
  const alinhamentoTexto =
    alinhamento === "centro" ? "text-center" : alinhamento === "esquerda" ? "text-left" : "text-right"

  return (
    <div
      className={cn(
        "flex w-full min-w-0 items-stretch overflow-hidden rounded-md border border-input bg-background",
        "ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        compacto ? "h-8 text-sm" : "h-10 text-base md:text-sm",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={texto}
        disabled={disabled}
        onChange={(evento) => escrever(evento.target.value)}
        onBlur={sair}
        onFocus={(evento) => evento.target.select()}
        className={cn(
          "w-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed",
          compacto ? "px-2" : "px-3",
          sufixo && "pr-1",
          alinhamentoTexto,
        )}
        {...props}
      />

      {sufixo && (
        <span
          className={cn(
            "pointer-events-none flex select-none items-center text-xs text-muted-foreground",
            compacto ? "pr-2" : "pr-3",
          )}
        >
          {sufixo}
        </span>
      )}
    </div>
  )
})
