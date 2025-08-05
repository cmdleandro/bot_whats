# 1. Instalação de dependências
FROM node:20-alpine AS deps
WORKDIR /app

# Copia os arquivos de dependências
COPY package.json package-lock.json* ./

# Instala apenas as dependências necessárias para build
RUN npm install --frozen-lockfile

# 2. Build da aplicação
FROM node:20-alpine AS builder
WORKDIR /app

# Copia dependências instaladas e o código-fonte
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Gera o build otimizado do Next.js
RUN npm run build

# 3. Imagem final para produção
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# ✅ Copia node_modules para permitir o uso de 'next start'
COPY --from=builder /app/node_modules ./node_modules

# ✅ Copia os arquivos públicos e de build
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# ✅ Copia o package.json para eventuais logs ou diagnósticos
COPY --from=builder /app/package.json ./package.json

# Expõe a porta 3001, usada no package.json: "start": "next start -p 3001"
EXPOSE 3001

# Inicia o app via script do package.json
CMD ["npm", "start"]
