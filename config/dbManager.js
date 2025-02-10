const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connections = {}; // Cache for database connections

const getDBConnection = async (account) => {
    if (!account) throw new Error('Account name is required');

    if (connections[account]) {
        return connections[account];
    }
    let MONGODB_URI = process.env.MONGODB_URI;
    if(MONGODB_URI.endsWith('/')){
        MONGODB_URI = MONGODB_URI.slice(0, -1);
    }

    const dbURI = `${MONGODB_URI}/${account}`;

    const connection = await mongoose.createConnection(dbURI);

    connections[account] = connection;
    console.log(`Connected to MongoDB database: ${account}`);

    return connection;
};

module.exports = getDBConnection;
