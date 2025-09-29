const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Configuração do proxy para a API
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:8000',
      changeOrigin: true,
      secure: false,
      logLevel: 'debug',
      pathRewrite: {
        '^/api': ''  // Remove o prefixo /api da URL
      },
      onProxyReq: (proxyReq, req, res) => {
        console.log('=== REQUEST ===');
        console.log('URL:', req.originalUrl);
        console.log('Method:', req.method);
        console.log('Headers:', JSON.stringify(req.headers, null, 2));
        console.log('Body:', req.body ? JSON.stringify(req.body) : 'No body');
        console.log('===============');
      },
      onProxyRes: (proxyRes, req, res) => {
        console.log('=== RESPONSE ===');
        console.log('Status:', proxyRes.statusCode);
        console.log('Headers:', JSON.stringify(proxyRes.headers, null, 2));
        console.log('===============');
      },
      onError: (err, req, res) => {
        console.error('=== PROXY ERROR ===');
        console.error('Error:', err);
        console.error('URL:', req.originalUrl);
        console.error('===============');
        if (!res.headersSent) {
          res.status(500).json({ 
            error: 'Proxy Error', 
            message: err.message,
            code: err.code
          });
        }
      },
      ws: true, // Habilita WebSockets
      xfwd: true // Adiciona cabeçalhos X-Forwarded-*
    })
  );
};
