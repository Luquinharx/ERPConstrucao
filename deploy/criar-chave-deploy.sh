#!/usr/bin/env bash
# Cria a chave de deploy do GitHub Actions e autoriza-a na VM (correr uma vez, no Git Bash):
#
#   bash deploy/criar-chave-deploy.sh
#
# A chave nova só pode correr "sudo /usr/local/sbin/erp-publicar" na VM
# (command="..." no authorized_keys, sem terminal nem túneis). A parte privada
# fica copiada para a área de transferência, para colar no segredo VM_SSH_KEY
# do GitHub; o ficheiro local é apagado no fim.
set -euo pipefail

VM="${ORACLE_VM:-ubuntu@146.235.62.113}"
KEY="${ORACLE_KEY:-C:/Users/Lucas/Desktop/Projetos/oracle/oracle-freetier-instance-creation/id_rsa}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

ssh-keygen -q -t ed25519 -N "" -C "github-actions-deploy-erp" -f "$TMP/deploy"
PUB="$(cat "$TMP/deploy.pub")"

# Troca a chave anterior do GitHub (se houver) pela nova
ssh -i "$KEY" -o BatchMode=yes "$VM" "set -e
  touch ~/.ssh/authorized_keys
  grep -v 'github-actions-deploy-erp' ~/.ssh/authorized_keys > ~/.ssh/authorized_keys.novo || true
  echo 'command=\"sudo /usr/local/sbin/erp-publicar\",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty $PUB' >> ~/.ssh/authorized_keys.novo
  chmod 600 ~/.ssh/authorized_keys.novo
  mv ~/.ssh/authorized_keys.novo ~/.ssh/authorized_keys"
echo "Chave autorizada na VM (so pode publicar o ERP)."

if command -v clip.exe >/dev/null 2>&1; then
  clip.exe < "$TMP/deploy"
  echo
  echo "A chave PRIVADA foi copiada para a area de transferencia."
else
  echo; echo "Copie a chave PRIVADA abaixo (todas as linhas):"; echo; cat "$TMP/deploy"
fi
cat <<'TXT'

Agora no GitHub:
  1. https://github.com/Luquinharx/ERPConstrucao/settings/secrets/actions
  2. "New repository secret"
  3. Name: VM_SSH_KEY    Secret: cole (Ctrl+V)    -> "Add secret"

Pronto: cada push para o master publica sozinho em https://erp.tecknowhow.pt
(acompanhe em https://github.com/Luquinharx/ERPConstrucao/actions)
TXT
