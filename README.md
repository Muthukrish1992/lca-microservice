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
└── server.js                   # Entry point
```

## Setup

1. Clone the repository
2. Install dependencies
```
npm install
```
3. Create a `.env` file with the following variables:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017
NODE_ENV=development
```
4. Start the server
```
npm start
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