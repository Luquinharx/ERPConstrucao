import { z } from "zod"

import { m } from "@/lib/i18n"

// Mensagens marcadas com m(): traduzem-se onde aparecem, com t(erro.message)

export const clienteSchema = z.object({
  nome: z.string().min(3, m("O nome deve ter pelo menos 3 caracteres")),
  email: z.string().email(m("Email inválido")),
  telefone: z.string().min(9, m("Telefone inválido")),
  morada: z.string().optional(),
  cidade: z.string().optional(),
  codigoPostal: z.string().optional(),
  nif: z.string().optional(),
  observacoes: z.string().optional(),
})

export const funcionarioSchema = z.object({
  nome: z.string().min(3, m("O nome deve ter pelo menos 3 caracteres")),
  email: z.string().email(m("Email inválido")),
  telefone: z.string().min(9, m("Telefone inválido")),
  funcao: z.string().min(2, m("Função obrigatória")),
  margemLucro: z.number().min(0).optional(),
  custoHora: z.number().min(0),
  // ... outros campos podem ser adicionados conforme necessário
})

export type ClienteFormData = z.infer<typeof clienteSchema>
export type FuncionarioFormData = z.infer<typeof funcionarioSchema>