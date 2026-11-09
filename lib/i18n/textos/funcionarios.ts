import type { Dicionario } from "../tipos"

/** Funcionários, funções de mão de obra, cálculo de custo/hora e IRS. */
export const textos: Dicionario = {
  // ---- Palavras comuns (iguais ao glossário)
  "Cancelar": { "pt-BR": "Cancelar", en: "Cancel" },
  "Guardar": { "pt-BR": "Salvar", en: "Save" },
  "A guardar...": { "pt-BR": "Salvando...", en: "Saving..." },
  "Atualizar": { "pt-BR": "Atualizar", en: "Update" },
  "Registar": { "pt-BR": "Cadastrar", en: "Add" },
  "Criar": { "pt-BR": "Criar", en: "Create" },
  "Nome": { "pt-BR": "Nome", en: "Name" },
  "Observações": { "pt-BR": "Observações", en: "Notes" },
  "Estado": { "pt-BR": "Status", en: "Status" },
  "Ativo": { "pt-BR": "Ativo", en: "Active" },
  "Inativo": { "pt-BR": "Inativo", en: "Inactive" },
  "Inativa": { "pt-BR": "Inativa", en: "Inactive" },
  "Margem": { "pt-BR": "Margem", en: "Margin" },
  "Empresa": { "pt-BR": "Empresa", en: "Company" },
  "Automático": { "pt-BR": "Automático", en: "Automatic" },
  "Manual": { "pt-BR": "Manual", en: "Manual" },
  "Limpar pesquisa": { "pt-BR": "Limpar pesquisa", en: "Clear search" },
  "Morada": { "pt-BR": "Endereço", en: "Address" },
  "Cidade": { "pt-BR": "Cidade", en: "City" },
  "Código postal": { "pt-BR": "Código postal", en: "Postcode" },
  "NIF": { "pt-BR": "NIF", en: "Tax ID (NIF)" },
  "XXXX-XXX": { "pt-BR": "XXXX-XXX", en: "XXXX-XXX" },
  "Email *": { "pt-BR": "E-mail *", en: "Email *" },
  "email@exemplo.com": { "pt-BR": "email@exemplo.com", en: "email@example.com" },
  "Telefone *": { "pt-BR": "Telefone *", en: "Phone *" },
  "+351 xxx xxx xxx": { "pt-BR": "+351 xxx xxx xxx", en: "+351 xxx xxx xxx" },
  "{n} dia": { "pt-BR": "{n} dia", en: "{n} day" },
  "{n} dias": { "pt-BR": "{n} dias", en: "{n} days" },
  "{n} ano": { "pt-BR": "{n} ano", en: "{n} year old" },
  "{n} anos": { "pt-BR": "{n} anos", en: "{n} years old" },

  // ---- Funcionários: lista e mensagens
  "Funcionários": { "pt-BR": "Funcionários", en: "Employees" },
  "Gerir a equipa, os encargos e o custo real da mão de obra": {
    "pt-BR": "Gerencie a equipe, os encargos e o custo real da mão de obra",
    en: "Manage the team, employer costs and the real cost of labour",
  },
  "Novo funcionário": { "pt-BR": "Novo funcionário", en: "New employee" },
  "Editar funcionário": { "pt-BR": "Editar funcionário", en: "Edit employee" },
  "Atualize os dados do funcionário.": { "pt-BR": "Atualize os dados do funcionário.", en: "Update the employee details." },
  "Adicione um novo funcionário à equipa.": {
    "pt-BR": "Adicione um novo funcionário à equipe.",
    en: "Add a new employee to the team.",
  },
  "Erro ao carregar funcionários": { "pt-BR": "Erro ao carregar funcionários", en: "Error loading employees" },
  "Não foi possível carregar a lista de funcionários.": {
    "pt-BR": "Não foi possível carregar a lista de funcionários.",
    en: "Could not load the employee list.",
  },
  "Funcionário atualizado": { "pt-BR": "Funcionário atualizado", en: "Employee updated" },
  "Os dados do funcionário foram atualizados com sucesso.": {
    "pt-BR": "Os dados do funcionário foram atualizados com sucesso.",
    en: "The employee details were updated successfully.",
  },
  "Funcionário registado": { "pt-BR": "Funcionário cadastrado", en: "Employee added" },
  "O funcionário foi registado com sucesso.": {
    "pt-BR": "O funcionário foi cadastrado com sucesso.",
    en: "The employee was added successfully.",
  },
  "Erro ao guardar funcionário": { "pt-BR": "Erro ao salvar funcionário", en: "Error saving employee" },
  "Não foi possível guardar os dados do funcionário.": {
    "pt-BR": "Não foi possível salvar os dados do funcionário.",
    en: "Could not save the employee details.",
  },
  "Tem a certeza de que pretende eliminar este funcionário?": {
    "pt-BR": "Tem certeza de que deseja excluir este funcionário?",
    en: "Are you sure you want to delete this employee?",
  },
  "Funcionário eliminado": { "pt-BR": "Funcionário excluído", en: "Employee deleted" },
  "O funcionário foi eliminado com sucesso.": {
    "pt-BR": "O funcionário foi excluído com sucesso.",
    en: "The employee was deleted successfully.",
  },
  "Erro ao eliminar funcionário": { "pt-BR": "Erro ao excluir funcionário", en: "Error deleting employee" },
  "Não foi possível eliminar o funcionário.": {
    "pt-BR": "Não foi possível excluir o funcionário.",
    en: "Could not delete the employee.",
  },
  "Pesquisar por nome, email, função, departamento...": {
    "pt-BR": "Pesquisar por nome, e-mail, função, departamento...",
    en: "Search by name, email, trade, department...",
  },
  "Horário:": { "pt-BR": "Horário:", en: "Hours:" },
  "{horas}h/dia, {dias}d/sem": { "pt-BR": "{horas}h/dia, {dias}d/sem", en: "{horas}h/day, {dias}d/wk" },
  "Horas semanais:": { "pt-BR": "Horas semanais:", en: "Weekly hours:" },
  "Horas mensais:": { "pt-BR": "Horas mensais:", en: "Monthly hours:" },
  "Venda/hora:": { "pt-BR": "Venda/hora:", en: "Sale/hour:" },
  "Custo real/hora:": { "pt-BR": "Custo real/hora:", en: "Real cost/hour:" },
  "Salário total:": { "pt-BR": "Salário total:", en: "Total salary:" },
  "Nenhum funcionário encontrado": { "pt-BR": "Nenhum funcionário encontrado", en: "No employees found" },
  'Nenhum resultado para "{termo}". Ajuste a pesquisa para ver a lista completa.': {
    "pt-BR": 'Nenhum resultado para "{termo}". Ajuste a pesquisa para ver a lista completa.',
    en: 'No results for "{termo}". Adjust the search to see the full list.',
  },
  "Nenhum funcionário registado": { "pt-BR": "Nenhum funcionário cadastrado", en: "No employees added yet" },
  "Comece por adicionar funcionários à sua equipa.": {
    "pt-BR": "Comece adicionando funcionários à sua equipe.",
    en: "Start by adding employees to your team.",
  },
  "Adicionar o primeiro funcionário": { "pt-BR": "Adicionar o primeiro funcionário", en: "Add the first employee" },

  // ---- Ficha: separadores e dados pessoais
  "Dados pessoais": { "pt-BR": "Dados pessoais", en: "Personal details" },
  "Horário e valores": { "pt-BR": "Horário e valores", en: "Hours and pay" },
  "Encargos": { "pt-BR": "Encargos", en: "Employer costs" },
  "Encargo líquido": { "pt-BR": "Encargo líquido", en: "Net pay" },
  "Nome completo *": { "pt-BR": "Nome completo *", en: "Full name *" },
  "Nome completo do funcionário": { "pt-BR": "Nome completo do funcionário", en: "Employee's full name" },
  "Data de nascimento *": { "pt-BR": "Data de nascimento *", en: "Date of birth *" },
  "Rua, número, andar": { "pt-BR": "Rua, número, complemento", en: "Street, number, floor" },
  "URL da foto (opcional)": { "pt-BR": "URL da foto (opcional)", en: "Photo URL (optional)" },
  "https://exemplo.com/foto.jpg": { "pt-BR": "https://exemplo.com/foto.jpg", en: "https://example.com/photo.jpg" },
  "Observações pessoais": { "pt-BR": "Observações pessoais", en: "Personal notes" },
  "Observações sobre o funcionário...": {
    "pt-BR": "Observações sobre o funcionário...",
    en: "Notes about the employee...",
  },

  // ---- Ficha: empresa
  "Função *": { "pt-BR": "Função *", en: "Trade *" },
  "Selecione a função": { "pt-BR": "Selecione a função", en: "Select the trade" },
  "Novo cargo (ex.: Diretor)": { "pt-BR": "Novo cargo (ex.: Diretor)", en: "New role (e.g. Director)" },
  "Data de admissão": { "pt-BR": "Data de admissão", en: "Start date" },
  "Número do funcionário": { "pt-BR": "Número do funcionário", en: "Employee number" },
  "Ex.: FUNC001": { "pt-BR": "Ex.: FUNC001", en: "E.g. EMP001" },
  "Departamento": { "pt-BR": "Departamento", en: "Department" },
  "Selecione o departamento": { "pt-BR": "Selecione o departamento", en: "Select the department" },
  "Operacional": { "pt-BR": "Operacional", en: "Operations" },
  "Administrativo": { "pt-BR": "Administrativo", en: "Administrative" },
  "Comercial": { "pt-BR": "Comercial", en: "Sales" },
  "Financeiro": { "pt-BR": "Financeiro", en: "Finance" },
  "Recursos Humanos": { "pt-BR": "Recursos Humanos", en: "Human Resources" },

  // ---- Funções sugeridas (nomes gravados conforme o idioma de quem as escolhe)
  "Pintor": { "pt-BR": "Pintor", en: "Painter" },
  "Pintor Sénior": { "pt-BR": "Pintor Sênior", en: "Senior Painter" },
  "Auxiliar de Pintor": { "pt-BR": "Ajudante de Pintor", en: "Painter's Assistant" },
  "Preparador de Superfícies": { "pt-BR": "Preparador de Superfícies", en: "Surface Preparer" },
  "Supervisor": { "pt-BR": "Supervisor", en: "Supervisor" },
  "Encarregado": { "pt-BR": "Encarregado", en: "Foreman" },
  "Gestor de Projetos": { "pt-BR": "Gerente de Projetos", en: "Project Manager" },
  "Gerência": { "pt-BR": "Gerência", en: "Management" },
  "Diretor": { "pt-BR": "Diretor", en: "Director" },

  // ---- Ficha: horário e valores
  "Horas por dia *": { "pt-BR": "Horas por dia *", en: "Hours per day *" },
  "Dias por semana *": { "pt-BR": "Dias por semana *", en: "Days per week *" },
  "Mês para o cálculo": { "pt-BR": "Mês para o cálculo", en: "Month for the calculation" },
  "Horas por semana (calculado)": { "pt-BR": "Horas por semana (calculado)", en: "Hours per week (calculated)" },
  "{n} h/semana": { "pt-BR": "{n} h/semana", en: "{n} h/week" },
  "Dias úteis no mês (calculado)": {
    "pt-BR": "Dias úteis no mês (calculado)",
    en: "Working days in the month (calculated)",
  },
  "Horas por mês (calculado)": { "pt-BR": "Horas por mês (calculado)", en: "Hours per month (calculated)" },
  "{n} h/mês": { "pt-BR": "{n} h/mês", en: "{n} h/month" },
  "Base de horas para o custo/hora": { "pt-BR": "Base de horas para o custo/hora", en: "Hours basis for the hourly cost" },
  "Média anual - equilibrada": { "pt-BR": "Média anual - equilibrada", en: "Annual average - balanced" },
  "Maior mês do ano - menor custo/hora": {
    "pt-BR": "Maior mês do ano - menor custo/hora",
    en: "Longest month of the year - lowest hourly cost",
  },
  "Menor mês do ano - maior custo/hora": {
    "pt-BR": "Menor mês do ano - maior custo/hora",
    en: "Shortest month of the year - highest hourly cost",
  },
  "Mês de referência escolhido": { "pt-BR": "Mês de referência escolhido", en: "Chosen reference month" },
  "Base atual: {dias} ({detalhe}) x {horas}h = {total}. O mês escolhido acima tem {diasMes} dias úteis.": {
    "pt-BR": "Base atual: {dias} ({detalhe}) x {horas}h = {total}. O mês escolhido acima tem {diasMes} dias úteis.",
    en: "Current basis: {dias} ({detalhe}) x {horas}h = {total}. The month chosen above has {diasMes} working days.",
  },
  "Quanto mais horas no divisor, menor o custo/hora. A média anual não subavalia nem sobreavalia nenhum mês; o maior mês dá o valor mais agressivo e o menor mês o mais seguro.":
    {
      "pt-BR":
        "Quanto mais horas no divisor, menor o custo/hora. A média anual não subestima nem superestima nenhum mês; o maior mês dá o valor mais agressivo e o menor mês, o mais seguro.",
      en: "The more hours in the divisor, the lower the hourly cost. The annual average neither underestimates nor overestimates any month; the longest month gives the most aggressive figure and the shortest month the safest.",
    },
  "{mes} de {ano}": { "pt-BR": "{mes} de {ano}", en: "{mes} {ano}" },
  "mês de referência": { "pt-BR": "mês de referência", en: "reference month" },
  "{total} dias úteis em {ano} / 12": {
    "pt-BR": "{total} dias úteis em {ano} / 12",
    en: "{total} working days in {ano} / 12",
  },
  "Margem de lucro (%)": { "pt-BR": "Margem de lucro (%)", en: "Profit margin (%)" },
  "Valor de venda por hora (EUR) *": { "pt-BR": "Valor de venda por hora (EUR) *", en: "Sale price per hour (EUR) *" },
  "Salário base (EUR) *": { "pt-BR": "Salário base (EUR) *", en: "Base salary (EUR) *" },
  "Subsídio de alimentação por dia (EUR)": {
    "pt-BR": "Subsídio de alimentação por dia (EUR)",
    en: "Meal allowance per day (EUR)",
  },
  "Dias considerados": { "pt-BR": "Dias considerados", en: "Days counted" },
  "usar {n} dias (base)": { "pt-BR": "usar {n} dias (base)", en: "use {n} days (basis)" },
  "Valores isentos de IRS (EUR)": {
    "pt-BR": "Valores isentos de IRS (EUR)",
    en: "Amounts exempt from income tax (IRS) (EUR)",
  },
  "Valores isentos de IRS": { "pt-BR": "Valores isentos de IRS", en: "Amounts exempt from income tax (IRS)" },

  // ---- Ficha: encargos (custo da empresa)
  "Custo real da empresa. O IRS {naoEntra}: é retido ao trabalhador e não é custo da entidade patronal (aparece no separador Encargo líquido).":
    {
      "pt-BR":
        "Custo real da empresa. O IRS {naoEntra}: é retido do trabalhador e não é custo do empregador (aparece na aba Encargo líquido).",
      en: "The company's real cost. Income tax (IRS) {naoEntra}: it is withheld from the employee and is not an employer cost (it appears in the Net pay tab).",
    },
  "não entra aqui": { "pt-BR": "não entra aqui", en: "is not included here" },
  "Segurança Social patronal": { "pt-BR": "Segurança Social patronal", en: "Employer Social Security" },
  "Seguro de acidentes de trabalho": { "pt-BR": "Seguro de acidentes de trabalho", en: "Workplace accident insurance" },
  "sobre {valor}": { "pt-BR": "sobre {valor}", en: "on {valor}" },
  "taxa legal 2026: {taxa}%": { "pt-BR": "taxa legal 2026: {taxa}%", en: "2026 statutory rate: {taxa}%" },
  "obrigatório; na construção ronda 1% a 5%": {
    "pt-BR": "obrigatório; na construção fica entre 1% e 5%",
    en: "mandatory; in construction typically 1% to 5%",
  },
  "Diluir subsídios de férias e de Natal no custo mensal": {
    "pt-BR": "Diluir subsídios de férias e de Natal no custo mensal",
    en: "Spread holiday and Christmas allowances over the monthly cost",
  },
  "Em Portugal pagam-se 14 meses de salário por ano. Diluir os 2 meses extra ({valor}/mês) evita subavaliar o custo/hora.":
    {
      "pt-BR":
        "Em Portugal são pagos 14 salários por ano. Diluir os 2 meses extras ({valor}/mês) evita subestimar o custo/hora.",
      en: "In Portugal 14 monthly salaries are paid per year. Spreading the 2 extra months ({valor}/month) avoids underestimating the hourly cost.",
    },
  "Meses de subsídio de alimentação por ano": {
    "pt-BR": "Meses de subsídio de alimentação por ano",
    en: "Months of meal allowance per year",
  },
  "Paga-se por dia trabalhado, por isso no mês de férias não há refeição: por norma {meses} meses. Média mensal: {valor}":
    {
      "pt-BR":
        "É pago por dia trabalhado, então no mês de férias não há refeição: normalmente {meses} meses. Média mensal: {valor}",
      en: "It is paid per day worked, so there is no meal allowance in the leave month: normally {meses} months. Monthly average: {valor}",
    },
  "O subsídio de alimentação está {excesso} acima do limite isento ({limite}/dia em cartão x {dias} = {total}). O excedente paga IRS e Segurança Social dos dois lados.":
    {
      "pt-BR":
        "O subsídio de alimentação está {excesso} acima do limite isento ({limite}/dia em cartão x {dias} = {total}). O excedente paga IRS e Segurança Social dos dois lados.",
      en: "The meal allowance is {excesso} above the exempt limit ({limite}/day on a meal card x {dias} = {total}). The excess is subject to income tax (IRS) and Social Security on both sides.",
    },
  "Memória de cálculo": { "pt-BR": "Memória de cálculo", en: "Calculation breakdown" },
  "Salário base": { "pt-BR": "Salário base", en: "Base salary" },
  "Subsídios de férias + Natal (2/12)": {
    "pt-BR": "Subsídios de férias + Natal (2/12)",
    en: "Holiday + Christmas allowances (2/12)",
  },
  "Base de incidência": { "pt-BR": "Base de cálculo", en: "Contribution base" },
  "Segurança Social patronal ({taxa}%)": {
    "pt-BR": "Segurança Social patronal ({taxa}%)",
    en: "Employer Social Security ({taxa}%)",
  },
  "Seguro de acidentes ({taxa}%)": { "pt-BR": "Seguro de acidentes ({taxa}%)", en: "Accident insurance ({taxa}%)" },
  "Subsídio de alimentação ({meses} meses/ano diluídos)": {
    "pt-BR": "Subsídio de alimentação ({meses} meses/ano diluídos)",
    en: "Meal allowance ({meses} months/year spread)",
  },
  "Subsídio de alimentação (isento até ao limite)": {
    "pt-BR": "Subsídio de alimentação (isento até o limite)",
    en: "Meal allowance (exempt up to the limit)",
  },
  "Total de encargos da empresa": { "pt-BR": "Total de encargos da empresa", en: "Total employer costs" },
  "Custo total mensal da empresa": { "pt-BR": "Custo mensal total da empresa", en: "Total monthly cost to the company" },
  "{pct}% da remuneração bruta - dentro da referência de mercado em PT (130% a 145%)": {
    "pt-BR": "{pct}% da remuneração bruta - dentro da referência de mercado em Portugal (130% a 145%)",
    en: "{pct}% of gross pay - within the Portuguese market benchmark (130% to 145%)",
  },
  "{pct}% da remuneração bruta - fora da referência habitual em PT (130% a 145%), convém rever os campos": {
    "pt-BR": "{pct}% da remuneração bruta - fora da referência habitual em Portugal (130% a 145%), vale revisar os campos",
    en: "{pct}% of gross pay - outside the usual Portuguese benchmark (130% to 145%), worth reviewing the fields",
  },
  "Custo/hora automático (real)": { "pt-BR": "Custo/hora automático (real)", en: "Automatic hourly cost (real)" },
  "Valor de venda/hora": { "pt-BR": "Valor de venda/hora", en: "Sale price/hour" },

  // ---- Ficha: encargo líquido (recibo do trabalhador)
  "Simulação do recibo de vencimento: o que o trabalhador recebe e quanto lhe é descontado. Os descontos incidem apenas sobre o salário base. Cada taxa pode ser lançada em percentagem ou diretamente em euros.":
    {
      "pt-BR":
        "Simulação do contracheque: o que o trabalhador recebe e quanto é descontado. Os descontos incidem apenas sobre o salário base. Cada taxa pode ser informada em porcentagem ou diretamente em euros.",
      en: "Payslip simulation: what the employee receives and how much is deducted. Deductions apply only to the base salary. Each rate can be entered as a percentage or directly in euros.",
    },
  "Segurança Social do trabalhador": { "pt-BR": "Segurança Social do trabalhador", en: "Employee Social Security" },
  "IRS retido na fonte": { "pt-BR": "IRS retido na fonte", en: "Income tax (IRS) withheld at source" },
  "Dependentes": { "pt-BR": "Dependentes", en: "Dependants" },
  "- {valor} cada": { "pt-BR": "- {valor} cada", en: "- {valor} each" },
  "isento (até 920 EUR/mês)": { "pt-BR": "isento (até 920 EUR/mês)", en: "exempt (up to 920 EUR/month)" },
  "escalão até {ate} EUR, taxa marginal {taxa}%": {
    "pt-BR": "faixa até {ate} EUR, alíquota marginal {taxa}%",
    en: "bracket up to {ate} EUR, marginal rate {taxa}%",
  },
  "Tabelas oficiais de 2026 (Despacho 233-A/2026). Fórmula: remuneração x taxa - parcela a abater - parcela por dependente.":
    {
      "pt-BR":
        "Tabelas oficiais de 2026 (Despacho 233-A/2026). Fórmula: remuneração x alíquota - parcela a deduzir - parcela por dependente.",
      en: "Official 2026 tables (Order 233-A/2026). Formula: pay x rate - deduction - deduction per dependant.",
    },
  "Recibo de vencimento (simulação)": { "pt-BR": "Contracheque (simulação)", en: "Payslip (simulation)" },
  "Vencimentos": { "pt-BR": "Proventos", en: "Earnings" },
  "Vencimento base": { "pt-BR": "Salário base", en: "Base pay" },
  "Subsídio de alimentação (isento)": { "pt-BR": "Subsídio de alimentação (isento)", en: "Meal allowance (exempt)" },
  "Total ilíquido": { "pt-BR": "Total bruto", en: "Gross total" },
  "Descontos do trabalhador": { "pt-BR": "Descontos do trabalhador", en: "Employee deductions" },
  "Segurança Social ({taxa}% do salário base)": {
    "pt-BR": "Segurança Social ({taxa}% do salário base)",
    en: "Social Security ({taxa}% of base salary)",
  },
  "IRS ({taxa}% do salário base)": {
    "pt-BR": "IRS ({taxa}% do salário base)",
    en: "Income tax (IRS) ({taxa}% of base salary)",
  },
  "Total descontado": { "pt-BR": "Total descontado", en: "Total deducted" },
  "Peso dos descontos sobre o salário base": {
    "pt-BR": "Peso dos descontos sobre o salário base",
    en: "Deductions as a share of base salary",
  },
  "Líquido a receber": { "pt-BR": "Líquido a receber", en: "Net pay" },
  "{salario} - {descontos} + {isentos} isentos": {
    "pt-BR": "{salario} - {descontos} + {isentos} isentos",
    en: "{salario} - {descontos} + {isentos} exempt",
  },
  "Bruto": { "pt-BR": "Bruto", en: "Gross" },
  "Líquido (após descontos)": { "pt-BR": "Líquido (após descontos)", en: "Net (after deductions)" },
  "Por hora": { "pt-BR": "Por hora", en: "Per hour" },
  "Líquido/hora": { "pt-BR": "Líquido/hora", en: "Net/hour" },
  "Custo/hora para a empresa": { "pt-BR": "Custo/hora para a empresa", en: "Hourly cost to the company" },

  // ---- Tabelas de retenção de IRS
  "Tabela I": { "pt-BR": "Tabela I", en: "Table I" },
  "Tabela II": { "pt-BR": "Tabela II", en: "Table II" },
  "Tabela III": { "pt-BR": "Tabela III", en: "Table III" },
  "Tabela IV": { "pt-BR": "Tabela IV", en: "Table IV" },
  "Tabela V": { "pt-BR": "Tabela V", en: "Table V" },
  "Tabela VI": { "pt-BR": "Tabela VI", en: "Table VI" },
  "Tabela VII": { "pt-BR": "Tabela VII", en: "Table VII" },
  "Não casado sem dependentes ou casado, dois titulares": {
    "pt-BR": "Não casado sem dependentes ou casado, dois titulares",
    en: "Single without dependants, or married with two earners",
  },
  "Não casado com um ou mais dependentes": {
    "pt-BR": "Não casado com um ou mais dependentes",
    en: "Single with one or more dependants",
  },
  "Casado, único titular": { "pt-BR": "Casado, único titular", en: "Married, single earner" },
  "Não casado ou casado, dois titulares, sem dependentes - pessoa com deficiência": {
    "pt-BR": "Não casado ou casado, dois titulares, sem dependentes - pessoa com deficiência",
    en: "Single, or married with two earners, without dependants - person with a disability",
  },
  "Não casado com um ou mais dependentes - pessoa com deficiência": {
    "pt-BR": "Não casado com um ou mais dependentes - pessoa com deficiência",
    en: "Single with one or more dependants - person with a disability",
  },
  "Casado, dois titulares, com um ou mais dependentes - pessoa com deficiência": {
    "pt-BR": "Casado, dois titulares, com um ou mais dependentes - pessoa com deficiência",
    en: "Married with two earners, with one or more dependants - person with a disability",
  },
  "Casado, único titular - pessoa com deficiência": {
    "pt-BR": "Casado, único titular - pessoa com deficiência",
    en: "Married, single earner - person with a disability",
  },

  // ---- Funções de mão de obra
  "Funções de mão de obra": { "pt-BR": "Funções de mão de obra", en: "Labour trades" },
  "Preço/hora cobrado ao cliente e custo médio/hora da equipa de cada função": {
    "pt-BR": "Preço/hora cobrado do cliente e custo médio/hora da equipe de cada função",
    en: "Hourly price charged to the client and average hourly team cost for each trade",
  },
  "Nova função": { "pt-BR": "Nova função", en: "New trade" },
  "Editar função": { "pt-BR": "Editar função", en: "Edit trade" },
  "Erro ao carregar funções": { "pt-BR": "Erro ao carregar funções", en: "Error loading trades" },
  "Indique o nome da função": { "pt-BR": "Informe o nome da função", en: "Enter the trade name" },
  "A função já existe": { "pt-BR": "A função já existe", en: "Trade already exists" },
  '"{nome}" já está registada.': { "pt-BR": '"{nome}" já está cadastrada.', en: '"{nome}" has already been added.' },
  "Função atualizada": { "pt-BR": "Função atualizada", en: "Trade updated" },
  "Função registada": { "pt-BR": "Função cadastrada", en: "Trade added" },
  "Não foi possível guardar a função": { "pt-BR": "Não foi possível salvar a função", en: "Could not save the trade" },
  'Eliminar a função "{nome}"? Os funcionários não são alterados.': {
    "pt-BR": 'Excluir a função "{nome}"? Os funcionários não são alterados.',
    en: 'Delete the trade "{nome}"? Employees are not changed.',
  },
  "Não foi possível eliminar": { "pt-BR": "Não foi possível excluir", en: "Could not delete" },
  "Os funcionários usam estas funções, que ainda não têm preço ao cliente. Clique para registar:": {
    "pt-BR": "Os funcionários usam estas funções, que ainda não têm preço para o cliente. Clique para cadastrar:",
    en: "Employees use these trades, which do not have a client price yet. Click to add:",
  },
  "Nenhuma função registada": { "pt-BR": "Nenhuma função cadastrada", en: "No trades added yet" },
  "Registe Pintor, Pedreiro, Eletricista... com o preço/hora ao cliente.": {
    "pt-BR": "Cadastre Pintor, Pedreiro, Eletricista... com o preço/hora para o cliente.",
    en: "Add Painter, Bricklayer, Electrician... with the hourly client price.",
  },
  "Preço ao cliente": { "pt-BR": "Preço para o cliente", en: "Client price" },
  "Custo médio": { "pt-BR": "Custo médio", en: "Average cost" },
  "sem funcionários": { "pt-BR": "sem funcionários", en: "no employees" },
  "O custo médio vem dos funcionários ativos com esta função (campo Função na ficha do funcionário).": {
    "pt-BR": "O custo médio vem dos funcionários ativos com esta função (campo Função no cadastro do funcionário).",
    en: "The average cost comes from active employees with this trade (Trade field on the employee record).",
  },
  "Ex.: Pintor": { "pt-BR": "Ex.: Pintor", en: "E.g. Painter" },
  "Preço/hora ao cliente": { "pt-BR": "Preço/hora para o cliente", en: "Hourly price to the client" },
  "Margem sobre o custo médio": { "pt-BR": "Margem sobre o custo médio", en: "Margin on average cost" },
  "Custo médio atual: {valor}/h": { "pt-BR": "Custo médio atual: {valor}/h", en: "Current average cost: {valor}/h" },
  "Custo médio atual: nenhum funcionário ativo com esta função": {
    "pt-BR": "Custo médio atual: nenhum funcionário ativo com esta função",
    en: "Current average cost: no active employees with this trade",
  },
  "Texto no PDF do cliente": { "pt-BR": "Texto no PDF do cliente", en: "Text on the client PDF" },
  "Mão de obra - {nome}": { "pt-BR": "Mão de obra - {nome}", en: "Labour - {nome}" },
  "função": { "pt-BR": "função", en: "trade" },
  "Ativa (aparece nos orçamentos)": { "pt-BR": "Ativa (aparece nos orçamentos)", en: "Active (appears in quotes)" },
}
