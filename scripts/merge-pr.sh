#!/bin/bash

# Script para criar e fazer merge de PR
# Uso: ./scripts/merge-pr.sh --name "Título do PR"
# Se --name não for fornecido, usa a mensagem do último commit (exceto bump de versão)

set -e

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

# Pega branch atual
CURRENT_BRANCH=$(git branch --show-current)

if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ]; then
  echo "❌ Você está na branch main/master!"
  echo "Crie uma feature branch primeiro: git checkout -b feature/sua-feature"
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
echo "Próximos passos:"
echo "  git checkout main"
echo "  git pull"
echo "  git branch -d $CURRENT_BRANCH  # Se quiser deletar a branch local"
