# Build stage
FROM node:20-slim AS builder

# Install pnpm
RUN npm install -g pnpm@10

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies with shamefully-hoist for Teleportal module resolution
RUN pnpm install --shamefully-hoist

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
