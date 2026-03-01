FROM node:20-alpine AS builder

WORKDIR /app

# Build arg for WebSocket server URL
ARG VITE_WS_URL
ENV VITE_WS_URL=$VITE_WS_URL

# Copy all package files
COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages/shared/ ./packages/shared/
COPY packages/mobile/ ./packages/mobile/

# Create stubs for other packages
RUN mkdir -p packages/desktop packages/server
COPY packages/desktop/package.json ./packages/desktop/
COPY packages/server/package.json ./packages/server/

# Install dependencies
RUN npm install --ignore-scripts

# Build shared package
RUN npm run build -w @paddlelink/shared

# Build mobile app
RUN npm run build -w @paddlelink/mobile

# Production stage - serve static files
FROM node:20-alpine

WORKDIR /app

# Install serve for static file hosting
RUN npm install -g serve

# Copy built files
COPY --from=builder /app/packages/mobile/dist ./dist

EXPOSE 5173

CMD ["serve", "-s", "dist", "-l", "5173"]
