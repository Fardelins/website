# syntax=docker/dockerfile:1

# --- Build stage: needs devDependencies (Angular CLI/build) ---
# node:22-alpine tracks the latest Node 22.x (>= 22.22.3, which the Angular CLI requires).
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json .npmrc ./
RUN npm ci --legacy-peer-deps

# Railway passes service variables as build args; prerender + sitemap read this at build time.
ARG PUBLIC_SITE_URL
ENV PUBLIC_SITE_URL=$PUBLIC_SITE_URL

COPY . .
RUN npm run build

# --- Runtime stage: only production deps + built output ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

COPY package*.json .npmrc ./
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

COPY --from=build /app/dist ./dist

EXPOSE 4000
CMD ["node", "dist/fardelins-app/server/server.mjs"]
