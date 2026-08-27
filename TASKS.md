# Tasks — Rodada de ajustes (23/08/2026)

Origem: revisão do Lucas sobre o orçamento de teste, com 7 pontos levantados.
Build: `npm run build` ✅ · Typecheck dos ficheiros alterados: limpo.

| # | Task | Módulo | Status |
|---|------|--------|--------|
| 1 | Subsídio de alimentação = valor diário × dias | Funcionários | ✅ Feito |
| 2 | Base de horas do custo/hora configurável | Funcionários | ✅ Feito |
| 3 | IRS calculado automaticamente pelas tabelas oficiais | Funcionários | ✅ Feito |
| 4 | Mesmo serviço em cômodos diferentes | Orçamentos | ✅ Feito |
| 5 | PDF: tirar negrito do nome do item | Orçamentos | ✅ Feito |
| 6 | PDF: imprimir mantendo as cores | Orçamentos | ✅ Feito |
| 7 | PDF de custo: remover "Lucro previsto" | Orçamentos | ✅ Feito |

---

## Task 1 — Subsídio de alimentação por dia × dias

**Pedido:** "se o valor de ajuda de custo de comida for fixo, ele não varia nos dias dos meses, temos de colocar em função do valor diário × dias para sempre calcular automático"

**Antes:** campo único "Valor Benefícios (EUR)" com 165 € fixos, digitados à mão.

**Agora:** dois campos — **valor por dia** e **dias** — com o total calculado:

```
7,50 EUR x 22 dias = 165,00 EUR
```

Há um atalho "usar 23 dias (base)" que alinha os dias com a base de cálculo do custo/hora. Registos antigos são convertidos ao abrir: o valor mensal gravado é dividido pelos dias para achar o valor diário.

O aviso de limite de isenção continua a funcionar (10,46 €/dia em cartão, 6,15 € em dinheiro).

---

## Task 2 — Base de horas do custo/hora deixou de oscilar

**Pedido:** "ele muda o valor hora, fev tem 20 dias e dezembro tem 22, varia entre 10,90 para 12,05. Oscila muito, vou ter de considerar sempre o maior mês em dias úteis"

**Antes:** o custo/hora usava os dias úteis do mês de referência, então mudava conforme o mês escolhido — de 12,09 € em fevereiro a 10,51 € em julho.

**Agora:** a base é uma escolha explícita, num seletor na aba Horário e Valores, por funcionário. Para 2026, com 8h/dia e custo mensal de 1.933,75 €:

```
  Media anual           21.75 dias =    174h  ->  custo/hora 11.11 EUR   <- padrao
  Maior mes (jul/dez)      23 dias =    184h  ->  custo/hora 10.51 EUR   mais agressivo
  Menor mes (fev)          20 dias =    160h  ->  custo/hora 12.09 EUR   mais seguro
  Mes de referencia        22 dias =    176h  ->  custo/hora 10.99 EUR
```

O padrão é a **média anual**: 261 dias úteis em 2026 ÷ 12 = 21,75 dias/mês. Não subavalia nem sobreavalia nenhum mês.

> ⚠️ Fixar no **maior mês** dá o menor custo/hora do ano. Como o custo mensal é fixo, mais horas no divisor significa menos euros por hora — e se a obra decorrer num mês curto (fevereiro, 160h), o custo real é 12,09 €/h, cerca de 15% acima do orçado. É a opção mais agressiva, não a mais segura. O **menor mês** é o inverso: garante que nunca falta, ao custo de orçar mais caro.

A tela mostra sempre a conta da base ativa: `21,75 dias (261 dias úteis em 2026 / 12) × 8,00h = 174,00h/mês`.

---

## Task 3 — IRS automático pelas tabelas oficiais

**Pedido:** "conseguiríamos calcular automaticamente o valor do IRS? O sistema calcula mas é aberto para manipular o valor se for preciso"

**Antes:** percentagem digitada à mão, obrigando a consultar a tabela e a acertar casas decimais ("para eu acertar o cêntimo tive de ajustar as casas decimais").

**Agora:** o valor é calculado pelas tabelas de retenção oficiais. Foi descarregado o ficheiro `Tabelas_RF_Continente_2026.xlsx` do Portal das Finanças (Despacho n.º 233-A/2026) e as **7 tabelas de Categoria A** foram transcritas para [lib/irs-tables.ts](lib/irs-tables.ts):

| Tabela | Situação | Por dependente |
|---|---|---|
| I | Não casado sem dependentes ou casado 2 titulares | 21,43 € |
| II | Não casado com um ou mais dependentes | 34,29 € |
| III | Casado, único titular | 42,86 € |
| IV | Não casado / casado 2 titulares sem dependentes — deficiência | — |
| V | Não casado com dependentes — deficiência | 42,86 € |
| VI | Casado 2 titulares com dependentes — deficiência | 21,43 € |
| VII | Casado, único titular — deficiência | 42,86 € |

