const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connections = {}; // Cache for database connections

const getDBConnection = async (account) => {
    if (!account) throw new Error('Account name is required');

    if (connections[account]) {
        return connections[account];
    }
    
    let MONGODB_URI = process.env.MONGODB_URI;
    
    // Handle MongoDB Atlas connection string specially
    if (MONGODB_URI.includes('mongodb+srv://')) {
        // For MongoDB Atlas, we need to handle the URI differently
        // Split the URI at the first ? to separate the connection string from the options
        const [baseUri, options] = MONGODB_URI.split('?');
        
        // Remove trailing slash if present
        const cleanBaseUri = baseUri.endsWith('/') ? baseUri.slice(0, -1) : baseUri;
        
        // Construct new URI with account as database name
        const dbURI = options 
            ? `${cleanBaseUri}/${account}?${options}`
            : `${cleanBaseUri}/${account}`;
            
        console.log(`Connecting to MongoDB Atlas database: ${account} with URI: ${dbURI}`);
        
        const connection = await mongoose.createConnection(dbURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        connections[account] = connection;
        console.log(`Connected to MongoDB Atlas database: ${account}`);
        
        return connection;
    } else {
        // For local MongoDB, continue with your current approach
        if (MONGODB_URI.endsWith('/')) {
            MONGODB_URI = MONGODB_URI.slice(0, -1);
        }
        
        const dbURI = `${MONGODB_URI}/${account}`;
        console.log(`Connecting to local MongoDB database: ${account} with URI: ${dbURI}`);
        
        const connection = await mongoose.createConnection(dbURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        connections[account] = connection;
        console.log(`Connected to local MongoDB database: ${account}`);
        
        return connection;
    }
};

module.exports = getDBConnection;