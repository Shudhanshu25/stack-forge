# Node API and turn worker: one image, two targets.
# Build context is the repository root:
#   docker build -f backend/Dockerfile --target api .
#   docker build -f backend/Dockerfile --target worker .
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace backend --include-workspace-root
COPY shared shared
COPY backend backend
RUN npm run build -w backend

FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace backend --omit=dev && npm cache clean --force
# Schemas and templates are read at runtime (contract validation, startup templates).
COPY shared/schemas shared/schemas
COPY shared/templates shared/templates
COPY --from=build /app/backend/dist backend/dist
USER node
WORKDIR /app/backend

FROM runtime AS api
ENV PORT=4000
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD node -e "fetch('http://127.0.0.1:4000/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/server.js"]

FROM runtime AS worker
CMD ["node", "dist/worker.js"]
