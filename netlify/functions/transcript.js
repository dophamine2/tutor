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

  function httpsGet(url) {
    return new Promise((resolve, reject) => {
      https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'ru,en;q=0.9',
        }
      }, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }).on('error', reject);
    });
  }

  // DEBUG
  if (event.queryStringParameters?.debug === '1') {
    const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`;
    const res = await httpsGet(url);
    return { statusCode: 200, headers, body: JSON.stringify({
      status: res.status,
      bodyLength: res.body?.length,
      bodyPreview: res.body?.slice(0, 300)
    })};
  }

  // Пробуем языки по приоритету
  const langs = ['ru', 'en', 'a.ru', 'a.en'];

  for (const lang of langs) {
    try {
      const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=json3&xorb=2&xobt=3&xovt=3`;
      const res = await httpsGet(url);

      if (res.status !== 200) continue;
      if (!res.body || res.body.length < 50) continue;

      let data;
      try { data = JSON.parse(res.body); } catch(e) { continue; }

      const events = data.events || [];
      const lines = events
        .filter(e => e.segs)
        .map(e => ({
          text: e.segs.map(s => s.utf8 || '').join('').replace(/\n/g, ' ').trim(),
          offset: Math.floor((e.tStartMs || 0) / 1000)
        }))
        .filter(e => e.text && e.text.trim() !== '');

      if (lines.length === 0) continue;

      const fullText = lines.map(l => l.text).join(' ');

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          transcript: fullText,
          lines,
          language: lang,
          title: null
        })
      };

    } catch(e) {
      continue;
    }
  }

  // Если ничего не нашли — пробуем XML формат
  for (const lang of ['ru', 'en']) {
    try {
      const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}`;
      const res = await httpsGet(url);

      if (res.status !== 200 || !res.body || res.body.length < 50) continue;

      const texts = [...res.body.matchAll(/<text[^>]*>([^<]+)<\/text>/g)]
        .map(m => m[1]
          .replace(/&amp;/g, '&')
          .replace(/&#39;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .trim()
        )
        .filter(Boolean);

      if (texts.length === 0) continue;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          transcript: texts.join(' '),
          lines: texts.map((t, i) => ({ text: t, offset: i * 5 })),
          language: lang,
          title: null
        })
      };

    } catch(e) {
      continue;
    }
  }

  return {
    statusCode: 404,
    headers,
    body: JSON.stringify({ error: 'No captions found', transcript: null })
  };
};
