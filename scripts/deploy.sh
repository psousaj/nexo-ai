#!/bin/bash

# Script de deploy para Cloudflare Workers

echo "🚀 Nexo AI - Deploy para Cloudflare Workers"
echo ""

# 1. Verificar se está logado no Wrangler
echo "🔐 Verificando autenticação..."
if ! wrangler whoami &> /dev/null; then
  echo "❌ Não autenticado no Wrangler"
  echo "Execute: wrangler login"
  exit 1
fi

echo "✅ Autenticado"
echo ""

# 2. Build
echo "🔨 Fazendo build..."
bun run build

if [ $? -ne 0 ]; then
  echo "❌ Erro no build"
  exit 1
fi

echo "✅ Build concluído"
echo ""

# 3. Verificar secrets
echo "🔑 Verificando secrets..."
echo ""
echo "Certifique-se de ter configurado os seguintes secrets:"
echo "  - DATABASE_URL"
echo "  - META_WHATSAPP_TOKEN"
echo "  - META_WHATSAPP_PHONE_NUMBER_ID"
echo "  - META_VERIFY_TOKEN"
echo "  - ANTHROPIC_API_KEY"
echo "  - TMDB_API_KEY"
echo "  - YOUTUBE_API_KEY"
echo ""
echo "Para configurar: wrangler secret put SECRET_NAME"
echo ""

read -p "Secrets configurados? (s/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Ss]$ ]]; then
  echo "Configure os secrets e rode este script novamente."
  exit 1
fi

# 4. Deploy
echo ""
echo "🚢 Fazendo deploy..."
wrangler deploy

if [ $? -ne 0 ]; then
  echo "❌ Erro no deploy"
  exit 1
fi

echo ""
echo "✅ Deploy concluído!"
echo ""
echo "Próximos passos:"
echo "1. Configure o webhook do WhatsApp:"
echo "   URL: https://nexo-ai.SEU-SUBDOMINIO.workers.dev/webhook/meta"
echo "2. Teste enviando uma mensagem via WhatsApp"
echo "3. Monitore logs: wrangler tail"
echo ""
