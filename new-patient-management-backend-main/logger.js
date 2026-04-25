import { inspect } from 'util';

const getTimestamp = () => new Date().toISOString();

const logFormatter = (level, message, context = {}) => {
  const logEntry = {
    timestamp: getTimestamp(),
    level,
    message,
    ...context
  };

  // Format for non-production environments
  if (process.env.NODE_ENV !== 'production') {
    return `${logEntry.timestamp} [${level}] ${message} ${
      Object.keys(context).length > 0 
        ? inspect(context, { colors: true, depth: null }) 
        : ''
    }`;
  }

  return JSON.stringify(logEntry);
};

export const logger = {
  info: (message, context) => 
    console.log(logFormatter('INFO', message, context)),
  
  warn: (message, context) => 
    console.warn(logFormatter('WARN', message, context)),
  
  error: (message, context) => 
    console.error(logFormatter('ERROR', message, {
      ...context,
      stack: context?.error?.stack
    }))
};