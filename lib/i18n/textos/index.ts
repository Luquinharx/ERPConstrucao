import type { Dicionario } from "../tipos"
import { textos as comum } from "./comum"
import { textos as acesso } from "./acesso"
import { textos as funcionarios } from "./funcionarios"
import { textos as orcamentoEditor } from "./orcamento-editor"
import { textos as orcamentos } from "./orcamentos"
import { textos as obra } from "./obra"
import { textos as materiais } from "./materiais"
import { textos as catalogo } from "./catalogo"
import { textos as ponto } from "./ponto"
import { textos as configuracoes } from "./configuracoes"

/** Todos os textos juntos. Uma chave repetida em dois ficheiros tem de ter a mesma tradução (o verificador confirma). */
export const TEXTOS: Dicionario = {
  ...comum,
  ...acesso,
  ...funcionarios,
  ...orcamentoEditor,
  ...orcamentos,
  ...obra,
  ...materiais,
  ...catalogo,
  ...ponto,
  ...configuracoes,
}

export const FICHEIROS_DE_TEXTOS = {
  "comum": comum,
  "acesso": acesso,
  "funcionarios": funcionarios,
  "orcamento-editor": orcamentoEditor,
  "orcamentos": orcamentos,
  "obra": obra,
  "materiais": materiais,
  "catalogo": catalogo,
  "ponto": ponto,
  "configuracoes": configuracoes,
}
