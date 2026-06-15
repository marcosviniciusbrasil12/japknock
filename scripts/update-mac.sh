#!/usr/bin/env bash
#
# Atualizador do JapKnock pra macOS — instala a última release SEM o prompt
# "Abrir Mesmo Assim" do Gatekeeper e SEM precisar do GitHub CLI.
#
# Por quê funciona sem permissão: o app só pede o "Abrir Mesmo Assim" quando
# está com o atributo `com.apple.quarantine` (que o navegador põe ao baixar).
# Baixando via `curl` (linha de comando) o arquivo NÃO vem em quarentena, e
# ainda removemos a quarentena com `xattr` antes de abrir.
#
# Uso (forma à prova de Slack — copie esta linha única, sem aspas):
#   curl -fsSL https://raw.githubusercontent.com/marcosviniciusbrasil12/japknock/main/scripts/update-mac.sh | bash
#
# Ou localmente:
#   bash update-mac.sh            # instala a última versão
#   bash update-mac.sh v1.4.0     # instala uma versão específica
#
set -euo pipefail

REPO="marcosviniciusbrasil12/japknock"
APP="JapKnock"
APP_PATH="/Applications/${APP}.app"

# 1. Arquitetura → sufixo do .dmg
case "$(uname -m)" in
  arm64) ARCH="arm64" ;; # Apple Silicon (M1/M2/M3/M4)
  x86_64) ARCH="x64" ;;  # Intel
  *) echo "❌ Arquitetura não suportada: $(uname -m)"; exit 1 ;;
esac

# 2. Versão: argumento explícito, ou a última release (API pública, sem auth)
TAG="${1:-}"
if [ -z "$TAG" ]; then
  echo "🔎 Descobrindo a última versão…"
  TAG=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
    | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -1)
fi
if [ -z "$TAG" ]; then
  echo "❌ Não consegui descobrir a versão (rede ou limite da API do GitHub)."
  exit 1
fi
VER="${TAG#v}"
ASSET="${APP}-${VER}-${ARCH}.dmg"
URL="https://github.com/${REPO}/releases/download/${TAG}/${ASSET}"
echo "📦 JapKnock ${TAG} (${ARCH})"

# 3. Baixa o .dmg (linha de comando = sem quarentena)
TMP="$(mktemp -d)"
trap 'hdiutil detach "$TMP/mnt" -quiet 2>/dev/null || true; rm -rf "$TMP"' EXIT
echo "⬇️  Baixando…"
curl -fL -o "$TMP/$ASSET" "$URL"

# 4. Encerra a instância rodando (kill direto — bypassa o lockdown do app)
echo "⏹️  Fechando o JapKnock aberto…"
pkill -9 -x "$APP" 2>/dev/null || true
sleep 1

# 5. Monta o .dmg e substitui o app (com fallback pra sudo se /Applications pedir)
echo "💿 Instalando em /Aplicativos…"
mkdir -p "$TMP/mnt"
hdiutil attach "$TMP/$ASSET" -nobrowse -quiet -mountpoint "$TMP/mnt"
if rm -rf "$APP_PATH" 2>/dev/null && cp -R "$TMP/mnt/${APP}.app" /Applications/ 2>/dev/null; then
  :
else
  echo "🔑 Preciso da senha do Mac pra escrever em Aplicativos:"
  sudo rm -rf "$APP_PATH"
  sudo cp -R "$TMP/mnt/${APP}.app" /Applications/
fi

# 6. Remove a quarentena → SEM "Abrir Mesmo Assim"
xattr -dr com.apple.quarantine "$APP_PATH" 2>/dev/null \
  || sudo xattr -dr com.apple.quarantine "$APP_PATH" 2>/dev/null || true

# 7. Reabre
open "$APP_PATH"
echo ">>> JAPKNOCK ATUALIZADO PARA ${TAG} <<<"
