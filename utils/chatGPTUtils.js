const productCategories = require("../data/productCategories.json");
const axios = require("axios");

const classifyProduct = async (productCode, name, description) => {
    if (!name) {
      throw new Error("Product code, description, and name are required.");
    }
  
    // Dynamically generate categories list for the prompt
    const categoriesList = Object.entries(productCategories)
      .map(
        ([category, subcategories]) =>
          `${category}:\n  - ${subcategories.join("\n  - ")}`
      )
      .join("\n\n");
  
    // Construct prompt for classification
    const prompt = `Classify the following product into a category and subcategory. Ensure the subcategory is chosen strictly from the correct category listed below.
  
  Product Code: ${productCode}
  Product Name: ${name}
  Product Description: ${description}
  
  Categories and Subcategories:
  ${categoriesList}
  
  Return the result in this format:
  {
      "category": "<category>",
      "subcategory": "<subcategory>"
  }
  
  Ensure that the subcategory belongs to the category.`;
  
    try {
      // Send the prompt to OpenAI API
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
  
      // Parse and clean the response
      const chatCompletion = response.data.choices[0].message.content;
      const cleanedResponse = chatCompletion.replace(/```json|```/g, "").trim();
  
      // Convert response to JSON
      const result = JSON.parse(cleanedResponse);
  
      // Validate the subcategory within the chosen category
      const validSubcategories = productCategories[result.category] || [];
      if (!validSubcategories.includes(result.subcategory)) {
        console.log("Invalid subcategory for the given category.");
      }
  
      return result;
    } catch (error) {
      console.error("Classification Error:", error.response?.data || error.message);
      console.log("An error occurred while classifying the product.");
    }
  };

  module.exports = {
    classifyProduct,
    
};