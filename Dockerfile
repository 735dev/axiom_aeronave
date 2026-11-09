# syntax=docker/dockerfile:1
# Frontend estatico: build con node, servido por nginx sin privilegios (puerto 8080, usuario no-root).
ARG NODE_IMAGE=node:22-alpine@sha256:0e1754758c2df4cfa3e68d59e2e1b7374bb7fd9ea6328eaaacf15cc934af8202
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.27-alpine@sha256:65e3e85dbaed8ba248841d9d58a899b6197106c23cb0ff1a132b7bfe0547e4c0

FROM ${NODE_IMAGE} AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
# Variables VITE_* se hornean en el bundle PUBLICO: nunca poner secretos aqui.
ARG VITE_PUBLIC_URL_API
ARG VITE_PUBLIC_URL_VERSION=/v1
ENV VITE_PUBLIC_URL_API=${VITE_PUBLIC_URL_API} \
    VITE_PUBLIC_URL_VERSION=${VITE_PUBLIC_URL_VERSION} \
    VITE_PUBLIC_USE_MOCKS=false
RUN test -n "$VITE_PUBLIC_URL_API" && npx vite build

FROM ${NGINX_IMAGE} AS runtime
# Parches de Alpine publicados despues del digest fijado (Trivy los marca); se re-evalua en cada bump del digest.
USER 0
RUN apk upgrade --no-cache
COPY --chown=101:101 deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build --chown=101:101 /src/build /usr/share/nginx/html
USER 101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/healthz"]
