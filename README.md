# LCA Microservice

Life Cycle Assessment Microservice - API for calculating environmental impacts of products and projects.

## Project Structure

```
lca-microservice/
├── config/                     # Configuration files
│   ├── database.js             # Database configuration
│   └── environment.js          # Environment configuration
├── controllers/                # Route controllers
│   ├── product.controller.js   # Product endpoint handlers
│   └── ...                     # Other controllers
├── data/                       # Data files (JSON data)
│   ├── materials_database.json # Materials data
│   └── ...                     # Other data files
├── middlewares/                # Middleware functions
│   ├── auth.middleware.js      # Authentication middleware
│   └── error.middleware.js     # Error handling middleware
├── models/                     # Database models
│   ├── product_schema.js       # Product model
│   └── ...                     # Other models
├── routes/                     # Express routes
│   ├── product.routes.js       # Product routes
│   └── ...                     # Other routes
├── services/                   # Business logic
│   ├── product.service.js      # Product service
│   └── ...                     # Other services
├── utils/                      # Utility functions
│   ├── logger.js               # Logging utility
│   ├── http.js                 # HTTP utilities
│   └── helpers.js              # Helper functions
├── uploads/                    # Upload directory
├── .env                        # Environment variables
├── package.json                # Project dependencies
├── Dockerfile                  # Docker configuration
├── docker-compose.yml          # Docker Compose configuration
└── server.js                   # Entry point
```

## Setup

### Local Development

1. Clone the repository
2. Install dependencies
```
npm install
```
3. Create a `.env` file with the following variables:
```
PORT=21004
MONGODB_URI=mongodb://localhost:27017
NODE_ENV=development
CORS_ORIGIN=*
UPLOAD_DIR=uploads
```
4. Start the server
```
npm start
```

### Docker Deployment

#### Using Docker

1. Build the Docker image
```bash
docker build --platform linux/amd64 -t iviva.azurecr.io/services/lca-microservice:v1 .
```

2. Run the container
```bash
docker run -d -p 21004:21004 \
  -e PORT=21004 \
  -e MONGODB_URI='mongodb://your-mongodb-host:27017' \
  -e CORS_ORIGIN='*' \
  -e NODE_ENV='production' \
  iviva.azurecr.io/services/lca-microservice:v1
```

3. Push to Azure Container Registry
```bash
# Login to ACR
az acr login --name iviva

# Push the image
docker push iviva.azurecr.io/services/lca-microservice:v1
```

#### Using Docker Compose

1. Run with docker-compose (includes MongoDB)
```bash
docker-compose up -d
```

2. Stop containers
```bash
docker-compose down
```

### Deployment to Azure

1. Deploy to Azure Container Instances
```bash
az container create \
  --resource-group myResourceGroup \
  --name lca-microservice \
  --image iviva.azurecr.io/services/lca-microservice:v1 \
  --cpu 1 \
  --memory 1.5 \
  --registry-login-server iviva.azurecr.io \
  --registry-username <registry-username> \
  --registry-password <registry-password> \
  --environment-variables \
    PORT=21004 \
    MONGODB_URI='mongodb://<your-mongodb-host>:27017' \
    NODE_ENV='production' \
    CORS_ORIGIN='*' \
  --ports 21004
```

2. Deploy to Azure App Service
```bash
# Create App Service Plan
az appservice plan create --name lca-service-plan --resource-group myResourceGroup --sku B1 --is-linux

# Create Web App
az webapp create \
  --resource-group myResourceGroup \
  --plan lca-service-plan \
  --name lca-microservice \
  --deployment-container-image-name iviva.azurecr.io/services/lca-microservice:v1

# Configure environment variables
az webapp config appsettings set \
  --resource-group myResourceGroup \
  --name lca-microservice \
  --settings \
    PORT=21004 \
    MONGODB_URI='mongodb://<your-mongodb-host>:27017' \
    NODE_ENV='production' \
    CORS_ORIGIN='*'
```

## API Endpoints

### Products
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get product by ID
- `POST /api/products` - Create a new product
- `PUT /api/products/:id` - Update a product
- `DELETE /api/products/:id` - Delete a product
- `DELETE /api/products` - Delete all products

### Projects
- `GET /api/projects` - Get all projects
- `GET /api/projects/:id` - Get project by ID
- `POST /api/projects` - Create a new project
- `PUT /api/projects/:id` - Update a project
- `DELETE /api/projects/:id` - Delete a project

## Calculation Endpoints

- `POST /api/classify-product` - Classify a product
- `POST /api/classify-bom` - Classify a bill of materials
- `POST /api/classify-manufacturing-process` - Classify manufacturing processes
- `POST /api/distance` - Calculate distance between locations
- `POST /api/calculate-transport-emission` - Calculate transport emissions