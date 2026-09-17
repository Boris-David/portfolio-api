# syntax=docker/dockerfile:1

# ──────────────────────────────────────────────────────────────────────────────
# Étage 1 — construction. C'est le SEUL étage qui contient un navigateur.
#
# Le CV est rendu ici, au moment où l'image se construit, donc au moment où le
# contenu change (ADR 0004). Ni Chromium ni Playwright ne descendent dans
# l'image finale : le poids du navigateur et son démarrage ne sont jamais payés
# par une requête de lecture, et une instance qui se réveille n'a rien d'autre
# à lancer que Node.
# ──────────────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# `--with-deps` installe les bibliothèques système de Chromium. Elles restent
# dans cet étage, qui est jeté.
RUN npx playwright install --with-deps chromium

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY scripts ./scripts
COPY content ./content
COPY design ./design
COPY assets ./assets

RUN npm run build && npm run build:cv

# ──────────────────────────────────────────────────────────────────────────────
# Étage 2 — l'image qui sert. Node, le contenu, et les PDF déjà rendus.
# ──────────────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/content ./content
COPY --from=builder /app/artifacts ./artifacts

# Cloud Run impose le port par l'environnement ; 8080 n'est que la valeur par
# défaut quand il ne le fait pas.
ENV PORT=8080
EXPOSE 8080

USER node

CMD ["node", "dist/src/server.js"]