Fórmula aplicada: `(remuneração × taxa) − parcela a abater − (parcela por dependente × nº dependentes)`. Nos dois primeiros escalões a parcela é ela própria uma fórmula, e isso foi implementado.

Na tela: seletor da tabela, campo de dependentes e um botão **Automático / Manual**. Em automático mostra o escalão e a taxa marginal aplicada; em manual você digita o valor em euros.

**Validação contra as taxas efetivas oficiais (Tabela I):**

```
  Remun.   IRS calc   Taxa efet.   Oficial
     920       0.00       0.0%      0%
    1042      54.90       5.3%      5.3%
    1108      79.25       7.2%      7.2%
    1154      86.47       7.5%      7.5%
    1819     245.05      13.5%      13.5%
    3305     780.14      23.6%      23.6%
   20221    8265.94      40.9%      40.9%

  Salário 1200, sem dependentes: 96,22 EUR (8,02%)
  (era exatamente o valor que estava a ser calculado à mão)
```

---

## Task 4 — Mesmo serviço em cômodos diferentes

**Pedido:** "coloquei o mesmo item para sala e quarto e não permite"

**Antes:** o sistema bloqueava com "Serviço já adicionado" — regra de quando ainda não havia cômodos.

**Agora:** o mesmo serviço entra em quantos cômodos forem precisos. O bloqueio só se mantém **dentro do mesmo cômodo**, onde de facto bastaria somar a quantidade, e a mensagem passou a dizer qual é o cômodo em conflito.

---

## Task 5 — PDF sem negrito no nome do item

**Pedido:** "podemos retirar o negrito (pintura cinacryll), mantendo somente a descrição"

**Antes:** cada linha saía com o nome do serviço a negrito e a descrição por baixo, em cinza.

**Agora:** sai apenas a descrição, em texto normal — igual às propostas de referência. Quando o item não tem descrição própria, cai para o nome, para nunca ficar uma linha vazia.

---

## Task 6 — Impressão a preto e branco

**Pedido:** "quando mando imprimir, tá saindo tudo branco, gostei do laranja"

**Causa:** por omissão os navegadores não imprimem fundos coloridos.

**Correção:** adicionado `print-color-adjust: exact` ao documento e uma regra `@media print` que força o laranja dos cabeçalhos de cômodo. Definida também a margem de página em 12 mm.

---

## Task 7 — "Lucro previsto" removido do PDF de custo

**Pedido:** "onde diz lucro previsto, pode tirar, pq já aparece na margem"

Linha removida. O PDF de custo mantém: subtotal de custo, transporte, total de custo, subtotal de venda, margem, venda sem IVA, IVA a entregar e total cobrado ao cliente. O valor da margem em euros é o mesmo número que aparecia como lucro previsto.

---

## Pendentes

*Revisto a 27/08/2026.*

### Dependem de si

