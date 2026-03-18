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

  function httpsGet(url, reqHeaders = {}) {
    return new Promise((resolve, reject) => {
      https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          ...reqHeaders
        }
      }, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
      }).on('error', reject);
    });
  }

  try {
    // Шаг 1: получаем innertube API key и visitor data через /youtubei/v1/player
    const playerPayload = JSON.stringify({
      videoId,
      context: {
        client: {
          clientName: 'TVHTML5',
          clientVersion: '7.20240101',
          hl: 'ru',
          gl: 'RU'
        }
      }
    });

    const playerRes = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'www.youtube.com',
        path: '/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/538.1 (KHTML, like Gecko) Version/6.0 TV Safari/538.1',
          'X-YouTube-Client-Name': '7',
          'X-YouTube-Client-Version': '7.20240101',
          'Content-Length': Buffer.byteLength(playerPayload)
        }
      };
      const req = https.request(options, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      });
      req.on('error', reject);
      req.write(playerPayload);
      req.end();
    });

    const player = JSON.parse(playerRes.body);

    // DEBUG
    if (event.queryStringParameters?.debug === '1') {
      return { statusCode: 200, headers, body: JSON.stringify({
        status: playerRes.status,
        hasCaptions: !!player?.captions,
        captionsKeys: player?.captions ? Object.keys(player.captions) : null,
        tracks: player?.captions?.playerCaptionsTracklistRenderer?.captionTracks || null,
        playerKeys: Object.keys(player || {}),
        playabilityStatus: player?.playabilityStatus?.status || null
      })};
    }

    const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!tracks || tracks.length === 0) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'No captions found', transcript: null }) };
    }

    // Выбираем русский трек, если нет — английский, если нет — первый
    let track = tracks.find(t => t.languageCode === 'ru')
             || tracks.find(t => t.languageCode === 'en')
             || tracks[0];

    const subUrl = track.baseUrl.replace(/\\u0026/g, '&') + '&fmt=json3';

    // Шаг 2: загружаем субтитры
    const subRes = await httpsGet(subUrl);
    const subData = JSON.parse(subRes.body);

    const events = subData.events || [];
    const lines = events
      .filter(e => e.segs)
      .map(e => ({
        text: e.segs.map(s => s.utf8 || '').join('').replace(/\n/g, ' ').trim(),
        offset: Math.floor((e.tStartMs || 0) / 1000)
      }))
      .filter(e => e.text && e.text.trim() !== '');

    const fullText = lines.map(l => l.text).join(' ');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        transcript: fullText,
        lines,
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
