#!/usr/bin/env bash
# Corre NA VM (instalado em /usr/local/sbin/erp-publicar).
# Recebe o código fonte do ERP em .tar.gz pelo stdin, compila e reinicia o serviço.
#
#   cat codigo.tar.gz | ssh ubuntu@vm sudo /usr/local/sbin/erp-publicar
#
# A chave de deploy do GitHub Actions está presa a este comando no
# authorized_keys (command="..."): com ela só se consegue publicar o ERP.
set -euo pipefail
exec 9>/run/erp-publicar.lock
flock -n 9 || { echo "ja ha uma publicacao a decorrer"; exit 1; }

PACOTE="$(mktemp /tmp/erp-src-XXXXXX.tar.gz)"
trap 'rm -f "$PACOTE"' EXIT
cat > "$PACOTE"
[ -s "$PACOTE" ] || { echo "nao chegou codigo nenhum"; exit 1; }
echo "== recebido: $(du -h "$PACOTE" | cut -f1)"

id erp >/dev/null 2>&1 || useradd --system --home /opt/erp --shell /usr/sbin/nologin erp
install -d -o erp -g erp /opt/erp /opt/erp/src
install -d -m 750 /etc/erp

# código novo numa pasta limpa (node_modules e a cache do Next mantêm-se entre publicações)
find /opt/erp/src -mindepth 1 -maxdepth 1 ! -name node_modules ! -name .next -exec rm -rf {} +
tar -xzf "$PACOTE" -C /opt/erp/src
chown -R erp:erp /opt/erp/src

cd /opt/erp/src
echo "== npm ci"
sudo -u erp -H env NEXT_TELEMETRY_DISABLED=1 npm ci --no-audit --no-fund --loglevel=error
echo "== build"
sudo -u erp -H env NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=3072 npm run build

# servidor autónomo + ficheiros estáticos; a versão anterior fica em app-antigo
rm -rf /opt/erp/app-novo
cp -a .next/standalone /opt/erp/app-novo
cp -a .next/static /opt/erp/app-novo/.next/static
cp -a public /opt/erp/app-novo/public
chown -R erp:erp /opt/erp/app-novo
rm -rf /opt/erp/app-antigo
[ -d /opt/erp/app ] && mv /opt/erp/app /opt/erp/app-antigo
mv /opt/erp/app-novo /opt/erp/app

install -m 644 deploy/erp.service /etc/systemd/system/erp.service
# o próprio script de publicação também se atualiza para a próxima vez
install -m 755 deploy/erp-publicar.sh /usr/local/sbin/erp-publicar
systemctl daemon-reload
systemctl enable --quiet erp
systemctl restart erp

for i in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:3002/api/saude >/dev/null 2>&1; then
    echo "== servidor no ar (porta 3002)"
    exit 0
  fi
  sleep 1
done

# Não arrancou: volta à versão anterior para o sistema não ficar em baixo
echo "!! o servidor novo nao respondeu; ultimas linhas:"
journalctl -u erp -n 40 --no-pager || true
if [ -d /opt/erp/app-antigo ]; then
  echo "!! a repor a versao anterior"
  rm -rf /opt/erp/app-falhada
  mv /opt/erp/app /opt/erp/app-falhada
  mv /opt/erp/app-antigo /opt/erp/app
  systemctl restart erp
fi
exit 1
