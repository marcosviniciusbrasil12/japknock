#!/usr/bin/env bash
#
# Atualizador do JapKnock pra macOS — instala a última release SEM o prompt
# "Abrir Mesmo Assim" do Gatekeeper.
#
# Por quê funciona sem permissão: o app só pede o "Abrir Mesmo Assim" quando
# está com o atributo `com.apple.quarantine` (que o navegador põe ao baixar).
# Baixando via `gh` (linha de comando) o arquivo NÃO vem em quarentena, e ainda
# por cima removemos a quarentena com `xattr` antes de abrir. Sem quarentena, o
# Gatekeeper nem é acionado.
#
# Pré-requisito: GitHub CLI autenticado (o repo é privado).
#   brew install gh && gh auth login
#
# Uso:
#   bash update-mac.sh            # instala a última versão
#   bash update-mac.sh v1.2.0     # instala uma versão específica
#
set -euo pipefail

REPO="marcosviniciusbrasil12/japknock"
APP="JapKnock"
APP_PATH="/Applications/${APP}.app"

# 1. Arquitetura → sufixo do .dmg
case "$(uname -m)" in
  arm64)  ARCH="arm64" ;;   # Apple Silicon (M1/M2/M3/M4)
  x86_64) ARCH="x64" ;;     # Intel
  *) echo "❌ Arquitetura não suportada: $(uname -m)"; exit 1 ;;
esac

# 2. Precisa do gh autenticado (repo privado)
if ! command -v gh >/dev/null 2>&1; then
  echo "❌ GitHub CLI não encontrado. Instale e autentique:"
  echo "   brew install gh && gh auth login"
  exit 1
fi
if ! gh auth status >/dev/null 2>&1; then
  echo "❌ gh não autenticado. Rode: gh auth login"
  exit 1
fi

# 3. Descobre a versão
TAG="${1:-}"
if [ -z "$TAG" ]; then
  TAG=$(gh release view --repo "$REPO" --json tagName -q .tagName)
fi
VER="${TAG#v}"
ASSET="${APP}-${VER}-${ARCH}.dmg"
echo "📦 JapKnock $TAG ($ARCH) → $ASSET"

# 4. Baixa o .dmg da release (linha de comando = sem quarentena)
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"; hdiutil detach "$TMP/mnt" -quiet 2>/dev/null || true' EXIT
echo "⬇️  Baixando…"
gh release download "$TAG" --repo "$REPO" --pattern "$ASSET" --dir "$TMP"

# 5. Encerra a instância rodando (kill direto — bypassa o lockdown do app)
if pgrep -x "$APP" >/dev/null 2>&1; then
  echo "⏹️  Fechando o JapKnock aberto…"
  pkill -x "$APP" 2>/dev/null || true
  sleep 1
  pkill -9 -x "$APP" 2>/dev/null || true
fi

# 6. Monta o .dmg, substitui o app, desmonta
echo "💿 Instalando em /Applications…"
mkdir -p "$TMP/mnt"
hdiutil attach "$TMP/$ASSET" -nobrowse -quiet -mountpoint "$TMP/mnt"
rm -rf "$APP_PATH"
cp -R "$TMP/mnt/${APP}.app" /Applications/
hdiutil detach "$TMP/mnt" -quiet

# 7. Remove a quarentena → SEM "Abrir Mesmo Assim"
xattr -dr com.apple.quarantine "$APP_PATH" 2>/dev/null || true

# 8. Reabre
open "$APP_PATH"
echo "✅ JapKnock atualizado pra $TAG e reaberto."
