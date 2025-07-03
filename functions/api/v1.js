const tls = require('tls');
const net = require('net');

exports.handler = async (event) => {
  const params = event.queryStringParameters;
  const ip = params.ip;
  const port = params.port;

  if (!ip || !port) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing ip or port parameter' }),
    };
  }

  try {
    const result = await checkProxy(ip, port);
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

function checkProxy(ip, port) {
  const host = 'speed.cloudflare.com';
  const path = '/meta';
  const payload = `GET ${path} HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: Mozilla/5.0\r\nConnection: close\r\n\r\n`;

  return new Promise((resolve, reject) => {
    const start = Date.now();

    const socket = net.connect({ host: ip, port: parseInt(port) }, () => {
      const secureSocket = tls.connect({
        socket,
        servername: host,
        rejectUnauthorized: false
      }, () => {
        secureSocket.write(payload);
      });

      let data = '';

      secureSocket.on('data', chunk => {
        data += chunk.toString();
      });

      secureSocket.on('end', () => {
        const parts = data.split('\r\n\r\n');
        try {
          const json = JSON.parse(parts[1]);
          const end = Date.now();
          if (json.clientIp) {
            resolve({
              ip,
              port: parseInt(port),
              proxyip: true,
              asOrganization: json.asOrganization || 'Unknown',
              countryCode: json.country || 'Unknown',
              countryName: getCountryName(json.country),
              countryFlag: getCountryFlag(json.country),
              asn: parseInt(json.asn) || 0,
              colo: json.colo || 'Unknown',
              httpProtocol: json.httpProtocol || 'Unknown',
              delay: `${end - start} ms`,
              latitude: json.latitude || 'Unknown',
              longitude: json.longitude || 'Unknown',
              message: `Cloudflare Proxy Alive ${ip}:${port}`
            });
          } else {
            reject(new Error('Invalid JSON response'));
          }
        } catch (e) {
          reject(new Error('Failed to parse JSON from proxy'));
        }
      });

      secureSocket.on('error', err => {
        reject(new Error('TLS socket error: ' + err.message));
      });
    });

    socket.on('error', err => {
      reject(new Error('TCP socket error: ' + err.message));
    });
  });
}

function getCountryName(code) {
  try {
    if (!code) return 'Unknown';
    const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    return regionNames.of(code.toUpperCase()) || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

function getCountryFlag(code) {
  try {
    if (!code) return '';
    return code.toUpperCase().replace(/./g, char =>
      String.fromCodePoint(127397 + char.charCodeAt())
    );
  } catch {
    return '';
  }
}
