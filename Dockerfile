# Dockerfile
FROM node:22-slim AS builder

RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:22-slim AS production

WORKDIR /app

COPY --from=builder --chown=node:node /app/.output ./.output

# The node images ship an unprivileged `node` user (uid 1000). Nitro serves
# from .output and writes nothing at runtime, and 3000 is unprivileged, so
# there is nothing here that needs root -- and RCE in the server then starts
# from uid 1000 rather than owning the container.
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "const http = require('http'); http.get('http://localhost:3000', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

EXPOSE 3000
ENV HOST=0.0.0.0
ENV PORT=3000
CMD ["node", ".output/server/index.mjs"]
