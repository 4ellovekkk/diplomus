# Build Stage
FROM node:18-alpine AS build

# Set working directory
WORKDIR /app

# Install necessary system dependencies (grouped by type)
RUN apk add --no-cache --virtual .build-deps \
    libreoffice \
    ca-certificates \
    && apk add --no-cache \
    vim

# Copy only files needed for dependency installation
COPY server/package*.json ./
COPY server/prisma/schema.prisma ./prisma/

# Install production dependencies (clean cache afterwards)
RUN npm install --omit=dev \
    && npm cache clean --force

# Copy the rest of the application (with .dockerignore in place)
COPY server .

# Generate Prisma client
RUN npx prisma generate

# Clean up build dependencies
RUN apk del .build-deps

# Set proper permissions in a single layer
RUN chown -R node:node /app && \
    chmod -R 755 /app && \
    mkdir -p /app/uploads && \
    chown node:node /app/uploads

# Runtime Stage
FROM node:18-alpine

WORKDIR /app

# Install only necessary runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    && mkdir -p /app/uploads \
    && chown node:node /app/uploads

# Copy from build stage with proper ownership
COPY --chown=node:node --from=build /app /app

# Environment variables (consider using secrets for sensitive data)
ENV NODE_ENV=production
ENV DB_HOST_MSSQL=mssql
ENV DB_USER_MSSQL=sa
ENV DB_PASS_MSSQL="MyPassword123#"
ENV DB_HOST_MONGO=mongodb
ENV DB_USER_MONGO=root
ENV DB_PASS_MONGO=toor
# Expose port
EXPOSE 3000

# Health check with proper path
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD node /app/healthcheck.js || exit 1

# Run as non-root user
USER node

# Install stripe-cli in runtime stage
RUN npm install -g stripe-cli

# Use a proper process manager for multiple processes
CMD ["sh", "-c", "node app.js & stripe listen --forward-to http://localhost:3000/checkout/webhook --skip-verify"]
