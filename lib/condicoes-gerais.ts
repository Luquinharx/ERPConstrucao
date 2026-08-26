/**
 * Condicoes Gerais.
 *
 * Transcritas do documento oficial da empresa (Condicoes Gerais-TKH.pdf) para
 * poderem ser carregadas de uma vez no ecra de Termos e editadas a partir dai.
 *
 * Ficam como dados iniciais, nao como texto fixo: depois de carregadas, cada
 * ponto e um registo normal que se pode alterar, desativar ou apagar.
 */
export interface CondicaoGeralModelo {
  titulo: string
  conteudo: string
  tipo: "termos" | "regras" | "condicoes"
}

export const CONDICOES_GERAIS_MODELO: CondicaoGeralModelo[] = [
  // 1. Inclusoes
  {
    tipo: "termos",
    titulo: "1.1 Recursos Humanos e Equipas Tecnicas",
    conteudo:
      "A empresa disponibiliza profissionais qualificados, incluindo engenheiros e tecnicos especializados, para assegurar a execucao do projeto dentro dos prazos e com a maxima eficiencia.",
  },
  {
    tipo: "termos",
    titulo: "1.2 Materiais e Equipamentos de Construcao",
    conteudo:
      "Todos os materiais utilizados sao de qualidade e certificados segundo as normas europeias e portuguesas. Utilizamos equipamentos modernos que garantem seguranca e eficiencia em todas as fases da obra.",
  },
  {
    tipo: "termos",
    titulo: "1.3 Gestao de Obra",
    conteudo:
      "Oferecemos uma gestao de obra completa, incluindo o planeamento e a execucao das atividades, com acompanhamento continuo para garantir a qualidade e a conformidade com o projeto.",
  },
  {
    tipo: "termos",
    titulo: "1.4 Seguranca e Seguros",
    conteudo:
      "A empresa possui seguros de responsabilidade civil e acidentes de trabalho, garantindo a protecao de todos os envolvidos no projeto, tanto em obra como fora dela.",
  },
  {
    tipo: "termos",
    titulo: "1.5 Cumprimento de Prazos",
    conteudo:
      "Todos os prazos serao estabelecidos de acordo com a complexidade do projeto, sendo negociados atempadamente e rigorosamente cumpridos. Em caso de alteracoes, o cliente sera devidamente informado.",
  },

  // 2. Exclusoes
  {
    tipo: "regras",
    titulo: "2.1 Trabalhos Adicionais Nao Contratados",
    conteudo:
      "Servicos que nao estejam previstos no escopo inicial do contrato, ou que sejam adicionados ao longo do processo, serao orcados a parte e so serao executados apos aprovacao expressa do cliente.",
  },
  {
    tipo: "regras",
    titulo: "2.2 Equipamentos Especiais",
    conteudo:
      "O fornecimento de equipamentos especiais, como gruas ou plataformas de elevacao, nao esta incluido, exceto se previsto no orcamento.",
  },
  {
    tipo: "regras",
    titulo: "2.3 Alteracoes no Projeto",
    conteudo:
      "Qualquer alteracao ao projeto original, seja por solicitacao do cliente ou por necessidade identificada no decorrer da obra, sera submetida a uma nova avaliacao tecnica e financeira, com impacto no prazo e no orcamento.",
  },

  // 3. Garantias
  {
    tipo: "condicoes",
    titulo: "3.1 Garantia de Execucao",
    conteudo:
      "A empresa garante que os trabalhos serao executados com qualidade, segundo as normas de construcao vigentes. Os trabalhos realizados serao garantidos por 5 anos contra defeitos de execucao, e de garantia pelo fabricante mediante aos trabalhos identificados como deficientes dos materiais utilizados.",
  },
  {
    tipo: "condicoes",
    titulo: "3.2 Garantia de Materiais",
    conteudo:
      "Os materiais aplicados na obra terao a garantia fornecida pelos fabricantes e serao substituidos em caso de defeito, respeitando as condicoes estabelecidas pelos fornecedores.",
  },

  // 4. Condicoes de pagamento
  {
    tipo: "condicoes",
    titulo: "4.1 Modalidades de Pagamento",
    conteudo:
      "As condicoes de pagamento serao estabelecidas em contrato, permitindo a opcao de pagamentos faseados, em conformidade com o progresso das obras. Qualquer alteracao no cronograma de pagamento sera previamente discutida com o cliente.",
  },
  {
    tipo: "condicoes",
    titulo: "4.2 Imposto Sobre o Valor Acrescentado (IVA)",
    conteudo:
      "Os valores apresentados nas propostas estao sujeitos ao Imposto sobre o Valor Acrescentado (IVA), aplicado a taxa legal em vigor.",
  },

  // 5. Validade da proposta
  {
    tipo: "condicoes",
    titulo: "5.1 Prazo de Validade",
    conteudo:
      "A proposta tera uma validade de 30 dias a partir da data de emissao, salvo especificacoes diferentes acordadas entre as partes. A proposta so e valida na sua globalidade, reservando a empresa o direito de rever os valores em caso de adjudicacao parcial.",
  },

  // 6. Disposicoes finais
  {
    tipo: "condicoes",
    titulo: "6.1 Resolucao de Conflitos",
    conteudo:
      "Qualquer disputa decorrente da execucao dos trabalhos sera resolvida preferencialmente por via amigavel. Caso nao seja possivel, as partes aceitam submeter-se a jurisdicao dos tribunais portugueses.",
  },
  {
    tipo: "condicoes",
    titulo: "6.2 Conformidade Legal",
    conteudo:
      "A empresa cumpre rigorosamente as leis e regulamentos aplicaveis a construcao civil em Portugal, incluindo normas de seguranca no trabalho, ambientais e de qualidade.",
  },
]
