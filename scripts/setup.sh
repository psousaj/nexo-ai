#!/bin/bash

# Script de setup inicial do Nexo AI

echo "🚀 Nexo AI - Setup Inicial"
echo ""

# 1. Instalar dependências
echo "📦 Instalando dependências..."
bun install

# 2. Copiar .env.example se não existir .env
if [ ! -f .env ]; then
  echo "📝 Criando arquivo .env..."
  cp .env.example .env
  echo "⚠️  IMPORTANTE: Edite o arquivo .env com suas credenciais!"
  echo ""
else
  echo "✅ Arquivo .env já existe"
fi

# 3. Aguardar confirmação para continuar
echo ""
read -p "Você configurou o arquivo .env? (s/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Ss]$ ]]; then
  echo "Configure o .env e rode este script novamente."
  exit 1
fi

# 4. Gerar migrations
echo ""
echo "🗄️  Gerando migrations do banco..."
bun run db:generate

# 5. Aplicar migrations
echo ""
echo "📊 Aplicando migrations no banco..."
bun run db:push

# 6. Sucesso
echo ""
echo "✅ Setup concluído!"
echo ""
echo "Para rodar o servidor:"
echo "  bun run dev"
echo ""
echo "Documentação da API estará em:"
echo "  http://localhost:3000/swagger"
echo ""
