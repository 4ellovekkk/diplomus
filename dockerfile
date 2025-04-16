
# Build Stage
FROM node:18-alpine AS build

# Set working directory
WORKDIR /app

# Install necessary system dependencies
RUN apk add --no-cache \
  libreoffice \
  ca-certificates \
  vim

# Copy package.json and package-lock.json first to leverage Docker cache
COPY server/package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy the rest of the application
COPY server .

# Generate Prisma client
RUN npx prisma generate

# Set proper permissions
RUN chown -R node:node /app && chmod -R 755 /app

# Runtime Stage
FROM node:18-alpine AS runtime

WORKDIR /app

# Copy built application from build stage
COPY --from=build /app /app

RUN mkdir /app/uploads
# Set environment variables
ENV NODE_ENV=production
ENV DB_HOST_MSSQL=mssql
ENV DB_USER_MSSQL=sa
ENV DB_PASS_MSSQL="MyPassword123#"
ENV DB_HOST_MONGO=mongodb
ENV DB_USER_MONGO=root
ENV DB_PASS_MONGO=toor

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1

# Run as non-root user
USER node

# Start the application
CMD ["node", "app.js"]

