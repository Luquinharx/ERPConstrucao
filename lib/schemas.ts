import { z } from "zod"

export const clienteSchema = z.object({
  nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  email: z.string().email("Email inválido"),
  telefone: z.string().min(9, "Telefone inválido"),
  morada: z.string().optional(),
  cidade: z.string().optional(),
  codigoPostal: z.string().optional(),
  nif: z.string().optional(),
  observacoes: z.string().optional(),
})

export const funcionarioSchema = z.object({
  nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  email: z.string().email("Email inválido"),
  telefone: z.string().min(9, "Telefone inválido"),
  funcao: z.string().min(2, "Função obrigatória"),
  margemLucro: z.number().min(0).optional(),
  custoHora: z.number().min(0),
  // ... outros campos podem ser adicionados conforme necessário
})

export type ClienteFormData = z.infer<typeof clienteSchema>
export type FuncionarioFormData = z.infer<typeof funcionarioSchema>