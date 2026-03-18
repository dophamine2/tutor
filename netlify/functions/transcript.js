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

    // DEBUG: возвращаем кусок HTML чтобы понять структуру
    if (event.queryStringParameters?.debug === '1') {
      const idx = pageHtml.indexOf('captionTracks');
      const snippet = idx >= 0
        ? pageHtml.slice(Math.max(0, idx - 50), idx + 500)
        : 'captionTracks NOT FOUND in page. Page length: ' + pageHtml.length + ' | First 500 chars: ' + pageHtml.slice(0, 500);
      return { statusCode: 200, headers, body: JSON.stringify({ debug: snippet }) };
    }

    // Пробуем несколько паттернов — YouTube меняет структуру
    let tracks = null;

    // Паттерн 1: старый формат
    const m1 = pageHtml.match(/"captionTracks":\[(.+?)\],"audioTracks"/);
    if (m1) {
      try { tracks = JSON.parse('[' + m1[1] + ']'); } catch(e) {}
    }

    // Паттерн 2: новый формат playerCaptionsTracklistRenderer
    if (!tracks) {
      const m2 = pageHtml.match(/"captionTracks":\s*(\[.*?\])\s*,\s*"(audioTracks|translationLanguages)"/s);
      if (m2) {
        try { tracks = JSON.parse(m2[1]); } catch(e) {}
      }
    }

    // Паттерн 3: через ytInitialPlayerResponse
    if (!tracks) {
      const m3 = pageHtml.match(/ytInitialPlayerResponse\s*=\s*({.+?})\s*;/s);
      if (m3) {
        try {
          const player = JSON.parse(m3[1]);
          tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks || null;
        } catch(e) {}
      }
    }

    // Паттерн 4: поиск baseUrl субтитров напрямую
    if (!tracks) {
      const m4 = pageHtml.match(/"baseUrl":"(https:\/\/www\.youtube\.com\/api\/timedtext[^"]+)"/g);
      if (m4 && m4.length > 0) {
        tracks = m4.map(s => {
          const url = s.replace(/"baseUrl":"/, '').replace(/"$/, '');
          const lang = url.match(/lang=([a-z]+)/)?.[1] || 'unknown';
          return { baseUrl: url, languageCode: lang };
        });
      }
    }

    if (!tracks || tracks.length === 0) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'No captions found', transcript: null }) };
    }
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
