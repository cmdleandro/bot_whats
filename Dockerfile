# 1. Instalação de dependências
FROM node:20-alpine AS deps
WORKDIR /app

# Copia package.json e lockfile
COPY package.json package-lock.json* ./
# Instala dependências
RUN npm install

# 2. Build da aplicação
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Gera o build de produção do Next.js
RUN npm run build

# 3. Imagem de Produção
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copia os arquivos de build
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Expõe a porta e define o comando de start
EXPOSE 3000
CMD ["node", "server.js"]
