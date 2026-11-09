#!/usr/bin/env bash
# Publica o ERP na VM Oracle (erp.tecknowhow.pt) a partir deste PC.
#
#   bash deploy/publicar.sh
#
# Normalmente não é preciso: cada push para o master publica sozinho pelo
# GitHub Actions (.github/workflows/deploy-vm.yml). Isto serve para publicar à
# mão o que está na pasta, mesmo sem commit.
# Precisa da chave SSH da VM em ORACLE_KEY (ou no caminho de baixo).
set -euo pipefail

VM="${ORACLE_VM:-ubuntu@146.235.62.113}"
KEY="${ORACLE_KEY:-C:/Users/Lucas/Desktop/Projetos/oracle/oracle-freetier-instance-creation/id_rsa}"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
cd "$RAIZ"

# O script da VM vai sempre na versão desta pasta
scp -i "$KEY" -o BatchMode=yes -q deploy/erp-publicar.sh "$VM:/tmp/erp-publicar.sh"

echo "== a empacotar e enviar o código"
# Só o que está no git (ou novo e não ignorado), sem planilhas, PDFs e áudios soltos na raiz
git ls-files -co --exclude-standard \
  | grep -E '^(app|components|hooks|lib|public|styles|scripts|deploy)/|^(package(-lock)?\.json|next\.config\.mjs|tsconfig\.json|postcss\.config\.mjs|tailwind\.config\.ts|components\.json|next-env\.d\.ts)$' \
  | while IFS= read -r f; do [ -f "$f" ] && printf '%s\n' "$f"; done \
  | tar -czf - -T - \
  | ssh -i "$KEY" -o BatchMode=yes "$VM" 'sudo bash /tmp/erp-publicar.sh'
echo "== feito: https://erp.tecknowhow.pt"
