FROM node:20-alpine

WORKDIR /app

# Copy all package files for workspace resolution
COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages/shared/ ./packages/shared/
COPY packages/server/ ./packages/server/

# Create empty directories for other packages (needed for workspace resolution)
RUN mkdir -p packages/mobile packages/desktop
COPY packages/mobile/package.json ./packages/mobile/
COPY packages/desktop/package.json ./packages/desktop/

# Install all dependencies
RUN npm install --ignore-scripts

# Build shared package first
RUN npm run build -w @paddlelink/shared

# Build server
RUN npm run build -w @paddlelink/server

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "packages/server/dist/index.js"]
