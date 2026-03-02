const NodeCache = require('node-cache');

// Initialize cache with a standard TTL of 5 minutes (300 seconds)
// and checking data periodically.
const cache = new NodeCache({ stdTTL: 300, checkperiod: 320 });

const cacheMiddleware = (duration) => {
    return (req, res, next) => {
        // We only want to cache GET requests
        if (req.method !== 'GET') {
            return next();
        }

        const key = req.originalUrl;
        const cachedResponse = cache.get(key);

        if (cachedResponse) {
            // Return cached response via 'send'
            return res.send(cachedResponse);
        } else {
            // Modify res.send to save the response body to cache before sending it
            const originalSend = res.send;
            res.send = function (body) {
                // Only cache successful requests
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    cache.set(key, body, duration);
                }
                originalSend.call(this, body);
            };
            next();
        }
    };
};

module.exports = cacheMiddleware;
