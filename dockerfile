
# Use a minimal base image for building
FROM node:18-alpine AS build

# Set working directory
WORKDIR /app

# Install necessary system dependencies
RUN apk add --no-cache \
  libreoffice \
  ca-certificates \
  vim

# Copy package.json and package-lock.json first (leveraging Docker cache)
COPY server/package*.json ./

# Install only production dependencies (exclude devDependencies)
RUN npm install --omit=dev

# Copy the rest of the application
COPY server .

# Generate Prisma client
RUN npx prisma generate

# Set proper permissions
RUN chown -R node:node /app && chmod -R 755 /app

# Use a lightweight runtime image for production
FROM node:18-alpine AS runtime

WORKDIR /app

# Copy built application from build stage
COPY --from=build /app /app

RUN mkdir /app/uploads
# Set environment variables
ENV NODE_ENV=production
ENV MSSQL_HOST=sql1
ENV MSSQL_PORT=1433
ENV MONGO_URI=mongodb://test-mongo:27017/princenter
ENV STRIPE_API_KEY=""
ENV YANDEX_MAPS_API_KEY=""

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1

# Run as non-root user
USER node

# Start the application
CMD ["node", "app.js"]

