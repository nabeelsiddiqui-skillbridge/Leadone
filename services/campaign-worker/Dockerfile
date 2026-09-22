# Standalone always-on worker - polls the database on an interval and
# enqueues/processes BullMQ jobs against Redis. Run as a long-lived
# container; no public endpoint needed (outbound only, to Supabase, Redis,
# and this app's own /api/calls).

FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

CMD ["node", "dist/index.js"]
