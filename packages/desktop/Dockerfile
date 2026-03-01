FROM node:20-alpine AS builder

WORKDIR /app

# Build arg for WebSocket server URL
ARG VITE_WS_URL
ENV VITE_WS_URL=$VITE_WS_URL

# Copy all package files
COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages/shared/ ./packages/shared/
COPY packages/desktop/ ./packages/desktop/

# Create stubs for other packages
RUN mkdir -p packages/mobile packages/server
COPY packages/mobile/package.json ./packages/mobile/
COPY packages/server/package.json ./packages/server/

# Install dependencies
RUN npm install --ignore-scripts

# Build shared package
RUN npm run build -w @paddlelink/shared

# Build desktop app
RUN npm run build -w @paddlelink/desktop

# Production stage - serve static files
FROM node:20-alpine

WORKDIR /app

# Install serve for static file hosting
RUN npm install -g serve

# Copy built files
COPY --from=builder /app/packages/desktop/dist ./dist

EXPOSE 5174

CMD ["serve", "-s", "dist", "-l", "5174"]
