const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");

const productCategories = require("./data/productCategories.json");
const transportDatabase = require("./data/transport_database.json");
const portDistances = require("./data/port_distances.json");
const { classifyProduct , classifyBOM , classifyManufacturingProcess } = require("./utils/chatGPTUtils");

dotenv.config();
const app = express();

// Middleware to parse JSON
app.use(express.json());

app.use(
  cors({
    origin: "*", // Allow both origins
  })
);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

//product route
const productRoutes = require("./routes/productRoutes");
app.use("/api/products", productRoutes);

//project route
const projectRoutes = require("./routes/projectRoutes");
app.use("/api/projects", projectRoutes);

//product-project mapping route
const projectProductRoutes = require('./routes/project_product_routes');
app.use('/api/project-product-mapping', projectProductRoutes);

// API Route
app.post("/api/classify-product", async (req, res) => {
  try {
    const { productCode, description, name } = req.body;
    const result = await classifyProduct(productCode, name, description);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Endpoint for classification of manufacturing process
app.post("/api/classify-manufacturing-process", async (req, res) => {
  const { productCode, name, description, bom,  } = req.body;

  if (!productCode || !name || !description || !bom) {
    return res.status(400).json({
      error: "Product code, name, description, and Bill of Materials are required.",
    });
  }

  try {
    const result = await classifyManufacturingProcess(productCode, name, description, bom, );
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: "An error occurred while processing your request.",
      details: error.message,
    });
  }
});

app.post("/api/classify-bom", async (req, res) => {
  const { productCode, name, description, weight } = req.body;

  if (!productCode || !name || !description || weight === undefined) {
    return res.status(400).json({
      error: "Product code, name, description, and weight are required.",
    });
  }

  try {
    const result = await classifyBOM(
      productCode,
      name,
      description,
      weight
    );

    const totalWeightCalculated = result.reduce(
      (sum, material) => sum + material.weight,
      0
    );
    if (Math.abs(totalWeightCalculated - weight) > 0.01) {
      return res.status(400).json({
        error: "Total weight of materials does not match the provided weight.",
      });
    }

    res.json(result);
  } catch (error) {
    res
      .status(500)
      .json({ error: "An error occurred while processing your request." });
  }
});

// Endpoint to return all categories only
app.get("/api/categories", (req, res) => {
  const categories = Object.keys(productCategories); // Extract keys (categories) only
  res.json(categories);
});

// Endpoint to return subcategories based on the given category
app.get("/api/subcategories", (req, res) => {
  const category = req.query.category;

  if (!category) {
    return res
      .status(400)
      .json({ error: "Category is required as a query parameter." });
  }

  const subcategories = productCategories[category];

  if (!subcategories) {
    return res.status(404).json({ error: "Category not found" });
  }

  res.json(subcategories);
});

// Endpoint to return subcategories based on the given category
app.get("/api/productCategories", (req, res) => {
  res.json(productCategories);
});

// Endpoint to return all countries
app.get("/api/countries", (req, res) => {
  const countries = Object.keys(transportDatabase); // Extract all countries
  res.json(countries);
});

app.get("/api/ports", (req, res) => {
  const { country } = req.query;

  if (!country) {
    return res
      .status(400)
      .json({ error: "Country is required as a query parameter." });
  }

  const ports = transportDatabase[country];

  if (!ports) {
    return res
      .status(404)
      .json({ error: "Country not found or has no ports." });
  }

  res.json(ports);
});

app.get("/api/transportDB", (req, res) => {
  res.json(transportDatabase);
});

// Endpoint to get distance
app.get("/api/distance", (req, res) => {
  const { origin, destination } = req.query;

  if (!origin || !destination) {
    return res
      .status(400)
      .json({ error: "Please provide both origin and destination ports." });
  }

  const originDistances = portDistances[origin];

  if (!originDistances) {
    return res
      .status(404)
      .json({ error: `Origin port '${origin}' not found.` });
  }

  const distance = originDistances[destination];

  if (distance === undefined) {
    return res
      .status(404)
      .json({
        error: `Destination port '${destination}' not found for origin '${origin}'.`,
      });
  }

  res.json({ origin, destination, distance_in_km: distance });
});

app.post("/api/calculate-transport-emission", (req, res) => {
  const EMISSION_FACTORS = {
    SeaFreight: 0.01,
    RoadFreight: 0.16,
    RailFreight: 0.05,
    AirFreight: 0.85,
  };

  try {
    const { weightKg, transportMode, transportKm } = req.body;

    // Input validation
    if (!weightKg || !transportMode || !transportKm) {
      return res.status(400).json({
        error: "Missing required parameters",
      });
    }

    if (!EMISSION_FACTORS[transportMode]) {
      return res.status(400).json({
        error: "Invalid transport mode",
      });
    }

    // Convert weight to tons
    const weightTon = weightKg / 1000;

    // Calculate emission
    const emissionFactor = EMISSION_FACTORS[transportMode];
    const totalEmission = weightTon * transportKm * emissionFactor;

    return res.json({
      transportEmissions: totalEmission.toFixed(2),
      unit: "kg CO₂eq/unit",
      calculationMetadata: {
        weightTon,
        transportMode,
        transportKm,
        emissionFactor,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: "Calculation error",
      details: error.message,
    });
  }
});

module.exports = {
  classifyProduct,
};
