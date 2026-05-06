const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 300, checkperiod: 320 });

const cacheMiddleware = (duration) => {
    return (req, res, next) => {
        const isExcludedFromFlush = 
            req.originalUrl.includes('/heartbeat') || 
            req.originalUrl.includes('/chat/stream') ||
            req.originalUrl.includes('/chat/edit') ||
            req.originalUrl.includes('/chat/rating');

        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method) && !isExcludedFromFlush) {
            cache.flushAll();
            console.log(`Cache flushed globally due to ${req.method} request on ${req.originalUrl}`);
            return next();
        }

        // If no duration is provided, we just pass through (after checking for mutations above)
        if (!duration) {
            return next();
        }

        if (req.method !== 'GET' || req.query.skipCache === 'true' || req.headers['x-skip-cache'] === 'true') {
            return next();
        }

        const key = req.originalUrl;
        const cachedResponse = cache.get(key);

        if (cachedResponse) {
            return res.send(cachedResponse);
        } else {
            const originalSend = res.send;
            res.send = function (body) {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    cache.set(key, body, duration);
                }
                originalSend.call(this, body);
            };
            next();
        }
    };
};

cacheMiddleware.cache = cache;

module.exports = cacheMiddleware;
