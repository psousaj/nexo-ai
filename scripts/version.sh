#!/bin/bash

# Script para bumpar versão do monorepo
# Uso: ./scripts/version.sh [patch|minor|major]
#
# Exemplos:
#   ./scripts/version.sh patch   → 0.5.4 → 0.5.5
#   ./scripts/version.sh minor   → 0.5.4 → 0.6.0
#   ./scripts/version.sh major   → 0.5.4 → 1.0.0

set -e

BUMP="${1:-patch}"

if [[ "$BUMP" != "patch" && "$BUMP" != "minor" && "$BUMP" != "major" ]]; then
  echo "❌ Tipo inválido: '$BUMP'"
  echo "Uso: $0 [patch|minor|major]"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Lê versão atual da raiz
CURRENT=$(node -p "require('./package.json').version")

# Calcula nova versão
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
case $BUMP in
  major) NEW_VERSION="$((MAJOR + 1)).0.0" ;;
  minor) NEW_VERSION="${MAJOR}.$((MINOR + 1)).0" ;;
  patch) NEW_VERSION="${MAJOR}.${MINOR}.$((PATCH + 1))" ;;
esac

echo "📦 Bumping ${BUMP}: ${CURRENT} → ${NEW_VERSION}"
echo ""

# Lista de package.json para atualizar (exclui old-dashboard e node_modules)
PACKAGES=(
  "package.json"
  "apps/api/package.json"
  "apps/dashboard/package.json"
  "apps/landing/package.json"
  "packages/auth/package.json"
  "packages/env/package.json"
  "packages/eslint-config/package.json"
  "packages/otel/package.json"
  "packages/prettier-config/package.json"
  "packages/shared/package.json"
  "packages/typescript-config/package.json"
)

for pkg in "${PACKAGES[@]}"; do
  if [[ -f "$ROOT/$pkg" ]]; then
    # Substitui "version": "X.X.X" ignorando pacotes sem campo version
    if grep -q '"version"' "$ROOT/$pkg"; then
      node -e "
        const fs = require('fs');
        const p = '$ROOT/$pkg';
        const json = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (json.version) {
          json.version = '$NEW_VERSION';
          fs.writeFileSync(p, JSON.stringify(json, null, '\t') + '\n');
          console.log('  ✅ ' + p.replace('$ROOT/', ''));
        }
      "
    fi
  fi
done

echo ""

# Commit
git add "${PACKAGES[@]}"
git commit -m "chore: bump version to ${NEW_VERSION}"
echo ""
echo "✅ Versão ${NEW_VERSION} commitada!"
echo ""
echo "Próximos passos opcionais:"
echo "  git tag v${NEW_VERSION} && git push origin v${NEW_VERSION}"
echo "  ./scripts/merge-pr.sh --name \"chore: release v${NEW_VERSION}\""
