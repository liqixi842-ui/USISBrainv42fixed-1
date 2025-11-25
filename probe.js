const http = require('http');
const PORT = process.env.PORT || 8080;
const server = http.createServer((req,res)=>{
  if (req.url === '/') { res.writeHead(200, {'Content-Type':'text/plain'}); return res.end('OK'); }
  if (req.url === '/health') { res.writeHead(200, {'Content-Type':'application/json'}); return res.end('{"ok":true,"src":"probe"}'); }
  if (req.url === '/version') { res.writeHead(200, {'Content-Type':'application/json'}); return res.end('{"version":"probe-1"}'); }
  res.writeHead(404, {'Content-Type':'text/plain'}); res.end('probe-404');
});
console.log('🔍 ENV PORT =', process.env.PORT);
server.listen(PORT, '0.0.0.0', ()=>console.log('🧪 probe listening', PORT));
