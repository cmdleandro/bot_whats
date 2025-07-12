# 1. Instalação de dependências
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

# 2. Build da aplicação
FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Variáveis de ambiente para o build, se necessário
# ENV NEXT_PUBLIC_API_URL="http://api.example.com"
RUN npm run build

# 3. Imagem de produção
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
# Se você estiver usando o Next.js 14 com o servidor standalone
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# O Genkit precisa do código fonte para funcionar
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json .
COPY --from=builder /app/tsconfig.json .
COPY --from=builder /app/next.config.ts .


EXPOSE 3000
ENV PORT 3000

# Comando para iniciar a aplicação
CMD ["node", "server.js"]
