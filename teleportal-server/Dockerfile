# Build stage
FROM node:20-slim AS builder

# Install pnpm
# Pinned exactly rather than `pnpm@12`, so an image rebuilt months from now
# installs the same package manager it was tested with.
RUN npm install -g pnpm@12.5.1

WORKDIR /app

# pnpm-workspace.yaml carries shamefullyHoist (which Teleportal's module
# resolution needs) and the allowBuilds decisions pnpm 12 requires. Without it
# here the install fails ERR_PNPM_IGNORED_BUILDS.
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./

# Hoisting now comes from pnpm-workspace.yaml rather than the --shamefully-hoist
# flag, which pnpm 12 no longer documents.
RUN pnpm install

# Copy source and build
COPY . .
RUN pnpm run build

# Production stage
FROM node:20-slim

# Install wget for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends wget && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built files and production dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# The server itself falls back to 1235 when PORT is unset, which would leave
# the container listening on a port nothing is mapped to while still looking
# healthy. Default it to the port we EXPOSE; compose can still override it.
ENV PORT=3000

# Expose default port
EXPOSE 3000

# Start the server
CMD ["node", "dist/src/server.js"]
