// Method Override Middleware
// Allows HTML forms to send PUT, PATCH, and DELETE requests
function methodOverride(req, res, next) {
    if (req.body && typeof req.body === 'object' && '_method' in req.body) {
        // Change the method to the value in _method
        req.method = req.body._method.toUpperCase();
        // Remove the _method from the body
        delete req.body._method;
    }
    next();
}

module.exports = methodOverride;