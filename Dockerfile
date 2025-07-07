# Use Node.js 18 LTS as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p downloaded_documents temp_downloads temp_conversions vector_indexes

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
