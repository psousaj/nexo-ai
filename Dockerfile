FROM node:20-alpine AS build

WORKDIR /app


# Instala todas dependências (inclui dev para build)
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install

# Copia o restante do projeto
COPY . .

# Builda o projeto (ajuste para seu comando de build)
RUN pnpm run build

# Stage final para produção
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app /app

ENV NODE_ENV=production

# Exponha a porta usada pelo app
EXPOSE 3000

# Comando de inicialização (ajuste se o entrypoint for diferente)
CMD ["node", "dist/index.js"]

