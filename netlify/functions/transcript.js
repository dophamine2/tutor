const https = require('https');

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const videoId = event.queryStringParameters?.videoId;
  if (!videoId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'videoId required' }) };
  }

  return new Promise((resolve) => {
    const options = {
      hostname: 'youtube-transcript3.p.rapidapi.com',
      path: `/api/transcript?videoId=${videoId}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-host': 'youtube-transcript3.p.rapidapi.com',
        'x-rapidapi-key': 'ed0f52391emsh0fe8004fa3f1bb4p143422jsn5eb977e0024a'
      }
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);

          // Solid API возвращает массив [{text, start, duration}]
          const items = Array.isArray(json) ? json : (json?.transcript || json?.data || []);

          if (!items || items.length === 0) {
            resolve({ statusCode: 404, headers, body: JSON.stringify({ error: 'No captions found', transcript: null }) });
            return;
          }

          const lines = items.map(item => ({
            text: (item.text || item.content || '').replace(/\n/g, ' ').trim(),
            offset: Math.floor((item.start || item.offset || 0))
          })).filter(l => l.text);

          const fullText = lines.map(l => l.text).join(' ');

          resolve({
            statusCode: 200,
            headers,
            body: JSON.stringify({ transcript: fullText, lines, language: 'ru' })
          });

        } catch(e) {
          resolve({ statusCode: 500, headers, body: JSON.stringify({ error: e.message, raw: data.slice(0, 200) }) });
        }
      });
    });

    req.on('error', e => {
      resolve({ statusCode: 500, headers, body: JSON.stringify({ error: e.message }) });
    });

    req.end();
  });
};
