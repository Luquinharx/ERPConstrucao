import { m, t } from "./i18n"

/**
 * Condicoes Gerais.
 *
 * Transcritas do documento oficial da empresa (Condicoes Gerais-TKH.pdf) para
 * poderem ser carregadas de uma vez no ecra de Termos e editadas a partir dai.
 *
 * Ficam como dados iniciais, nao como texto fixo: depois de carregadas, cada
 * ponto e um registo normal que se pode alterar, desativar ou apagar.
 *
 * O titulo e o conteudo sao lidos no idioma escolhido no momento em que se
 * acede a eles (getters), por isso as condicoes ficam gravadas no idioma de
 * quem as carregou.
 */
export interface CondicaoGeralModelo {
  titulo: string
  conteudo: string
  tipo: "termos" | "regras" | "condicoes"
}

function modelo(tipo: CondicaoGeralModelo["tipo"], titulo: string, conteudo: string): CondicaoGeralModelo {
  return {
    tipo,
    get titulo() {
      return t(titulo)
    },
    get conteudo() {
      return t(conteudo)
    },
  }
}

export const CONDICOES_GERAIS_MODELO: CondicaoGeralModelo[] = [
  // 1. Inclusoes
  modelo(
    "termos",
    m("1.1 Recursos Humanos e Equipas Técnicas"),
    m("A empresa disponibiliza profissionais qualificados, incluindo engenheiros e técnicos especializados, para assegurar a execução do projeto dentro dos prazos e com a máxima eficiência."),
  ),
  modelo(
    "termos",
    m("1.2 Materiais e Equipamentos de Construção"),
    m("Todos os materiais utilizados são de qualidade e certificados segundo as normas europeias e portuguesas. Utilizamos equipamentos modernos que garantem segurança e eficiência em todas as fases da obra."),
  ),
  modelo(
    "termos",
    m("1.3 Gestão de Obra"),
    m("Oferecemos uma gestão de obra completa, incluindo o planeamento e a execução das atividades, com acompanhamento contínuo para garantir a qualidade e a conformidade com o projeto."),
  ),
  modelo(
    "termos",
    m("1.4 Segurança e Seguros"),
    m("A empresa possui seguros de responsabilidade civil e de acidentes de trabalho, garantindo a proteção de todos os envolvidos no projeto, tanto em obra como fora dela."),
  ),
  modelo(
    "termos",
    m("1.5 Cumprimento de Prazos"),
    m("Todos os prazos serão estabelecidos de acordo com a complexidade do projeto, sendo negociados atempadamente e rigorosamente cumpridos. Em caso de alterações, o cliente será devidamente informado."),
  ),

  // 2. Exclusoes
  modelo(
    "regras",
    m("2.1 Trabalhos Adicionais Não Contratados"),
    m("Os serviços que não estejam previstos no âmbito inicial do contrato, ou que sejam acrescentados ao longo do processo, serão orçamentados à parte e só serão executados após aprovação expressa do cliente."),
  ),
  modelo(
    "regras",
    m("2.2 Equipamentos Especiais"),
    m("O fornecimento de equipamentos especiais, como gruas ou plataformas elevatórias, não está incluído, exceto se previsto no orçamento."),
  ),
  modelo(
    "regras",
    m("2.3 Alterações ao Projeto"),
    m("Qualquer alteração ao projeto original, seja por solicitação do cliente ou por necessidade identificada no decorrer da obra, será submetida a uma nova avaliação técnica e financeira, com impacto no prazo e no orçamento."),
  ),

  // 3. Garantias
  modelo(
    "condicoes",
    m("3.1 Garantia de Execução"),
    m("A empresa garante que os trabalhos serão executados com qualidade, segundo as normas de construção em vigor. Os trabalhos realizados têm uma garantia de 5 anos contra defeitos de execução; os defeitos dos materiais utilizados ficam abrangidos pela garantia do fabricante."),
  ),
  modelo(
    "condicoes",
    m("3.2 Garantia de Materiais"),
    m("Os materiais aplicados na obra terão a garantia prestada pelos fabricantes e serão substituídos em caso de defeito, nas condições estabelecidas pelos fornecedores."),
  ),

  // 4. Condicoes de pagamento
  modelo(
    "condicoes",
    m("4.1 Modalidades de Pagamento"),
    m("As condições de pagamento serão estabelecidas em contrato, podendo optar-se por pagamentos faseados, de acordo com o progresso da obra. Qualquer alteração ao plano de pagamentos será previamente acordada com o cliente."),
  ),
  modelo(
    "condicoes",
    m("4.2 Imposto sobre o Valor Acrescentado (IVA)"),
    m("Aos valores apresentados nas propostas acresce o Imposto sobre o Valor Acrescentado (IVA), à taxa legal em vigor."),
  ),

  // 5. Validade da proposta
  modelo(
    "condicoes",
    m("5.1 Prazo de Validade"),
    m("A proposta é válida por 30 dias a contar da data de emissão, salvo prazo diferente acordado entre as partes. A proposta só é válida na sua globalidade, reservando-se a empresa o direito de rever os valores em caso de adjudicação parcial."),
  ),

  // 6. Disposicoes finais
  modelo(
    "condicoes",
    m("6.1 Resolução de Litígios"),
    m("Qualquer litígio decorrente da execução dos trabalhos será resolvido preferencialmente por via amigável. Não sendo possível, as partes aceitam submeter-se à jurisdição dos tribunais portugueses."),
  ),
  modelo(
    "condicoes",
    m("6.2 Conformidade Legal"),
    m("A empresa cumpre rigorosamente as leis e os regulamentos aplicáveis à construção civil em Portugal, incluindo as normas de segurança no trabalho, ambientais e de qualidade."),
  ),
]
