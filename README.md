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

#### Get All Products
```bash
curl -X GET http://localhost:21004/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Get Product by ID
```bash
curl -X GET http://localhost:21004/api/products/60d21b4667d0d8992e610c85 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Create a New Product
```bash
curl -X POST http://localhost:21004/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "code": "PROD-001",
    "name": "Product Name",
    "description": "Product Description",
    "weight": 10,
    "countryOfOrigin": "USA",
    "category": "Electronics",
    "subCategory": "Computers",
    "supplierName": "Supplier Inc.",
    "materials": [
      {
        "materialClass": "Metal",
        "specificMaterial": "Aluminum",
        "weight": 5,
        "unit": "kg",
        "emissionFactor": 8.2
      }
    ],
    "productManufacturingProcess": [
      {
        "materialClass": "Metal",
        "specificMaterial": "Aluminum",
        "weight": 5,
        "emissionFactor": 1.2,
        "manufacturingProcesses": [
          {
            "category": "Cutting",
            "processes": ["Laser cutting", "CNC machining"]
          }
        ]
      }
    ]
  }'
```

#### Update a Product
```bash
curl -X PUT http://localhost:21004/api/products/60d21b4667d0d8992e610c85 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Updated Product Name",
    "description": "Updated Product Description"
  }'
```

#### Delete a Product
```bash
curl -X DELETE http://localhost:21004/api/products/60d21b4667d0d8992e610c85 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Delete All Products
```bash
curl -X DELETE http://localhost:21004/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Projects

#### Get All Projects
```bash
curl -X GET http://localhost:21004/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Get Project by ID
```bash
curl -X GET http://localhost:21004/api/projects/60d21b4667d0d8992e610c85 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Create a New Project
```bash
curl -X POST http://localhost:21004/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Project Name",
    "description": "Project Description",
    "client": "Client Name",
    "location": "Project Location",
    "startDate": "2023-01-01",
    "endDate": "2023-12-31"
  }'
```

#### Update a Project
```bash
curl -X PUT http://localhost:21004/api/projects/60d21b4667d0d8992e610c85 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Updated Project Name",
    "description": "Updated Project Description"
  }'
```

#### Delete a Project
```bash
curl -X DELETE http://localhost:21004/api/projects/60d21b4667d0d8992e610c85 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Project-Product Mappings

#### Create Project-Product Mapping (Multiple Products)
```bash
curl -X POST http://localhost:21004/api/project-product-mapping \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "projectID": "60d21b4667d0d8992e610c85",
    "products": [
      {
        "productID": "60d21b4667d0d8992e610c86",
        "packagingWeight": 1.5,
        "palletWeight": 5,
        "totalTransportationEmission": 125.6,
        "transportationLegs": [
          {
            "transportMode": "Truck",
            "originCountry": "China",
            "destinationCountry": "India",
            "originGateway": "Shanghai",
            "destinationGateway": "Mumbai",
            "transportEmission": 78.3,
            "transportDistance": 4500
          },
          {
            "transportMode": "Ship",
            "originCountry": "USA",
            "destinationCountry": "UK",
            "originGateway": "Los Angeles",
            "destinationGateway": "London",
            "transportEmission": 47.3,
            "transportDistance": 8900
          }
        ]
      },
      {
        "productID": "60d21b4667d0d8992e610c87",
        "packagingWeight": 0.8,
        "palletWeight": 3,
        "totalTransportationEmission": 85.2,
        "transportationLegs": [
          {
            "transportMode": "Air",
            "originCountry": "Germany",
            "destinationCountry": "USA",
            "originGateway": "Frankfurt",
            "destinationGateway": "New York",
            "transportEmission": 85.2,
            "transportDistance": 6300
          }
        ]
      }
    ]
  }'
