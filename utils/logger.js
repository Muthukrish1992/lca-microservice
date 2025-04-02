const winston = require('winston');

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
      handleExceptions: true
    }),
    // File transports
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    })
  ],
  exitOnError: false
});

module.exports = logger;