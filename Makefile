.PHONY: help dev build start test test-watch test-ui db-generate db-push db-studio clean install format format-check version-patch version-minor version-major

# Cores para output
GREEN  := \033[0;32m
YELLOW := \033[0;33m
BLUE   := \033[0;34m
RESET  := \033[0m

help: ## Mostra esta mensagem de ajuda
	@echo "$(BLUE)Nexo AI - Comandos disponíveis$(RESET)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-15s$(RESET) %s\n", $$1, $$2}'

# Desenvolvimento
dev: ## Inicia servidor em modo desenvolvimento (watch)
	@echo "$(YELLOW)🚀 Iniciando servidor em modo dev...$(RESET)"
	pnpm run dev

build: ## Faz build do projeto
	@echo "$(YELLOW)🔨 Fazendo build...$(RESET)"
	pnpm run build

start: ## Inicia servidor em modo produção
	@echo "$(YELLOW)🚀 Iniciando servidor...$(RESET)"
	pnpm run start

# Database
db-generate: ## Gera migrations do Drizzle
	@echo "$(YELLOW)📦 Gerando migrations...$(RESET)"
	pnpm run db:generate

db-push: ## Aplica migrations no banco
	@echo "$(YELLOW)📤 Aplicando migrations...$(RESET)"
	pnpm run db:push

db-studio: ## Abre Drizzle Studio
	@echo "$(YELLOW)🎨 Abrindo Drizzle Studio...$(RESET)"
	pnpm run db:studio

# Testes
test: ## Roda todos os testes
	@echo "$(YELLOW)🧪 Rodando testes...$(RESET)"
	pnpm run test

test-watch: ## Roda testes em modo watch
	@echo "$(YELLOW)🧪 Rodando testes em modo watch...$(RESET)"
	pnpm run test:watch

test-ui: ## Abre UI do Vitest
	@echo "$(YELLOW)🧪 Abrindo UI do Vitest...$(RESET)"
	pnpm run test:ui

# Utils
install: ## Instala dependências
	@echo "$(YELLOW)📦 Instalando dependências...$(RESET)"
	pnpm install

clean: ## Limpa arquivos de build
	@echo "$(YELLOW)🧹 Limpando...$(RESET)"
	rm -rf dist node_modules .next

format: ## Formata código com Biome
	@echo "$(YELLOW)✨ Formatando código...$(RESET)"
	pnpm run check:fix

format-check: ## Checa formatação com Biome
	@echo "$(YELLOW)🔍 Checando formatação...$(RESET)"
	pnpm run check

# Versioning
version-patch: ## Incrementa versão patch (0.0.X)
	@echo "$(YELLOW)📦 Incrementando versão patch...$(RESET)"
	pnpm version patch

version-minor: ## Incrementa versão minor (0.X.0)
	@echo "$(YELLOW)📦 Incrementando versão minor...$(RESET)"
	pnpm version minor

version-major: ## Incrementa versão major (X.0.0)
	@echo "$(YELLOW)📦 Incrementando versão major...$(RESET)"
	pnpm version major
