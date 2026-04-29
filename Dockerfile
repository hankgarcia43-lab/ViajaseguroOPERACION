FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN npm ci --include=dev

COPY tsconfig.base.json ./tsconfig.base.json
COPY apps/api ./apps/api
COPY packages ./packages

RUN npm run prisma:generate --workspace @viajaseguro/api \
  && npm run build --workspace @viajaseguro/api

ENV NODE_ENV=production
EXPOSE 4000

CMD ["npm", "run", "start", "--workspace", "@viajaseguro/api"]
