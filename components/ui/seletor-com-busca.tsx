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

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={aberto}
          className={cn(
            "w-full justify-between font-normal",
            compacto ? "h-7 px-2 text-xs" : "h-9 text-sm",
            !selecionada && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{selecionada?.rotulo || placeholder}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[min(560px,90vw)] p-0" align="start">
        <Command
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
          <CommandInput placeholder={placeholderBusca} />
          <CommandList className="max-h-72">
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
