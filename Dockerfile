# Stage 1: Build frontend
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production runtime
FROM node:22-alpine AS runner
WORKDIR /app

ARG GIT_COMMIT=""
ARG BUILD_DATE=""
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data
ENV GIT_COMMIT=${GIT_COMMIT}
ENV BUILD_DATE=${BUILD_DATE}

RUN mkdir -p /app/data

COPY --from=builder /app/package.json ./
COPY --from=builder /app/server.js ./
COPY --from=builder /app/dist ./dist

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
