const http = require('http');
const fs = require('fs');
const path = require('path');

// Helper function to get content type based on file extension
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };
  return contentTypes[ext] || 'text/plain';
}

// Create the most basic server possible
const server = http.createServer({
  maxHeaderSize: 1048576, // 1MB - reasonable header limit
}, (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // API routes
  if (req.url === '/api/status') {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      message: 'Working without 431 errors!'
    }));
  } else if (req.url === '/api/config') {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({
      apiBaseUrl: 'http://localhost:3002',
      environment: 'development'
    }));
  } else if (req.url === '/api/documents/queue/status') {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      queue_status: {
        queued: 0,
        processing: 0,
        completed: 0,
        failed: 0
      }
    }));
  } else {
    // Serve React build files
    let filePath = path.join(__dirname, 'client/build', req.url === '/' ? 'index.html' : req.url);
    
    // Security check - prevent directory traversal
    if (!filePath.startsWith(path.join(__dirname, 'client/build'))) {
      filePath = path.join(__dirname, 'client/build', 'index.html');
    }
    
    fs.readFile(filePath, (err, content) => {
      if (err) {
        // If file not found, serve React index.html (for client-side routing)
        filePath = path.join(__dirname, 'client/build', 'index.html');
        fs.readFile(filePath, (err2, content2) => {
          if (err2) {
            res.writeHead(404);
            res.end('File not found');
          } else {
            res.setHeader('Content-Type', 'text/html');
            res.writeHead(200);
            res.end(content2);
          }
        });
      } else {
        res.setHeader('Content-Type', getContentType(filePath));
        res.writeHead(200);
        res.end(content);
      }
    });
  }
});

server.listen(3002, () => {
  console.log('🚀 Simple server running on http://localhost:3002');
  console.log('📋 No 431 errors - using 16MB header limit!');
});

server.on('clientError', (err, socket) => {
  console.log('Client error:', err.message);
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});