- **Revogar as duas chaves de servico** do Firebase. Os ficheiros foram
  apagados do disco, mas as chaves continuam validas no Google ate serem
  revogadas — e cada uma da acesso total ao projeto.
  Em [Contas de servico](https://console.firebase.google.com/project/portugal-c3080/settings/serviceaccounts/adminsdk):
  `4cf05131e686954e067ce9c22863f97e53ba81cf` e
  `d391850ad681a544471a5fc838d94a9638c32524`.

- **Seguro de acidentes de trabalho a 0%** nos dois funcionarios. O sistema
  tem 1,75% como valor da construcao civil, mas os registos tem zero
  explicito, e zero e um valor valido. Se de facto paga esse seguro, o custo
  esta subestimado em cerca de 0,13 EUR/hora por pessoa. E decisao de negocio,
  nao um erro: altera-se no ecra de Funcionarios.

- **Confirmar as margens do PDF** depois da correcao de `dfbab64`. O
  documento medido tinha conteudo a 0,7 mm da borda de cima.

### Adiadas por decisao sua

- **Registo aberto:** qualquer pessoa que descubra o endereco cria conta e
  entra como Consulta — ve clientes, materiais, servicos e propostas, sem
  precos de custo.
  *Correcao ao que estava escrito aqui antes:* a regra `isAutorizado()` **ja
  nao existe** em [firestore.rules](firestore.rules). Foi removida em
  `f893bee`, quando as permissoes por cargo a tornaram redundante. Fechar o
  registo implica escreve-la de novo, nao descomentar nada.

- **teste123@gmail.com** continua no sistema como administradora. Ja nao e a
  unica: `vinicius.thomaz@hotmail.com` e `lucasmartinsa3009@gmail.com`
  tambem sao, portanto pode sair a qualquer momento sem risco de bloqueio.

### Divida tecnica

- **Planilha de cliente no historico do git** (`0703773`). Removida do
  repositorio, mas recuperavel por quem clonar. Limpar exige reescrever o
  historico e forcar o push.

### Feitas nesta rodada

- Migracao dos registos antigos: os dois funcionarios passaram a 174 h/mes
  (media anual) e o custo/hora deixou de oscilar com o mes — 10,73 para 10,28
  e 12,09 para 11,11. Os tres servicos ja estavam no formato novo.
- Limpeza das contas: 4 apagadas, 2 promovidas a administrador.
- Campos deixaram de ser esmagados por texto longo, e os dialogos deixaram de
  esconder os proprios botoes.
- Margens do papel nas folhas impressas.

---

# Rodadas seguintes

## Fases de orçamentação — `d3d9535`

As cinco fases pedidas, com bloqueio de edição e versionamento:

| Fase | Edita? | Avança para |
|---|---|---|
| Rascunho | sim | Em Revisão, Cancelado |
| Em Revisão | não | Rascunho, Emitido, Cancelado |
| Emitido | não | Em Negociação, Cancelado |
| Em Negociação | não | Emitido, Cancelado |
| Cancelado | não | Rascunho |

A partir de **Emitido** o documento congela: o botão de editar fica com um
cadeado e diz *"Crie uma revisão para alterar"*. A revisão nasce em Rascunho
com o mesmo número base e a letra seguinte — 1.0, Rev. A, Rev. B. Cancelar
exige registar o motivo, que fica visível na lista. Os estados antigos
(`enviado`, `aprovado` → Emitido; `rejeitado` → Cancelado) são convertidos
ao carregar, sem migração manual.

## Cargos e permissões — `f893bee`

20 permissões, 5 cargos e a opção *Personalizado*. Aplicadas ao orçamento:
criar, editar, submeter, aprovar, cancelar, apagar e **ver preços de custo**
são independentes. Verificadas também nas regras do Firestore — esconder um
botão não impede ninguém de chamar a base diretamente.

## Barra lateral e telas de acesso — `e2e4760`, `68a7562`, `6d0d960`

Avatar com menu de conta, barra recolhível, login e registo na identidade da
empresa, rota de recuperação de palavra-passe (o link apontava para uma rota
inexistente), guarda de permissão por rota e remoção de perfis na tela de
Utilizadores.

---

# Identidade visual parametrizavel (white-label)

O sistema deixou de ter marca fixa no codigo. Tudo o que identifica a empresa
vem de **Configuracoes → Identidade e propostas** e fica guardado no Firestore,
num documento partilhado por toda a equipa.

Se o sistema for vendido a outra empresa, basta trocar esses campos — nao ha
uma linha de codigo a alterar.

## O que e configuravel

| Campo | Onde aparece |
|---|---|
| Logotipo | menu lateral, login, registo, cabecalho das propostas, icone do separador |
| Cor principal | botoes, destaques, barra e cabecalhos de comodo das propostas |
| Cor secundaria | apoio nos documentos |
| Cor escura | cabecalhos de tabela das propostas |
| Tipo de letra | todo o sistema e as propostas (6 fontes do Google Fonts) |
| Nome e descritivo | menu lateral, login, titulo do separador, propostas |
| NIF, morada, contactos, website | cabecalho e rodape das propostas |
| Prefixo, validade, margem e IVA | valores sugeridos ao criar um orcamento |
| Notas | rodape numerado das propostas |

## Como foi feito

- [lib/brand.ts](lib/brand.ts) — defaults, paletas, fontes, conversao de cor e a
  funcao que aplica a identidade ao documento (variaveis CSS, fonte, titulo e favicon)
- [hooks/use-configuracao.tsx](hooks/use-configuracao.tsx) — carrega do Firestore,
  aplica e guarda em cache local
- [components/marca-da-empresa.tsx](components/marca-da-empresa.tsx) — logotipo
  reutilizavel, com o nome como alternativa
- [components/configuracoes/identidade-da-empresa.tsx](components/configuracoes/identidade-da-empresa.tsx) — o ecra de edicao

**Favicon:** usa o logotipo quando existe; sem logotipo, e desenhado num canvas
com as iniciais da empresa sobre a cor principal.

**Cache local:** o ecra de login nao tem sessao, logo nao pode ler o Firestore.
A ultima identidade conhecida fica em `localStorage`, para o login aparecer ja
com a marca certa. Na primeira visita de um dispositivo novo aparecem os defaults.

**Pre-visualizacao:** cor e fonte aplicam-se enquanto se mexe nos campos, antes
de guardar, para se ver o efeito em tempo real.

> Auditoria: `grep` por nomes e cores da marca no codigo devolve apenas os
> placeholders do proprio ecra de configuracao. Nada mais esta fixo.
