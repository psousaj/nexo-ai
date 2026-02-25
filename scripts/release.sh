#!/bin/bash

# Script para criar PR, fazer merge e lançar tag de release
# Uso: ./scripts/release.sh [--name "Título do PR"]
# Se --name não for fornecido, usa a mensagem do último commit

set -e

# Executa lint com Biome para garantir que tudo está ok antes da release
echo "🔍 Rodando validações de código (pnpm check)..."
pnpm check
echo "✅ Validações de lint OK!"
echo ""

# Push da branch atual antes de qualquer coisa
echo "🚀 Fazendo push da branch atual..."
CURRENT_BRANCH=$(git branch --show-current)
git push origin "$CURRENT_BRANCH" --set-upstream || {
  echo "⚠️  Erro no push, mas continuando..."
}
echo ""

# Parse arguments
TITLE=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --name)
      TITLE="$2"
      shift 2
      ;;
    *)
      echo "Opção desconhecida: $1"
      echo "Uso: $0 --name \"Título do PR\""
      exit 1
      ;;
  esac
done

# Se não forneceu título, pega do último commit (excluindo bumps)
if [ -z "$TITLE" ]; then
  echo "📝 Buscando título do último commit..."
  
  # Pega últimos 10 commits e filtra os que não são bump
  TITLE=$(git log -10 --pretty=format:"%s" | grep -v -i -E "(bump|version|chore\(release\)|release:)" | head -n 1)
  
  if [ -z "$TITLE" ]; then
    echo "❌ Não foi possível encontrar um commit válido"
    echo "Use: $0 --name \"Título do PR\""
    exit 1
  fi
  
  echo "✅ Usando: $TITLE"
fi

if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ]; then
  echo "❌ Você está na branch main/master!"
  echo "Crie uma feature branch primeiro: git switch -c feature/sua-feature"
  exit 1
fi

echo ""
echo "🚀 Criando PR..."
echo "   Branch: $CURRENT_BRANCH"
echo "   Título: $TITLE"
echo ""

# Cria PR (assume que já fez push)
if ! gh pr create --title "$TITLE" --body "Auto-generated PR" --fill; then
  echo ""
  echo "⚠️  PR já existe ou erro ao criar. Tentando fazer merge..."
fi

echo ""
echo "🔀 Fazendo merge do PR..."

# Faz merge mantendo branch local
gh pr merge --merge --delete-branch=false

echo ""
echo "✅ PR mergeado com sucesso!"
echo "📦 Branch local '$CURRENT_BRANCH' mantida"
echo ""

# Cria e pusha tag de release baseada na versão do monorepo
VERSION=$(node -p "require('$(git rev-parse --show-toplevel)/package.json').version" 2>/dev/null || echo "")

if [ -n "$VERSION" ]; then
  TAG="v${VERSION}"
  echo "🏷️  Criando tag ${TAG}..."
  # Detecta branch principal (main ou master)
  DEFAULT_BRANCH=$(git remote show origin 2>/dev/null | grep 'HEAD branch' | awk '{print $NF}')
  DEFAULT_BRANCH="${DEFAULT_BRANCH:-main}"
  git switch "$DEFAULT_BRANCH"
  git pull
  git tag "$TAG"
  git push origin "$TAG"
  echo "✅ Tag ${TAG} criada e publicada!"
  echo ""
  echo "↩️  Voltando para '$CURRENT_BRANCH'..."
  git switch "$CURRENT_BRANCH"
else
  echo "⚠️  Não foi possível detectar versão para criar tag"
fi