```

#### Get All Project-Product Mappings
```bash
curl -X GET http://localhost:21004/api/project-product-mapping \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Get Project-Product Mapping by ID
```bash
curl -X GET http://localhost:21004/api/project-product-mapping/60d21b4667d0d8992e610c88 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Get Project-Product Mappings by Project ID
```bash
curl -X GET http://localhost:21004/api/project-product-mapping/project/60d21b4667d0d8992e610c85 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Get Project-Product Mappings by Product ID
```bash
curl -X GET http://localhost:21004/api/project-product-mapping/product/60d21b4667d0d8992e610c86 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Update Project-Product Mapping
```bash
curl -X PUT http://localhost:21004/api/project-product-mapping/60d21b4667d0d8992e610c88 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "products": [
      {
        "productID": "60d21b4667d0d8992e610c86",
        "packagingWeight": 2.0,
        "palletWeight": 6,
        "totalTransportationEmission": 130.5,
        "transportationLegs": [
          {
            "transportMode": "Truck",
            "originCountry": "China",
            "destinationCountry": "India",
            "originGateway": "Shanghai",
            "destinationGateway": "Mumbai",
            "transportEmission": 80.1,
            "transportDistance": 4500
          },
          {
            "transportMode": "Ship",
            "originCountry": "USA",
            "destinationCountry": "UK",
            "originGateway": "Los Angeles",
            "destinationGateway": "London",
            "transportEmission": 50.4,
            "transportDistance": 8900
          }
        ]
      }
    ]
  }'
```

#### Add Product to Existing Project Mapping
```bash
curl -X POST http://localhost:21004/api/project-product-mapping/60d21b4667d0d8992e610c88/product \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "productID": "60d21b4667d0d8992e610c89",
    "packagingWeight": 1.2,
    "palletWeight": 4.5,
    "totalTransportationEmission": 92.7,
    "transportationLegs": [
      {
        "transportMode": "Train",
        "originCountry": "France",
        "destinationCountry": "Germany",
        "originGateway": "Paris",
        "destinationGateway": "Berlin",
        "transportEmission": 45.3,
        "transportDistance": 1050
      },
      {
        "transportMode": "Truck",
        "originCountry": "Germany",
        "destinationCountry": "Poland",
        "originGateway": "Berlin",
        "destinationGateway": "Warsaw",
        "transportEmission": 47.4,
        "transportDistance": 575
      }
    ]
  }'
```

#### Remove Product from Project Mapping
```bash
curl -X DELETE http://localhost:21004/api/project-product-mapping/60d21b4667d0d8992e610c88/product/60d21b4667d0d8992e610c89 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Delete Project-Product Mapping
```bash
curl -X DELETE http://localhost:21004/api/project-product-mapping/60d21b4667d0d8992e610c88 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Delete All Project-Product Mappings for a Project
```bash
curl -X DELETE http://localhost:21004/api/project-product-mapping/project/60d21b4667d0d8992e610c85 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Calculation Endpoints

#### Classify a Product
```bash
curl -X POST http://localhost:21004/api/classify-product \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "productName": "LED Television",
    "productDescription": "55 inch 4K Ultra HD Smart LED TV"
  }'
```

#### Classify a Bill of Materials
```bash
curl -X POST http://localhost:21004/api/classify-bom \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "bomItems": [
      {
        "name": "Aluminum frame",
        "description": "Lightweight aluminum enclosure",
        "weight": 2.5
      },
      {
        "name": "LED panel",
        "description": "LCD display with LED backlight",
        "weight": 5.2
      }
    ]
  }'
```

#### Classify Manufacturing Processes
```bash
curl -X POST http://localhost:21004/api/classify-manufacturing-process \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "material": "Aluminum",
    "description": "CNC machining of aluminum housing"
  }'
```

#### Calculate Distance Between Locations
```bash
curl -X POST http://localhost:21004/api/distance \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "origin": "New York, USA",
    "destination": "London, UK",
    "mode": "air"
  }'
```

#### Calculate Transport Emissions
```bash
curl -X POST http://localhost:21004/api/calculate-transport-emission \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "weight": 1000,
    "distance": 5000,
    "mode": "sea",
    "productType": "electronics"
  }'
```