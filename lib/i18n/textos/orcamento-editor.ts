import type { Dicionario } from "../tipos"

/** Editor de orçamentos/propostas, fases, numeração e condições gerais da proposta. */
export const textos: Dicionario = {
  // --- Fases do orçamento (lib/orcamento-fases.ts)
  "Rascunho": { "pt-BR": "Rascunho", en: "Draft" },
  "Em elaboração. Medições, preços e custos ainda a ser montados.": {
    "pt-BR": "Em elaboração. Medições, preços e custos ainda sendo montados.",
    en: "Being prepared. Measurements, prices and costs are still being put together.",
  },
  "Em revisão": { "pt-BR": "Em revisão", en: "Under review" },
  "Concluída pelo orçamentista, aguarda validação de margens e viabilidade.": {
    "pt-BR": "Concluída pelo orçamentista, aguardando validação de margens e viabilidade.",
    en: "Completed by the estimator, awaiting approval of margins and feasibility.",
  },
  "Emitido": { "pt-BR": "Emitido", en: "Issued" },
  "Entregue formalmente ao cliente. O documento fica congelado.": {
    "pt-BR": "Entregue formalmente ao cliente. O documento fica congelado.",
    en: "Formally delivered to the client. The document is now locked.",
  },
  "Em negociação": { "pt-BR": "Em negociação", en: "In negotiation" },
  "O cliente está a renegociar valores, prazos ou medições.": {
    "pt-BR": "O cliente está renegociando valores, prazos ou medições.",
    en: "The client is renegotiating prices, deadlines or measurements.",
  },
  "Aceite": { "pt-BR": "Aceito", en: "Accepted" },
  "O cliente adjudicou. Pode passar a obra e seguir para faturação.": {
    "pt-BR": "O cliente aprovou. Pode virar obra e seguir para faturamento.",
    en: "The client has accepted. It can become a job and move on to invoicing.",
  },
  "Cancelado": { "pt-BR": "Cancelado", en: "Cancelled" },
  "O cliente recusou a proposta ou o concurso foi anulado.": {
    "pt-BR": "O cliente recusou a proposta ou a concorrência foi anulada.",
    en: "The client rejected the proposal or the tender was cancelled.",
  },
  "Rev. {letra}": { "pt-BR": "Rev. {letra}", en: "Rev. {letra}" },

  // --- Tipos de documento (lib/numeracao.ts)
  "Concurso": { "pt-BR": "Concorrência", en: "Tender" },
  "Proposta em disputa. Ainda não há trabalho adjudicado.": {
    "pt-BR": "Proposta em disputa. Ainda não há trabalho aprovado.",
    en: "Proposal under competition. No work has been awarded yet.",
  },
  "Obra": { "pt-BR": "Obra", en: "Job" },
  "Trabalho adjudicado. A contabilidade já pode faturar.": {
    "pt-BR": "Trabalho aprovado. A contabilidade já pode faturar.",
    en: "Work awarded. Accounting can now invoice.",
  },

  // --- Cálculos (lib/orcamento-calculos.ts)
  "23% - Taxa normal": { "pt-BR": "23% - Taxa normal", en: "23% - Standard rate" },
  "13% - Taxa intermédia": { "pt-BR": "13% - Taxa intermediária", en: "13% - Intermediate rate" },
  "6% - Taxa reduzida (ex.: obras em habitação)": {
    "pt-BR": "6% - Taxa reduzida (ex.: obras em residências)",
    en: "6% - Reduced rate (e.g. work on homes)",
  },
  "0% - Isento / autoliquidação": { "pt-BR": "0% - Isento / autoliquidação", en: "0% - Exempt / reverse charge" },
  "Sem divisão": { "pt-BR": "Sem cômodo", en: "No room" },
  "Mão de obra": { "pt-BR": "Mão de obra", en: "Labour" },
  "Material": { "pt-BR": "Material", en: "Material" },
  "Serviço": { "pt-BR": "Serviço", en: "Service" },

  // --- Condições gerais da proposta (lib/condicoes-gerais.ts)
  "1.1 Recursos Humanos e Equipas Técnicas": {
    "pt-BR": "1.1 Recursos Humanos e Equipes Técnicas",
    en: "1.1 Human Resources and Technical Teams",
  },
  "A empresa disponibiliza profissionais qualificados, incluindo engenheiros e técnicos especializados, para assegurar a execução do projeto dentro dos prazos e com a máxima eficiência.": {
    "pt-BR": "A empresa disponibiliza profissionais qualificados, incluindo engenheiros e técnicos especializados, para assegurar a execução do projeto dentro dos prazos e com a máxima eficiência.",
    en: "The company provides qualified professionals, including engineers and specialist technicians, to ensure the project is carried out on schedule and with maximum efficiency.",
  },
  "1.2 Materiais e Equipamentos de Construção": {
    "pt-BR": "1.2 Materiais e Equipamentos de Construção",
    en: "1.2 Construction Materials and Equipment",
  },
  "Todos os materiais utilizados são de qualidade e certificados segundo as normas europeias e portuguesas. Utilizamos equipamentos modernos que garantem segurança e eficiência em todas as fases da obra.": {
    "pt-BR": "Todos os materiais utilizados são de qualidade e certificados segundo as normas europeias e portuguesas. Utilizamos equipamentos modernos que garantem segurança e eficiência em todas as fases da obra.",
    en: "All materials used are of high quality and certified in accordance with European and Portuguese standards. We use modern equipment that ensures safety and efficiency at every stage of the works.",
  },
  "1.3 Gestão de Obra": { "pt-BR": "1.3 Gestão de Obra", en: "1.3 Site Management" },
  "Oferecemos uma gestão de obra completa, incluindo o planeamento e a execução das atividades, com acompanhamento contínuo para garantir a qualidade e a conformidade com o projeto.": {
    "pt-BR": "Oferecemos uma gestão de obra completa, incluindo o planejamento e a execução das atividades, com acompanhamento contínuo para garantir a qualidade e a conformidade com o projeto.",
    en: "We provide full site management, including the planning and execution of all activities, with continuous supervision to ensure quality and compliance with the project.",
  },
  "1.4 Segurança e Seguros": { "pt-BR": "1.4 Segurança e Seguros", en: "1.4 Safety and Insurance" },
  "A empresa possui seguros de responsabilidade civil e de acidentes de trabalho, garantindo a proteção de todos os envolvidos no projeto, tanto em obra como fora dela.": {
    "pt-BR": "A empresa possui seguros de responsabilidade civil e de acidentes de trabalho, garantindo a proteção de todos os envolvidos no projeto, tanto na obra como fora dela.",
    en: "The company holds public liability and employers' liability (workplace accident) insurance, ensuring the protection of everyone involved in the project, both on and off site.",
  },
  "1.5 Cumprimento de Prazos": { "pt-BR": "1.5 Cumprimento de Prazos", en: "1.5 Compliance with Deadlines" },
  "Todos os prazos serão estabelecidos de acordo com a complexidade do projeto, sendo negociados atempadamente e rigorosamente cumpridos. Em caso de alterações, o cliente será devidamente informado.": {
    "pt-BR": "Todos os prazos serão estabelecidos de acordo com a complexidade do projeto, sendo negociados com antecedência e rigorosamente cumpridos. Em caso de alterações, o cliente será devidamente informado.",
    en: "All deadlines will be set according to the complexity of the project, agreed in good time and strictly met. Should any changes arise, the client will be duly informed.",
  },
  "2.1 Trabalhos Adicionais Não Contratados": {
    "pt-BR": "2.1 Serviços Adicionais Não Contratados",
    en: "2.1 Additional Work Not Contracted",
  },
  "Os serviços que não estejam previstos no âmbito inicial do contrato, ou que sejam acrescentados ao longo do processo, serão orçamentados à parte e só serão executados após aprovação expressa do cliente.": {
    "pt-BR": "Os serviços que não estejam previstos no escopo inicial do contrato, ou que sejam acrescentados ao longo do processo, serão orçados à parte e só serão executados após aprovação expressa do cliente.",
    en: "Any services not provided for in the original scope of the contract, or added during the course of the works, will be quoted separately and carried out only with the client's express approval.",
  },
  "2.2 Equipamentos Especiais": { "pt-BR": "2.2 Equipamentos Especiais", en: "2.2 Special Equipment" },
  "O fornecimento de equipamentos especiais, como gruas ou plataformas elevatórias, não está incluído, exceto se previsto no orçamento.": {
    "pt-BR": "O fornecimento de equipamentos especiais, como guindastes ou plataformas elevatórias, não está incluído, exceto se previsto no orçamento.",
    en: "The supply of special equipment, such as cranes or aerial work platforms, is not included unless provided for in the quote.",
  },
  "2.3 Alterações ao Projeto": { "pt-BR": "2.3 Alterações no Projeto", en: "2.3 Changes to the Project" },
  "Qualquer alteração ao projeto original, seja por solicitação do cliente ou por necessidade identificada no decorrer da obra, será submetida a uma nova avaliação técnica e financeira, com impacto no prazo e no orçamento.": {
    "pt-BR": "Qualquer alteração no projeto original, seja por solicitação do cliente ou por necessidade identificada no decorrer da obra, será submetida a uma nova avaliação técnica e financeira, com impacto no prazo e no orçamento.",
    en: "Any change to the original project, whether requested by the client or found to be necessary during the works, will be subject to a new technical and financial assessment, with an impact on the schedule and the quote.",
  },
  "3.1 Garantia de Execução": { "pt-BR": "3.1 Garantia de Execução", en: "3.1 Workmanship Warranty" },
  "A empresa garante que os trabalhos serão executados com qualidade, segundo as normas de construção em vigor. Os trabalhos realizados têm uma garantia de 5 anos contra defeitos de execução; os defeitos dos materiais utilizados ficam abrangidos pela garantia do fabricante.": {
    "pt-BR": "A empresa garante que os serviços serão executados com qualidade, segundo as normas de construção vigentes. Os serviços realizados têm garantia de 5 anos contra defeitos de execução; os defeitos dos materiais utilizados ficam cobertos pela garantia do fabricante.",
    en: "The company warrants that the work will be carried out to a high standard, in accordance with the construction regulations in force. The work performed is covered by a 5-year warranty against workmanship defects; defects in the materials used are covered by the manufacturer's warranty.",
  },
  "3.2 Garantia de Materiais": { "pt-BR": "3.2 Garantia de Materiais", en: "3.2 Materials Warranty" },
  "Os materiais aplicados na obra terão a garantia prestada pelos fabricantes e serão substituídos em caso de defeito, nas condições estabelecidas pelos fornecedores.": {
    "pt-BR": "Os materiais aplicados na obra terão a garantia oferecida pelos fabricantes e serão substituídos em caso de defeito, nas condições estabelecidas pelos fornecedores.",
    en: "The materials used in the works carry the manufacturers' warranty and will be replaced if defective, under the conditions set by the suppliers.",
  },
  "4.1 Modalidades de Pagamento": { "pt-BR": "4.1 Formas de Pagamento", en: "4.1 Payment Terms" },
  "As condições de pagamento serão estabelecidas em contrato, podendo optar-se por pagamentos faseados, de acordo com o progresso da obra. Qualquer alteração ao plano de pagamentos será previamente acordada com o cliente.": {
    "pt-BR": "As condições de pagamento serão estabelecidas em contrato, podendo-se optar por pagamentos parcelados, de acordo com o andamento da obra. Qualquer alteração no cronograma de pagamentos será previamente acordada com o cliente.",
    en: "Payment terms will be set out in the contract and may include staged payments in line with the progress of the works. Any change to the payment schedule will be agreed with the client in advance.",
  },
  "4.2 Imposto sobre o Valor Acrescentado (IVA)": {
    "pt-BR": "4.2 Imposto sobre o Valor Acrescentado (IVA)",
    en: "4.2 Value Added Tax (VAT)",
  },
  "Aos valores apresentados nas propostas acresce o Imposto sobre o Valor Acrescentado (IVA), à taxa legal em vigor.": {
    "pt-BR": "Aos valores apresentados nas propostas acresce o Imposto sobre o Valor Acrescentado (IVA), à alíquota legal vigente.",
    en: "The prices stated in the proposals are subject to Value Added Tax (VAT) at the applicable statutory rate.",
  },
  "5.1 Prazo de Validade": { "pt-BR": "5.1 Prazo de Validade", en: "5.1 Validity Period" },
  "A proposta é válida por 30 dias a contar da data de emissão, salvo prazo diferente acordado entre as partes. A proposta só é válida na sua globalidade, reservando-se a empresa o direito de rever os valores em caso de adjudicação parcial.": {
    "pt-BR": "A proposta é válida por 30 dias a contar da data de emissão, salvo prazo diferente acordado entre as partes. A proposta só é válida em sua totalidade, reservando-se a empresa o direito de rever os valores em caso de aprovação parcial.",
    en: "This proposal is valid for 30 days from the date of issue, unless otherwise agreed between the parties. The proposal is valid only in its entirety, and the company reserves the right to revise the prices if it is only partially accepted.",
  },
  "6.1 Resolução de Litígios": { "pt-BR": "6.1 Resolução de Conflitos", en: "6.1 Dispute Resolution" },
  "Qualquer litígio decorrente da execução dos trabalhos será resolvido preferencialmente por via amigável. Não sendo possível, as partes aceitam submeter-se à jurisdição dos tribunais portugueses.": {
    "pt-BR": "Qualquer conflito decorrente da execução dos serviços será resolvido preferencialmente de forma amigável. Não sendo possível, as partes aceitam submeter-se à jurisdição dos tribunais portugueses.",
    en: "Any dispute arising from the performance of the works shall preferably be settled amicably. Failing that, the parties agree to submit to the jurisdiction of the Portuguese courts.",
  },
  "6.2 Conformidade Legal": { "pt-BR": "6.2 Conformidade Legal", en: "6.2 Legal Compliance" },
  "A empresa cumpre rigorosamente as leis e os regulamentos aplicáveis à construção civil em Portugal, incluindo as normas de segurança no trabalho, ambientais e de qualidade.": {
    "pt-BR": "A empresa cumpre rigorosamente as leis e os regulamentos aplicáveis à construção civil em Portugal, incluindo as normas de segurança do trabalho, ambientais e de qualidade.",
    en: "The company strictly complies with the laws and regulations applicable to construction in Portugal, including health and safety, environmental and quality standards.",
  },

  // --- Editor: abas e dados
  "Dados": { "pt-BR": "Dados", en: "Details" },
  "Itens": { "pt-BR": "Itens", en: "Items" },
  "Preço": { "pt-BR": "Preço", en: "Pricing" },
  "Resumo": { "pt-BR": "Resumo", en: "Summary" },
  "Custos reais": { "pt-BR": "Custos reais", en: "Actual costs" },
  "Cliente": { "pt-BR": "Cliente", en: "Client" },
  "Selecionar cliente existente": { "pt-BR": "Selecionar cliente existente", en: "Select an existing client" },
  "Selecione um cliente ou use um novo registo": {
    "pt-BR": "Selecione um cliente ou use um novo cadastro",
    en: "Select a client or create a new one",
  },
  "Novo cliente": { "pt-BR": "Novo cliente", en: "New client" },
  "Nome do cliente": { "pt-BR": "Nome do cliente", en: "Client name" },
  "Telefone": { "pt-BR": "Telefone", en: "Phone" },
  "NIF (opcional)": { "pt-BR": "NIF (opcional)", en: "Tax ID (NIF) (optional)" },
  "Documento": { "pt-BR": "Documento", en: "Document" },
  "Tipo": { "pt-BR": "Tipo", en: "Type" },
  "Número da proposta": { "pt-BR": "Número da proposta", en: "Proposal number" },
  "Sai como {numero}. Deixe vazio para numerar automaticamente.": {
    "pt-BR": "Sai como {numero}. Deixe em branco para numerar automaticamente.",
    en: "Appears as {numero}. Leave blank to number automatically.",
  },
  "Data do orçamento": { "pt-BR": "Data do orçamento", en: "Quote date" },
  "Data de validade": { "pt-BR": "Data de validade", en: "Valid until" },

  // --- Divisões
  "Divisões": { "pt-BR": "Cômodos", en: "Rooms" },
  "Organize o orçamento por divisões da casa. No documento, cada divisão sai como uma secção com o seu subtotal, e os itens ficam numerados 1.1, 1.2, 2.1...": {
    "pt-BR": "Organize o orçamento por cômodo da casa. No documento, cada cômodo sai como uma seção com o seu subtotal, e os itens ficam numerados 1.1, 1.2, 2.1...",
    en: "Organise the quote by room. In the document, each room appears as a section with its own subtotal, and items are numbered 1.1, 1.2, 2.1...",
  },
  "Ex.: Sala, Hall, Cozinha, Quarto 01, Marquise": {
    "pt-BR": "Ex.: Sala, Hall, Cozinha, Quarto 01, Varanda",
    en: "E.g. Living room, Hall, Kitchen, Bedroom 01, Balcony",
  },
  "Adicionar": { "pt-BR": "Adicionar", en: "Add" },
  "Remover {nome}": { "pt-BR": "Remover {nome}", en: "Remove {nome}" },
  "Os próximos itens vão para: {comodo}. Clique na divisão para trocar.": {
    "pt-BR": "Os próximos itens vão para: {comodo}. Clique no cômodo para trocar.",
    en: "The next items go to: {comodo}. Click the room to change.",
  },
  "Nenhuma divisão selecionada: os próximos itens ficam sem divisão. Clique numa divisão para a escolher.": {
    "pt-BR": "Nenhum cômodo selecionado: os próximos itens ficam sem cômodo. Clique em um cômodo para escolhê-lo.",
    en: "No room selected: the next items will have no room. Click a room to select it.",
  },
  "Dimensões de {comodo}": { "pt-BR": "Dimensões de {comodo}", en: "Dimensions of {comodo}" },
  "Comprimento": { "pt-BR": "Comprimento", en: "Length" },
  "Largura": { "pt-BR": "Largura", en: "Width" },
  "Pé-direito": { "pt-BR": "Pé-direito", en: "Ceiling height" },
  "Portas/janelas": { "pt-BR": "Portas/janelas", en: "Doors/windows" },
  "Pavimento/teto {pavimento} m2 · Paredes {paredes} m2 · Perímetro {perimetro} ml. Os itens ligados a uma medição acompanham estas dimensões.": {
    "pt-BR": "Piso/teto {pavimento} m2 · Paredes {paredes} m2 · Perímetro {perimetro} ml. Os itens vinculados a uma medição acompanham estas dimensões.",
    en: "Floor/ceiling {pavimento} m2 · Walls {paredes} m2 · Perimeter {perimetro} m. Items linked to a measurement follow these dimensions.",
  },
  "Divisão duplicada": { "pt-BR": "Cômodo duplicado", en: "Room duplicated" },
  "{n} item copiado para \"{destino}\".": { "pt-BR": "{n} item copiado para \"{destino}\".", en: "{n} item copied to \"{destino}\"." },
  "{n} itens copiados para \"{destino}\".": { "pt-BR": "{n} itens copiados para \"{destino}\".", en: "{n} items copied to \"{destino}\"." },
  "A divisão já existe": { "pt-BR": "Cômodo já existe", en: "Room already exists" },
  "\"{nome}\" já está na lista.": { "pt-BR": "\"{nome}\" já está na lista.", en: "\"{nome}\" is already on the list." },
  "{nome} (cópia)": { "pt-BR": "{nome} (cópia)", en: "{nome} (copy)" },
  "{nome} (cópia {n})": { "pt-BR": "{nome} (cópia {n})", en: "{nome} (copy {n})" },

  // --- Serviço
  "Serviço no orçamento": { "pt-BR": "Serviço no orçamento", en: "Service in the quote" },
  "Selecionar serviço": { "pt-BR": "Selecionar serviço", en: "Select service" },
  "Escolha um serviço": { "pt-BR": "Escolha um serviço", en: "Choose a service" },
  "Procurar serviço...": { "pt-BR": "Procurar serviço...", en: "Search service..." },
  "Nenhum serviço encontrado.": { "pt-BR": "Nenhum serviço encontrado.", en: "No services found." },
  "Unidade (automático)": { "pt-BR": "Unidade (automático)", en: "Unit (automatic)" },
  "Quantidade": { "pt-BR": "Quantidade", en: "Quantity" },
  "{medicao} de {comodo}": { "pt-BR": "{medicao} de {comodo}", en: "{medicao} of {comodo}" },
  "Venda por {unidade} (automático)": { "pt-BR": "Venda por {unidade} (automático)", en: "Sale price per {unidade} (automatic)" },
  "unidade": { "pt-BR": "unidade", en: "unit" },
  "Custo da composição: {custo}/{unidade}": {
    "pt-BR": "Custo da composição: {custo}/{unidade}",
    en: "Breakdown cost: {custo}/{unidade}",
  },
  "mão de obra {maoObra} · materiais {materiais} · outros {outros}": {
    "pt-BR": "mão de obra {maoObra} · materiais {materiais} · outros {outros}",
    en: "labour {maoObra} · materials {materiais} · other {outros}",
  },
  "{n} linha com preço atualizado pelo catálogo": {
    "pt-BR": "{n} linha com preço atualizado pelo catálogo",
    en: "{n} line with price updated from the catalogue",
  },
  "{n} linhas com preço atualizado pelo catálogo": {
    "pt-BR": "{n} linhas com preço atualizado pelo catálogo",
    en: "{n} lines with prices updated from the catalogue",
  },
  "Valor fixo (não multiplica pela área)": {
    "pt-BR": "Valor fixo (não multiplica pela área)",
    en: "Fixed price (not multiplied by area)",
  },
  "Transporte (vai para a linha final)": { "pt-BR": "Transporte (vai para a linha final)", en: "Transport (goes on the final line)" },
  "Total do item": { "pt-BR": "Total do item", en: "Item total" },
  "Adicionar ao orçamento": { "pt-BR": "Adicionar ao orçamento", en: "Add to quote" },
  "Dados incompletos": { "pt-BR": "Dados incompletos", en: "Incomplete details" },
  "Selecione um serviço e indique a quantidade.": {
    "pt-BR": "Selecione um serviço e informe a quantidade.",
    en: "Select a service and enter the quantity.",
  },
  "Serviço já consta nesta divisão": { "pt-BR": "Serviço já consta neste cômodo", en: "Service already in this room" },
  "Este serviço já está em \"{comodo}\". Escolha outra divisão ou ajuste a quantidade do item existente.": {
    "pt-BR": "Este serviço já está em \"{comodo}\". Escolha outro cômodo ou ajuste a quantidade do item existente.",
    en: "This service is already in \"{comodo}\". Choose another room or adjust the quantity of the existing item.",
  },
  "Este serviço já foi adicionado. Escolha uma divisão ou ajuste a quantidade do item existente.": {
    "pt-BR": "Este serviço já foi adicionado. Escolha um cômodo ou ajuste a quantidade do item existente.",
    en: "This service has already been added. Choose a room or adjust the quantity of the existing item.",
  },
  "{nome} - valor fixo": { "pt-BR": "{nome} - valor fixo", en: "{nome} - fixed price" },
  "Itens e equipamentos que não acompanham a área (cobrados uma única vez)": {
    "pt-BR": "Itens e equipamentos que não acompanham a área (cobrados uma única vez)",
    en: "Items and equipment that do not scale with the area (charged once)",
  },

  // --- Produto
  "Produto no orçamento": { "pt-BR": "Produto no orçamento", en: "Product in the quote" },
  "O custo real e o preço de venda vêm do registo de Produtos.": {
    "pt-BR": "O custo real e o preço de venda vêm do cadastro de Produtos.",
    en: "The actual cost and sale price come from the Products register.",
  },
  "Selecionar produto": { "pt-BR": "Selecionar produto", en: "Select product" },
  "Escolha um produto": { "pt-BR": "Escolha um produto", en: "Choose a product" },
  "Procurar produto...": { "pt-BR": "Procurar produto...", en: "Search product..." },
  "Nenhum produto encontrado.": { "pt-BR": "Nenhum produto encontrado.", en: "No products found." },
  "stock {n}": { "pt-BR": "estoque {n}", en: "stock {n}" },
  "Quantidade ({unidade})": { "pt-BR": "Quantidade ({unidade})", en: "Quantity ({unidade})" },
  "Custo (inclui impostos de venda)": { "pt-BR": "Custo (inclui impostos de venda)", en: "Cost (includes sales taxes)" },
  "Venda unitária": { "pt-BR": "Venda unitária", en: "Unit sale price" },
  "Venda unitária (margem por item desligada)": {
    "pt-BR": "Venda unitária (margem por item desligada)",
    en: "Unit sale price (per-item margin off)",
  },
  "Stock atual: {quantidade} {unidade} - abaixo da quantidade orçamentada.": {
    "pt-BR": "Estoque atual: {quantidade} {unidade} - abaixo da quantidade orçada.",
    en: "Current stock: {quantidade} {unidade} - below the quoted quantity.",
  },
  "Total do item (venda)": { "pt-BR": "Total do item (venda)", en: "Item total (sale)" },
  "Escolha o produto e indique a quantidade.": {
    "pt-BR": "Escolha o produto e informe a quantidade.",
    en: "Choose the product and enter the quantity.",
  },

  // --- Mão de obra
  "Mão de obra avulsa (opcional)": { "pt-BR": "Mão de obra avulsa (opcional)", en: "Additional labour (optional)" },
  "A função define o preço ao cliente; o funcionário define o custo. Sem funcionário escolhido, usa-se o custo médio da função. A mão de obra normal já vem incluída no preço dos serviços.": {
    "pt-BR": "A função define o preço ao cliente; o funcionário define o custo. Sem funcionário escolhido, usa-se o custo médio da função. A mão de obra normal já vem incluída no preço dos serviços.",
    en: "The trade sets the client price; the employee sets the cost. If no employee is chosen, the average cost of the trade is used. Standard labour is already included in the service prices.",
  },
  "Função (preço ao cliente)": { "pt-BR": "Função (preço ao cliente)", en: "Trade (client price)" },
  "Escolha a função": { "pt-BR": "Escolha a função", en: "Choose the trade" },
  "Sem funções registadas": { "pt-BR": "Sem funções cadastradas", en: "No trades registered" },
  "Procurar função...": { "pt-BR": "Procurar função...", en: "Search trade..." },
  "Nenhuma função encontrada.": { "pt-BR": "Nenhuma função encontrada.", en: "No trades found." },
  "{preco}/hora": { "pt-BR": "{preco}/hora", en: "{preco}/hour" },
  "Funcionário (custo)": { "pt-BR": "Funcionário (custo)", en: "Employee (cost)" },
  "Escolha um funcionário": { "pt-BR": "Escolha um funcionário", en: "Choose an employee" },
  "Procurar funcionário...": { "pt-BR": "Procurar funcionário...", en: "Search employee..." },
  "Nenhum funcionário encontrado.": { "pt-BR": "Nenhum funcionário encontrado.", en: "No employees found." },
  "Custo médio da função": { "pt-BR": "Custo médio da função", en: "Average cost of the trade" },
  "custo médio da função": { "pt-BR": "custo médio da função", en: "average cost of the trade" },
  "média da função": { "pt-BR": "média da função", en: "trade average" },
  "{funcao} - custo {custo}/hora": { "pt-BR": "{funcao} - custo {custo}/hora", en: "{funcao} - cost {custo}/hour" },
  "Unidade": { "pt-BR": "Unidade", en: "Unit" },
  "Horas": { "pt-BR": "Horas", en: "Hours" },
  "Dias": { "pt-BR": "Dias", en: "Days" },
  "Projeto": { "pt-BR": "Projeto", en: "Project" },
  "Quantidade de horas": { "pt-BR": "Quantidade de horas", en: "Number of hours" },
  "Valor de venda/hora (automático)": { "pt-BR": "Valor de venda/hora (automático)", en: "Sale price/hour (automatic)" },
  "Custo real ({custo}/hora - {quem})": { "pt-BR": "Custo real ({custo}/hora - {quem})", en: "Actual cost ({custo}/hour - {quem})" },
  "O nome do funcionário fica só no uso interno e no PDF de custo. No PDF de venda, o item aparece como \"Mão de obra\" com a função.": {
    "pt-BR": "O nome do funcionário fica apenas no uso interno e no PDF de custo. No PDF de venda, o item aparece como \"Mão de obra\" com a função.",
    en: "The employee's name is only used internally and on the cost PDF. On the sale PDF, the item appears as \"Labour\" with the trade.",
  },
  "Escolha a função (ou um funcionário) e indique a quantidade.": {
    "pt-BR": "Escolha a função (ou um funcionário) e informe a quantidade.",
    en: "Choose the trade (or an employee) and enter the quantity.",
  },
  "Mão de obra sem custo": { "pt-BR": "Mão de obra sem custo", en: "Labour with no cost" },
  "Nenhum funcionário ativo tem esta função: o item entra com custo 0. Escolha um funcionário para ter o custo real.": {
    "pt-BR": "Nenhum funcionário ativo tem esta função: o item entra com custo 0. Escolha um funcionário para ter o custo real.",
    en: "No active employee has this trade: the item is added at zero cost. Choose an employee to get the actual cost.",
  },
  "Mão de obra - {funcao} ({quem})": { "pt-BR": "Mão de obra - {funcao} ({quem})", en: "Labour - {funcao} ({quem})" },

  // --- Lista de itens
  "Ainda sem itens": { "pt-BR": "Ainda sem itens", en: "No items yet" },
  "Escolha um serviço ou produto acima, ou lance horas na mão de obra avulsa.": {
    "pt-BR": "Escolha um serviço ou produto acima, ou lance horas na mão de obra avulsa.",
    en: "Choose a service or product above, or enter hours under additional labour.",
  },
  "Itens do orçamento": { "pt-BR": "Itens do orçamento", en: "Quote items" },
  "Expandir divisão": { "pt-BR": "Expandir cômodo", en: "Expand room" },
  "Recolher divisão": { "pt-BR": "Recolher cômodo", en: "Collapse room" },
  "Clique para mudar o nome da divisão": { "pt-BR": "Clique para renomear o cômodo", en: "Click to rename the room" },
  "{n} item": { "pt-BR": "{n} item", en: "{n} item" },
  "{n} itens": { "pt-BR": "{n} itens", en: "{n} items" },
  "Duplicar \"{nome}\" com todos os itens": { "pt-BR": "Duplicar \"{nome}\" com todos os itens", en: "Duplicate \"{nome}\" with all its items" },
  "Duplicar divisão": { "pt-BR": "Duplicar cômodo", en: "Duplicate room" },
  "Nome do item": { "pt-BR": "Nome do item", en: "Item name" },
  "Descrição do item": { "pt-BR": "Descrição do item", en: "Item description" },
  "Descrição detalhada impressa no orçamento": {
    "pt-BR": "Descrição detalhada impressa no orçamento",
    en: "Detailed description printed on the quote",
  },
  "Valor fixo": { "pt-BR": "Valor fixo", en: "Fixed price" },
  "No PDF do cliente: {texto}": { "pt-BR": "No PDF do cliente: {texto}", en: "On the client PDF: {texto}" },
  "Duplicar este item para outra divisão": { "pt-BR": "Duplicar este item para outro cômodo", en: "Duplicate this item to another room" },
  "Vem das dimensões da divisão": { "pt-BR": "Vem das dimensões do cômodo", en: "Comes from the room dimensions" },
  "Custo unit. (EUR)": { "pt-BR": "Custo unit. (EUR)", en: "Unit cost (EUR)" },
  "Venda unit. (EUR)": { "pt-BR": "Venda unit. (EUR)", en: "Unit price (EUR)" },
  "Custo x (estrutura + margem da especialidade)": {
    "pt-BR": "Custo x (estrutura + margem da especialidade)",
    en: "Cost x (overhead + specialty margin)",
  },
  "Margem por item desligada: vende ao custo": {
    "pt-BR": "Margem por item desligada: vende pelo custo",
    en: "Per-item margin off: sold at cost",
  },
  "Total venda (EUR)": { "pt-BR": "Total venda (EUR)", en: "Sale total (EUR)" },
  "Valor fixo: não multiplica pela quantidade/área": {
    "pt-BR": "Valor fixo: não multiplica pela quantidade/área",
    en: "Fixed price: not multiplied by quantity/area",
  },
  "Especialidade": { "pt-BR": "Especialidade", en: "Specialty" },
  "Medição": { "pt-BR": "Medição", en: "Measurement" },
  "Quantidade manual": { "pt-BR": "Quantidade manual", en: "Manual quantity" },
  "Qtd = {medicao} da divisão": { "pt-BR": "Qtd = {medicao} do cômodo", en: "Qty = room {medicao}" },
  "Custo do item: {custo}": { "pt-BR": "Custo do item: {custo}", en: "Item cost: {custo}" },
  "Margem do item: {sobreCusto}% sobre o custo ({sobreVenda}% da venda)": {
    "pt-BR": "Margem do item: {sobreCusto}% sobre o custo ({sobreVenda}% da venda)",
    en: "Item margin: {sobreCusto}% on cost ({sobreVenda}% of sale)",
  },
  "Selecione um funcionário": { "pt-BR": "Selecione um funcionário", en: "Select an employee" },
  "Escolha o funcionário que vai receber a cópia da mão de obra.": {
    "pt-BR": "Escolha o funcionário que vai receber a cópia da mão de obra.",
    en: "Choose the employee who will receive the copy of the labour item.",
  },
  "Item duplicado": { "pt-BR": "Item duplicado", en: "Item duplicated" },
  "Cópia criada em \"{destino}\".": { "pt-BR": "Cópia criada em \"{destino}\".", en: "Copy created in \"{destino}\"." },
  "Cópia criada sem divisão.": { "pt-BR": "Cópia criada sem cômodo.", en: "Copy created with no room." },

  // --- Preço
  "Definição do preço": { "pt-BR": "Precificação", en: "Pricing" },
  "Por especialidade (folha de obra)": { "pt-BR": "Por especialidade (folha de obra)", en: "By specialty (job sheet)" },
  "Preço = custo x (1 + estrutura + margem da especialidade). Cada item escolhe a especialidade.": {
    "pt-BR": "Preço = custo x (1 + estrutura + margem da especialidade). Cada item escolhe a especialidade.",
    en: "Price = cost x (1 + overhead + specialty margin). Each item chooses its specialty.",
  },
  "Por margens": { "pt-BR": "Por margens", en: "By margins" },
  "Margem por item (preço de venda do registo) e/ou margem global sobre o subtotal.": {
    "pt-BR": "Margem por item (preço de venda do cadastro) e/ou margem global sobre o subtotal.",
    en: "Per-item margin (sale price from the register) and/or global margin on the subtotal.",
  },
  "Estrutura {percentagem}% + margem da especialidade": {
    "pt-BR": "Estrutura {percentagem}% + margem da especialidade",
    en: "Overhead {percentagem}% + specialty margin",
  },
  "Alterar em Configurações > Preços": { "pt-BR": "Alterar em Configurações > Preços", en: "Change in Settings > Prices" },
  "{nome}: +{percentagem}% sobre o custo": { "pt-BR": "{nome}: +{percentagem}% sobre o custo", en: "{nome}: +{percentagem}% on cost" },
  "Margem adicional desta proposta": { "pt-BR": "Margem adicional desta proposta", en: "Additional margin for this proposal" },
  "Soma-se à estrutura e à margem de cada especialidade, só nesta proposta. Positiva, serve de coeficiente de segurança; negativa, de desconto.": {
    "pt-BR": "Soma-se à estrutura e à margem de cada especialidade, apenas nesta proposta. Positiva, serve de coeficiente de segurança; negativa, de desconto.",
    en: "Added to the overhead and each specialty margin, for this proposal only. A positive value works as a safety factor; a negative one as a discount.",
  },
  "Lucro previsto {lucro} = {percentagem} da venda sem IVA": {
    "pt-BR": "Lucro previsto {lucro} = {percentagem} da venda sem IVA",
    en: "Expected profit {lucro} = {percentagem} of the sale excl. VAT",
  },
  "Margem por item": { "pt-BR": "Margem por item", en: "Per-item margin" },
  "Cada produto e mão de obra entra pelo preço de venda do registo (com a respetiva margem).": {
    "pt-BR": "Cada produto e mão de obra entra pelo preço de venda do cadastro (com a respectiva margem).",
    en: "Each product and labour item uses its sale price from the register (with its own margin).",
  },
  "Desligada: cada item entra ao preço de custo. Ao voltar a ligar, os preços de tabela são repostos.": {
    "pt-BR": "Desligada: cada item entra pelo preço de custo. Ao religar, os preços de tabela voltam.",
    en: "Off: each item is added at cost price. When turned back on, list prices are restored.",
  },
  "Margem dos itens: {valor}": { "pt-BR": "Margem dos itens: {valor}", en: "Item margin: {valor}" },
  "Margem global": { "pt-BR": "Margem global", en: "Global margin" },
  "Percentagem somada ao subtotal de todos os itens, por cima da margem de cada item.": {
    "pt-BR": "Porcentagem somada ao subtotal de todos os itens, além da margem de cada item.",
    en: "Percentage added to the subtotal of all items, on top of each item's margin.",
  },
  "Custos indiretos da obra": { "pt-BR": "Custos indiretos da obra", en: "Indirect job costs" },
  "Entram no custo e vendem-se com a mesma regra dos itens (estrutura + construção civil).": {
    "pt-BR": "Entram no custo e são vendidos com a mesma regra dos itens (estrutura + construção civil).",
    en: "Included in the cost and sold under the same rule as the items (overhead + civil construction).",
  },
  "Entram no custo e vendem-se com a mesma regra dos itens (margem global).": {
    "pt-BR": "Entram no custo e são vendidos com a mesma regra dos itens (margem global).",
    en: "Included in the cost and sold under the same rule as the items (global margin).",
  },
  "Estaleiro": { "pt-BR": "Canteiro de obras", en: "Site setup" },
  "Seguros": { "pt-BR": "Seguros", en: "Insurance" },
  "Licenciamento": { "pt-BR": "Licenciamento", en: "Permits" },
  "Contexto fiscal": { "pt-BR": "Contexto fiscal", en: "Tax context" },
  "Região": { "pt-BR": "Região", en: "Region" },
  "Tipo de obra": { "pt-BR": "Tipo de obra", en: "Job type" },
  "Tipo de cliente": { "pt-BR": "Tipo de cliente", en: "Client type" },
  "Operação": { "pt-BR": "Operação", en: "Operation" },
  "Não especificado": { "pt-BR": "Não especificado", en: "Not specified" },
  "Sugerido: {regime} - {taxa}%": { "pt-BR": "Sugerido: {regime} - {taxa}%", en: "Suggested: {regime} - {taxa}%" },
  "Aplicado": { "pt-BR": "Aplicado", en: "Applied" },
  "Aplicar": { "pt-BR": "Aplicar", en: "Apply" },
  "Custo de transporte (EUR)": { "pt-BR": "Custo de transporte (EUR)", en: "Transport cost (EUR)" },
  "Somado automaticamente a partir dos serviços e lançado como linha própria no final do orçamento.": {
    "pt-BR": "Somado automaticamente a partir dos serviços e lançado como linha própria no final do orçamento.",
    en: "Added up automatically from the services and shown as a separate line at the end of the quote.",
  },
  "IVA (%)": { "pt-BR": "IVA (%)", en: "VAT (%)" },
  "Selecione a taxa": { "pt-BR": "Selecione a taxa", en: "Select the rate" },
  "Outra taxa (indicar ao lado)": { "pt-BR": "Outra taxa (informar ao lado)", en: "Other rate (enter alongside)" },
  "Taxa aplicada (%)": { "pt-BR": "Taxa aplicada (%)", en: "Applied rate (%)" },
  "Incide sobre subtotal + margem + transporte. Não entra no lucro: é cobrado ao cliente e entregue ao Estado.": {
    "pt-BR": "Incide sobre subtotal + margem + transporte. Não entra no lucro: é cobrado do cliente e repassado ao Estado.",
    en: "Applied to subtotal + margin + transport. It is not part of the profit: it is charged to the client and paid to the State.",
  },
  "Observações (opcional)": { "pt-BR": "Observações (opcional)", en: "Notes (optional)" },
  "Observações adicionais sobre o orçamento...": {
    "pt-BR": "Observações adicionais sobre o orçamento...",
    en: "Additional notes about the quote...",
  },
  "Discriminar material e mão de obra no PDF": {
    "pt-BR": "Discriminar material e mão de obra no PDF",
    en: "Itemise materials and labour in the PDF",
  },
  "Por baixo de cada item aparece quanto é material e quanto é mão de obra, segundo a composição. Útil quando o cliente pede o valor repartido.": {
    "pt-BR": "Abaixo de cada item aparece quanto é material e quanto é mão de obra, segundo a composição. Útil quando o cliente pede o valor discriminado.",
    en: "Below each item, the split between materials and labour is shown, based on the breakdown. Useful when the client asks for the amount split out.",
  },
  "Preços atualizados": { "pt-BR": "Preços atualizados", en: "Prices updated" },
  "{n} item passou para as margens atuais de Configurações > Preços. Guarde a proposta para manter a alteração.": {
    "pt-BR": "{n} item passou para as margens atuais de Configurações > Preços. Salve a proposta para manter a alteração.",
    en: "{n} item now uses the current margins in Settings > Prices. Save the proposal to keep the change.",
  },
  "{n} itens passaram para as margens atuais de Configurações > Preços. Guarde a proposta para manter a alteração.": {
    "pt-BR": "{n} itens passaram para as margens atuais de Configurações > Preços. Salve a proposta para manter a alteração.",
    en: "{n} items now use the current margins in Settings > Prices. Save the proposal to keep the change.",
  },

  // --- Resumo
  "Sem itens, sem resumo": { "pt-BR": "Sem itens, sem resumo", en: "No items, no summary" },
  "Adicione itens no separador Itens para ver os totais.": {
    "pt-BR": "Adicione itens na aba Itens para ver os totais.",
    en: "Add items on the Items tab to see the totals.",
  },
  "Orçamento de venda (cliente)": { "pt-BR": "Orçamento de venda (cliente)", en: "Sales quote (client)" },
  "Subtotal:": { "pt-BR": "Subtotal:", en: "Subtotal:" },
  "Custos indiretos (estaleiro, seguros...):": {
    "pt-BR": "Custos indiretos (canteiro, seguros...):",
    en: "Indirect costs (site setup, insurance...):",
  },
  "Margem global ({percentagem}%):": { "pt-BR": "Margem global ({percentagem}%):", en: "Global margin ({percentagem}%):" },
  "Transporte:": { "pt-BR": "Transporte:", en: "Transport:" },
  "Base tributável:": { "pt-BR": "Base tributável:", en: "Taxable base:" },
  "IVA ({percentagem}%):": { "pt-BR": "IVA ({percentagem}%):", en: "VAT ({percentagem}%):" },
  "Total com IVA:": { "pt-BR": "Total com IVA:", en: "Total incl. VAT:" },
  "Orçamento de custo (interno)": { "pt-BR": "Orçamento de custo (interno)", en: "Cost quote (internal)" },
  "Custo dos itens:": { "pt-BR": "Custo dos itens:", en: "Item cost:" },
  "Custos indiretos:": { "pt-BR": "Custos indiretos:", en: "Indirect costs:" },
  "Total de custo:": { "pt-BR": "Total de custo:", en: "Total cost:" },
  "Estrutura + margens das especialidades:": {
    "pt-BR": "Estrutura + margens das especialidades:",
    en: "Overhead + specialty margins:",
  },
  "Margem dos itens:": { "pt-BR": "Margem dos itens:", en: "Item margin:" },
  "Margem dos itens (desligada):": { "pt-BR": "Margem dos itens (desligada):", en: "Item margin (off):" },
  "Margem global:": { "pt-BR": "Margem global:", en: "Global margin:" },
  "Margem global (desligada):": { "pt-BR": "Margem global (desligada):", en: "Global margin (off):" },
  "Lucro previsto:": { "pt-BR": "Lucro previsto:", en: "Expected profit:" },
  "{lucro} ({percentagem}% da venda)": { "pt-BR": "{lucro} ({percentagem}% da venda)", en: "{lucro} ({percentagem}% of sale)" },
  "Lucro = base tributável ({base}) - custo, sem o IVA.": {
    "pt-BR": "Lucro = base tributável ({base}) - custo, sem o IVA.",
    en: "Profit = taxable base ({base}) - cost, excluding VAT.",
  },

  // --- Custos reais
  "O que a obra gastou de facto. Escreva o valor da fatura (com IVA) e escolha a taxa: o custo sem IVA e o IVA suportado são calculados. A análise compara com a margem desta proposta, já com o que estiver em edição nos outros separadores.": {
    "pt-BR": "O que a obra realmente gastou. Digite o valor da nota fiscal (com IVA) e escolha a taxa: o custo sem IVA e o IVA suportado são calculados. A análise compara com a margem desta proposta, já com o que estiver em edição nas outras abas.",
    en: "What the job actually spent. Enter the invoice amount (incl. VAT) and choose the rate: the cost excl. VAT and the VAT paid are calculated. The analysis compares it with this proposal's margin, including any changes being made in the other tabs.",
  },
  "O seu cargo permite ver os custos, mas não lançá-los. Peça a permissão \"Lançar custos reais da obra\" a quem gere os utilizadores.": {
    "pt-BR": "O seu cargo permite ver os custos, mas não lançá-los. Peça a permissão \"Lançar custos reais da obra\" a quem gerencia os usuários.",
    en: "Your role can view costs but not enter them. Ask whoever manages users for the \"Enter actual job costs\" permission.",
  },

  // --- Validação e gravação
  "Falta preencher": { "pt-BR": "Falta preencher", en: "Missing information" },
  "Indique o nome do cliente.": { "pt-BR": "Informe o nome do cliente.", en: "Enter the client's name." },
  "Indique o telefone.": { "pt-BR": "Informe o telefone.", en: "Enter the phone number." },
  "Indique a morada.": { "pt-BR": "Informe o endereço.", en: "Enter the address." },
  "Indique a cidade.": { "pt-BR": "Informe a cidade.", en: "Enter the city." },
  "Indique o código postal.": { "pt-BR": "Informe o código postal.", en: "Enter the postcode." },
  "Indique as datas da proposta.": { "pt-BR": "Informe as datas da proposta.", en: "Enter the proposal dates." },
  "Adicione itens": { "pt-BR": "Adicione itens", en: "Add items" },
  "Inclua pelo menos um serviço, produto ou mão de obra no orçamento.": {
    "pt-BR": "Inclua pelo menos um serviço, produto ou mão de obra no orçamento.",
    en: "Include at least one service, product or labour item in the quote.",
  },
  "Volte a iniciar sessão para guardar as alterações.": {
    "pt-BR": "Entre novamente para salvar as alterações.",
    en: "Sign in again to save your changes.",
  },
  "Utilizador não autenticado": { "pt-BR": "Usuário não autenticado", en: "User not authenticated" },
  "Orçamento atualizado": { "pt-BR": "Orçamento atualizado", en: "Quote updated" },
  "O orçamento foi atualizado com sucesso.": { "pt-BR": "O orçamento foi atualizado com sucesso.", en: "The quote was updated successfully." },
  "Orçamento criado": { "pt-BR": "Orçamento criado", en: "Quote created" },
  "O orçamento foi criado com sucesso.": { "pt-BR": "O orçamento foi criado com sucesso.", en: "The quote was created successfully." },
  "Erro ao guardar o orçamento": { "pt-BR": "Erro ao salvar o orçamento", en: "Error saving the quote" },
  "Não foi possível guardar o orçamento.": { "pt-BR": "Não foi possível salvar o orçamento.", en: "The quote could not be saved." },
  "Guardar alterações": { "pt-BR": "Salvar alterações", en: "Save changes" },
  "Criar orçamento": { "pt-BR": "Criar orçamento", en: "Create quote" },

  // --- Diálogo de duplicar item
  "Duplicar item": { "pt-BR": "Duplicar item", en: "Duplicate item" },
  "Copia \"{nome}\" ({quantidade} {unidade}) para outra divisão. Útil quando o Quarto 02 leva os mesmos trabalhos do Quarto 01.": {
    "pt-BR": "Copia \"{nome}\" ({quantidade} {unidade}) para outro cômodo. Útil quando o Quarto 02 leva os mesmos serviços do Quarto 01.",
    en: "Copies \"{nome}\" ({quantidade} {unidade}) to another room. Useful when Bedroom 02 needs the same work as Bedroom 01.",
  },
  "Divisão de destino": { "pt-BR": "Cômodo de destino", en: "Destination room" },
  "Escolha a divisão": { "pt-BR": "Escolha o cômodo", en: "Choose the room" },
  "Funcionário da cópia": { "pt-BR": "Funcionário da cópia", en: "Employee for the copy" },
  "Duplicar": { "pt-BR": "Duplicar", en: "Duplicate" },
}
