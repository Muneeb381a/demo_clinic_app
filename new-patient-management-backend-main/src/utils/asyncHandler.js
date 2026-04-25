/**
 * Async handler wrapper for Express routes
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped middleware function
 */
export const asyncHandler = (fn) => (req, res, next) => {
    // Create a clean stack trace by creating a new Error object
    const stackTrace = new Error().stack;
  
    // Wrap the promise chain to capture errors
    Promise.resolve(fn(req, res, next))
      .catch((error) => {
        // Enhance error information with route context
        error.routeContext = {
          path: req.path,
          method: req.method,
          params: req.params,
          query: req.query,
          stackTrace: stackTrace
        };
        
        // Pass to Express error handling
        next(error);
      });
  };
  
  // Advanced version with additional features
  export const advancedAsyncHandler = (handler) => {
    return async (req, res, next) => {
      try {
        // Check if handler expects next parameter (for middleware chains)
        const paramCount = handler.length;
        
        if (paramCount === 4) {
          // Error-handling middleware
          return handler(req, res, next, (error) => next(error));
        }
  
        // Normal async handler
        const result = await handler(req, res, next);
        
        // Prevent double sending if response already sent
        if (!res.headersSent && result !== undefined) {
          res.send(result);
        }
      } catch (error) {
        // Log error details before passing to error handler
        console.error('Async Handler caught error:', {
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method,
          error: {
            message: error.message,
            stack: error.stack,
            originalError: error
          }
        });
  
        // Pass to Express error handling
        next(error);
      }
    };
  };