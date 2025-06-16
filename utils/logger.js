const winston = require('winston');
const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  try {
    fs.mkdirSync(logsDir, { recursive: true });
    console.log(`Created logs directory: ${logsDir}`);
  } catch (error) {
    console.error(`Failed to create logs directory: ${error.message}`);
  }
}

// Simple logger with console output and file output
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'lca-service' },
  transports: [
    // Console transport
    new winston.transports.Console({
      level: 'debug',
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.printf(info => 
          `${info.timestamp} ${info.level}: ${info.message}${
            Object.keys(info).length > 3 ? ' ' + JSON.stringify(info, null, 2).replace(/"timestamp":.*?,|"level":.*?,|"message":.*?,|"service":.*?,/g, '') : ''
          }`
        )
      ),
      handleExceptions: true,
      stderrLevels: ['error'],
      consoleWarnLevels: ['warn']
    }),
    // File transports
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error',
      handleExceptions: true,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: path.join(logsDir, 'combined.log'),
      handleExceptions: true,
      maxsize: 5242880, // 5MB  
      maxFiles: 5
    })
  ],
  exitOnError: false
});

// Handle logger errors
logger.on('error', (error) => {
  console.error('Logger error:', error);
});

// Test that logging works on startup
logger.info('Logger initialized successfully');

module.exports = logger;