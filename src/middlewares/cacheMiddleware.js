const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 300, checkperiod: 320 });

const cacheMiddleware = (duration) => {
    return (req, res, next) => {
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

module.exports = cacheMiddleware;
