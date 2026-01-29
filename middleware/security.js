const helmet = require('helmet');

// CSP (Content Security Policy) middleware
const cspMiddleware = (req, res, next) => {
  // Define a strict CSP policy
  const cspPolicy = {
    directives: {
      // Restrict sources for various content types
      'default-src': ["'self'"],
      'script-src': [
        "'self'"
      ],
      'style-src': [
        "'self'",
        "https://fonts.googleapis.com" // Allow Google Fonts
      ],
      'font-src': [
        "'self'",
        "https://fonts.gstatic.com", // Allow Google Fonts
        "https://fonts.googleapis.com" // Allow Google Fonts CSS
      ],
      'img-src': [
        "'self'",
        "data:" // Allow data URIs for images
      ],
      'connect-src': [
        "'self'", // Allow connections to same origin (for WebSocket)
        "ws://localhost:*", // Allow WebSocket connections for local development
        "wss://localhost:*", // Allow secure WebSocket connections
        "ws://127.0.0.1:*", // Allow WebSocket connections
        "wss://127.0.0.1:*" // Allow secure WebSocket connections
      ],

      'frame-ancestors': ["'none'"], // Prevent embedding in iframes
      'object-src': ["'none'"], // Disallow plugins like Flash
      'base-uri': ["'self'"],
      'form-action': ["'self'"], // Restrict form submissions to same origin
    },
    reportOnly: false, // Enforce the policy instead of just reporting
  };

  // Apply CSP header
  const cspHeader = Object.entries(cspPolicy.directives)
    .map(([directive, sources]) => {
      const sourceString = sources.join(' ');
      return `${directive} ${sourceString}`;
    })
    .join('; ');

  res.setHeader('Content-Security-Policy', cspHeader);

  // Apply additional security headers with helmet, disabling CSP since we set it manually
  helmet({
    contentSecurityPolicy: false, // Disable CSP since we're setting it manually
    crossOriginEmbedderPolicy: false, // Disable COEP if not needed
    crossOriginOpenerPolicy: false,   // Disable COOP if not needed
    crossOriginResourcePolicy: false, // Disable CORP if not needed
    originAgentCluster: false,        // Disable OAC if not needed
    xDnsPrefetchControl: true,        // Control DNS prefetching
    xDownloadOptions: true,           // Prevent downloads opening in IE
    xFrameOptions: 'DENY',            // Prevent framing
    xPermittedCrossDomainPolicies: 'none', // Cross-domain policies
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
  })(req, res, next);
};

module.exports = cspMiddleware;