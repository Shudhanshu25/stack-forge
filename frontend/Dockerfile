# React app: built with Vite, served as static files by nginx (unprivileged, port 8080).
# Build context is the repository root: docker build -f frontend/Dockerfile .
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace frontend --include-workspace-root
COPY shared shared
COPY frontend frontend
# Behind the reverse proxy the API lives on the same origin under /api/v1.
ARG VITE_API_URL=/api/v1
ARG VITE_SENTRY_DSN=
ARG VITE_RELEASE_SHA=local
ENV VITE_API_URL=${VITE_API_URL} VITE_SENTRY_DSN=${VITE_SENTRY_DSN} VITE_RELEASE_SHA=${VITE_RELEASE_SHA}
RUN npm run build -w frontend

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 8080
