FROM --platform=linux/amd64 node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files first (for better caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy app source code
COPY . .

# Create required directories
RUN mkdir -p uploads logs

# Expose the port the app runs on
EXPOSE 21004

# Command to run the application
CMD ["node", "server.js"]

# Build command (commented for reference):
# docker build --platform linux/amd64 -t iviva.azurecr.io/services/lca-microservice:v1 .
# 
# Push command (commented for reference):
# docker push iviva.azurecr.io/services/lca-microservice:v1
#
# Run command example (commented for reference):
# docker run -e PORT=21004 -e MONGODB_URI='' -e CORS_ORIGIN='*' iviva.azurecr.io/services/lca-microservice:v1