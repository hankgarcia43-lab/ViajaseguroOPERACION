const http = require('http');
const https = require('https');
const net = require('net');
const { URL } = require('url');

const CHECKS = [
  { name: 'API health (local)', url: 'http://localhost:4000/api/health', required: false },
  { name: 'Web app (local)', url: 'http://localhost:3000/', required: true },
  { name: 'Proxy health (local)', url: 'http://localhost:3000/api/proxy/health', required: true },
  { name: 'API health (remoto)', url: 'https://viaja-seguro-mvp.onrender.com/api/health', required: true }
];

function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        resolve({ port, inUse: true });
      } else {
        resolve({ port, inUse: false, error });
      }
    });

    server.once('listening', () => {
      server.close(() => resolve({ port, inUse: false }));
    });

    server.listen(port, '127.0.0.1');
  });
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;
    const request = client.request(
      {
        method: 'GET',
        hostname: parsed.hostname,
        port: parsed.port,
        path: `${parsed.pathname}${parsed.search}`,
        timeout: 7000
      },
      (response) => {
        const { statusCode } = response;
        let data = '';

        response.on('data', (chunk) => {
          data += chunk.toString('utf8');
        });

        response.on('end', () => {
          resolve({ statusCode, body: data });
        });
      }
    );

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy(new Error('Tiempo de espera agotado'));
    });
    request.end();
  });
}

async function main() {
  console.log('Verificando entorno local...');

  const ports = await Promise.all([checkPort(3000), checkPort(4000)]);
  ports.forEach(({ port, inUse, error }) => {
    if (error) {
      console.log(`- Puerto ${port}: error de verificacion: ${error.message}`);
      return;
    }

    if (inUse) {
      console.log(`- Puerto ${port}: ocupado (normal si el servidor ya esta iniciado).`);
    } else {
      console.log(`- Puerto ${port}: libre (el servidor puede no estar iniciado).`);
    }
  });

  let requiredFailed = false;

  for (const check of CHECKS) {
    process.stdout.write(`Comprobando ${check.name} (${check.url})... `);
    try {
      const result = await fetchUrl(check.url);
      if (result.statusCode >= 200 && result.statusCode < 400) {
        console.log(`OK (${result.statusCode})`);
      } else {
        console.log(`Fallo (${result.statusCode}). ${result.body ? result.body : ''}`);
        if (check.required) {
          requiredFailed = true;
        }
      }
    } catch (error) {
      console.log(`ERROR. ${error.message}`);
      if (check.required) {
        requiredFailed = true;
      }
    }
  }

  if (requiredFailed) {
    console.log('\nResultado: hay checks obligatorios pendientes por corregir.');
    process.exit(1);
  }

  console.log('\nResultado: entorno verificado correctamente (checks obligatorios).');
}

main().catch((error) => {
  console.error('Error en verificacion local:', error.message);
  process.exit(1);
});