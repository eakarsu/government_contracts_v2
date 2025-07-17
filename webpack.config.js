const path = require('path');

module.exports = {
  devServer: {
    host: '0.0.0.0',
    port: 5013, // or your dev port
    // Allow access via contracts.orderlybite.com
    allowedHosts: ['.orderlybite.com', 'localhost'],
    historyApiFallback: true, // for React Router
    hot: true,
    headers: {
      'Access-Control-Allow-Origin': '*'
    },
    // WebSocket configuration for HMR in HTTPS environments
    client: {
      webSocketURL: {
        hostname: 'contracts.orderlybite.com',
        port: 443,
        protocol: 'wss',
        pathname: '/sockjs-node'
      }
    }
  }
};

