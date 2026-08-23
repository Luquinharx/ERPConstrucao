# Tasks — Rodada de ajustes (23/08/2026)

Origem: revisão do Lucas sobre o orçamento de teste, com 7 pontos levantados.
Build: `npm run build` ✅ · Typecheck dos ficheiros alterados: limpo.

| # | Task | Módulo | Status |
|---|------|--------|--------|
| 1 | Subsídio de alimentação = valor diário × dias | Funcionários | ✅ Feito |
| 2 | Custo/hora deixou de oscilar com o mês | Funcionários | ✅ Feito |
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

## Task 2 — Custo/hora fixo no maior mês do ano

**Pedido:** "ele muda o valor hora, fev tem 20 dias e dezembro tem 22, varia entre 10,90 para 12,05. Oscila muito, vou ter de considerar sempre o maior mês em dias úteis"

**Antes:** o custo/hora usava os dias úteis do mês escolhido, então mudava conforme o mês de referência.

**Agora:** o sistema varre os 12 meses do ano e usa sempre o de mais dias úteis.

Dias úteis de 2026 (5 dias/semana) e o custo/hora resultante para um custo mensal de 1.933,75 €:

```
  jan: 22 dias = 176h  ->  10.99        jul: 23 dias = 184h  ->  10.51
  fev: 20 dias = 160h  ->  12.09        ago: 21 dias = 168h  ->  11.51
  mar: 22 dias = 176h  ->  10.99        set: 22 dias = 176h  ->  10.99
  abr: 22 dias = 176h  ->  10.99        out: 22 dias = 176h  ->  10.99
  mai: 21 dias = 168h  ->  11.51        nov: 21 dias = 168h  ->  11.51
  jun: 22 dias = 176h  ->  10.99        dez: 23 dias = 184h  ->  10.51

  ANTES: variava de 12,09 a 10,51 conforme o mês
  AGORA: fixo em 10,51 (julho, 23 dias = 184h)
```

> ⚠️ **Atenção ao efeito:** mais horas no divisor dá o **menor** custo/hora do ano. Se a obra decorrer num mês curto (fevereiro, 160h), o custo real por hora é 12,09 € — cerca de 15% acima do orçado. É a opção mais agressiva, não a mais segura. A alternativa é a média anual (~21,3 dias, ≈11,35 €/h), que fica no meio e não subavalia nenhum mês. Trocar é uma linha de código.

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

## Pendentes (não fazem parte desta rodada)

- **Funcionários e serviços antigos** continuam a precisar de ser abertos e gravados para os valores corrigidos irem à base de dados.
- **Registo aberto:** qualquer pessoa que descubra o endereço pode criar conta e ver tudo. Há uma lista de e-mails autorizados pronta e comentada em [firestore.rules](firestore.rules).
- **Planilha de cliente no histórico do git**, do commit em que entrou por engano. Removida do repositório, mas recuperável por quem clonar.
- **PDF:** ainda sem logótipo, sem numeração no formato `CO26/0033` e sem o bloco de notas com condições de pagamento que a proposta de referência tem.
