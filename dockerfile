FROM node:18

# Install LibreOffice
RUN apt-get update && apt-get install -y libreoffice && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm install
COPY server ./

RUN npx prisma migrate dev --name init_migrateion
RUN npx prisma generate

EXPOSE 3000

# Set environment variables for database connections
ENV MSSQL_HOST=sql1
ENV MSSQL_PORT=1433
ENV MONGO_URI=mongodb://test-mong:27017/princenter

# Start the application
CMD ["node", "app.js"]
