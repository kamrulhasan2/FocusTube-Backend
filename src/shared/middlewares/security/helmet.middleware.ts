import helmet from 'helmet';

const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  frameguard: {
    action: 'deny',
  },
  noSniff: true,
  hsts: {
    maxAge: 60 * 60 * 24 * 180,
    includeSubDomains: true,
    preload: true,
  },
});

export default helmetMiddleware;
