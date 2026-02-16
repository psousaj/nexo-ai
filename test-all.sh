#!/bin/bash

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  NEXO AI - Test Suite Runner${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

FAILED=0
TOTAL_APPS=0

# Array de apps
APPS=("api" "dashboard")

for app in "${APPS[@]}"; do
  TOTAL_APPS=$((TOTAL_APPS + 1))
  APP_DIR="apps/$app"
  
  if [ ! -d "$APP_DIR" ]; then
    echo -e "${YELLOW}⚠️  App $app não encontrado, pulando...${NC}"
    continue
  fi
  
  echo -e "${BLUE}🧪 Rodando testes do app: $app${NC}"
  echo -e "${BLUE}───────────────────────────────────────────────────────${NC}"
  
  cd "$APP_DIR" || exit 1
  
  # Verifica se há testes
  TEST_FILES=$(find src/tests -type f \( -name "*.test.ts" -o -name "*.spec.ts" \) 2>/dev/null | wc -l)
  
  if [ "$TEST_FILES" -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Nenhum teste encontrado em $app${NC}"
    cd ../..
    echo ""
    continue
  fi
  
  echo -e "${GREEN}📁 Encontrados $TEST_FILES arquivos de teste${NC}"
  
  # Roda os testes
  if npm test 2>&1; then
    echo -e "${GREEN}✅ Testes do $app passaram!${NC}"
  else
    echo -e "${RED}❌ Testes do $app falharam!${NC}"
    FAILED=$((FAILED + 1))
  fi
  
  cd ../..
  echo ""
done

# Resumo
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Resumo${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ Todos os $TOTAL_APPS apps passaram nos testes!${NC}"
  exit 0
else
  echo -e "${RED}❌ $FAILED de $TOTAL_APPS apps falharam nos testes${NC}"
  exit 1
fi
