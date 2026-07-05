# ---- build stage ----
FROM node:26-slim AS build
WORKDIR /app

# Install all workspace dependencies (better-sqlite3 builds natively here).
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci

# Build shared -> server -> client.
COPY tsconfig.base.json ./
COPY shared/ shared/
COPY server/ server/
COPY client/ client/
RUN npm run build --workspace=shared \
 && npm run build --workspace=server \
 && npm run build --workspace=client

# Keep only production dependencies.
RUN npm prune --omit=dev

# ---- runtime stage ----
FROM node:26-slim
WORKDIR /app

ENV NODE_ENV=production \
    DATA_DIR=/config \
    STATIC_DIR=/app/client/dist \
    PORT=3000

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/shared/package.json ./shared/package.json
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/client/dist ./client/dist

EXPOSE 3000
VOLUME ["/config"]

CMD ["node", "server/dist/index.js"]
