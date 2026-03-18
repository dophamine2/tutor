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
      https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }).on('error', reject);
    });
  }

  try {
    const pageRes = await httpsGet(`https://www.youtube.com/watch?v=${videoId}`);
    const pageHtml = pageRes.body;

    const match = pageHtml.match(/"captionTracks":\[(.+?)\],"audioTracks"/);
    if (!match) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'No captions found', transcript: null }) };
    }

    const tracks = JSON.parse('[' + match[1] + ']');
    let track = tracks.find(t => t.languageCode === 'ru')
             || tracks.find(t => t.languageCode === 'en')
             || tracks[0];

    if (!track || !track.baseUrl) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'No usable track', transcript: null }) };
    }

    const subUrl = track.baseUrl.replace(/\\u0026/g, '&') + '&fmt=json3';
    const subRes = await httpsGet(subUrl);
    const subData = JSON.parse(subRes.body);

    const events = subData.events || [];
    const lines = events
      .filter(e => e.segs)
      .map(e => ({
        text: e.segs.map(s => s.utf8 || '').join('').replace(/\n/g, ' ').trim(),
        offset: Math.floor((e.tStartMs || 0) / 1000)
      }))
      .filter(e => e.text && e.text !== ' ');

    const fullText = lines.map(l => l.text).join(' ');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        transcript: fullText,
        lines: lines,
        language: track.languageCode,
        title: track.name?.simpleText || null
      })
    };

  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: e.message, transcript: null })
    };
  }
};
