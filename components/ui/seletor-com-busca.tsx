"use client"

import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface OpcaoSeletor {
  valor: string
  rotulo: string
  /** Linha secundaria, ex.: preco e unidade. */
  detalhe?: string
}

interface SeletorComBuscaProps {
  opcoes: OpcaoSeletor[]
  valor?: string
  onChange: (valor: string) => void
  placeholder?: string
  placeholderBusca?: string
  vazio?: string
  className?: string
  /** Altura do gatilho, para caber dentro de tabelas. */
  compacto?: boolean
}

/**
 * Seletor com campo de busca.
 *
 * Substitui o Select simples quando a lista cresce: com dezenas de materiais,
 * a lista larga ocupava o ecra todo e obrigava a procurar a olho.
 */
export function SeletorComBusca({
  opcoes,
  valor,
  onChange,
  placeholder = "Selecionar...",
  placeholderBusca = "Escrever para procurar...",
  vazio = "Nada encontrado.",
  className,
  compacto = false,
}: SeletorComBuscaProps) {
  const [aberto, setAberto] = useState(false)
  const selecionada = opcoes.find((opcao) => opcao.valor === valor)

  // Altura minima da lista pelo total de opcoes (nao pelas filtradas): sem isto o painel
  // encolhe a cada tecla e, quando abre para cima, a barra de busca salta pelo ecra.
  // ~3.25rem por opcao (rotulo + detalhe), no maximo 4 opcoes de altura.
  const alturaMinimaLista = `${Math.min(opcoes.length, 4) * 3.25}rem`

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={aberto}
          className={cn(
            "w-full min-w-0 justify-between font-normal",
            compacto ? "h-7 px-2 text-xs" : "h-9 text-sm",
            !selecionada && "text-muted-foreground",
            className,
          )}
        >
          {/* min-w-0: sem isto o texto nao encolhe dentro do flex e a celula cresce com ele */}
          <span className="min-w-0 truncate text-left">{selecionada?.rotulo || placeholder}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      {/*
        max-h pela altura disponivel do Radix: o painel nunca passa do fundo do ecra,
        por isso deixa de empurrar a lista para fora da vista quando esta perto do rodape.
        collisionPadding deixa uma folga para o painel nao colar aos limites da janela.
      */}
      <PopoverContent
        className="flex max-h-[min(22rem,var(--radix-popover-content-available-height,22rem))] w-[min(560px,90vw)] flex-col overflow-hidden p-0 shadow-lg"
        align="start"
        sideOffset={6}
        collisionPadding={12}
      >
        <Command
          className="flex h-auto min-h-0 flex-1 flex-col"
          filter={(value, search) => {
            // Procura sem acentos, no rotulo e no detalhe
            const normalizar = (texto: string) =>
              texto
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
            return normalizar(value).includes(normalizar(search)) ? 1 : 0
          }}
        >
          {/*
            Cabecalho fixo: a barra de busca fica sempre no topo enquanto a lista corre por baixo.
            Fundo cinza claro (bg-muted) para se distinguir do branco da lista e do fundo da pagina.
          */}
          <div className="sticky top-0 z-10 shrink-0 bg-muted/70">
            <CommandInput placeholder={placeholderBusca} className="h-10" />
          </div>

          {/* flex-1: a lista fica com o resto da altura e faz o proprio scroll por baixo do cabecalho */}
          <CommandList className="flex-1 overflow-y-auto" style={{ minHeight: alturaMinimaLista }}>
            <CommandEmpty>{vazio}</CommandEmpty>
            <CommandGroup>
              {opcoes.map((opcao) => (
                <CommandItem
                  key={opcao.valor}
                  value={`${opcao.rotulo} ${opcao.detalhe || ""}`}
                  onSelect={() => {
                    onChange(opcao.valor)
                    setAberto(false)
                  }}
                  className="flex items-start gap-2"
                >
                  <Check
                    className={cn("mt-0.5 h-4 w-4 shrink-0", valor === opcao.valor ? "opacity-100" : "opacity-0")}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-snug">{opcao.rotulo}</span>
                    {opcao.detalhe && (
                      <span className="block text-xs text-muted-foreground">{opcao.detalhe}</span>
                    )}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
