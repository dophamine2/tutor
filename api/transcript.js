export async function onRequest(context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  const url = new URL(context.request.url);
  const videoId = url.searchParams.get('videoId');

  if (!videoId) {
    return new Response(JSON.stringify({ error: 'videoId required' }), { status: 400, headers });
  }

  try {
    const res = await fetch(`https://youtube-transcript3.p.rapidapi.com/api/transcript?videoId=${videoId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-host': 'youtube-transcript3.p.rapidapi.com',
        'x-rapidapi-key': context.env.RAPIDAPI_KEY || 'ed0f52391emsh0fe8004fa3f1bb4p143422jsn5eb977e0024a'
      }
    });

    const json = await res.json();
    const items = Array.isArray(json) ? json : (json?.transcript || json?.data || []);

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ error: 'No captions found', transcript: null }), { status: 404, headers });
    }

    const lines = items.map(item => ({
      text: (item.text || item.content || '').replace(/\n/g, ' ').trim(),
      offset: Math.floor(item.start || item.offset || 0)
    })).filter(l => l.text);

    const fullText = lines.map(l => l.text).join(' ');

    return new Response(JSON.stringify({ transcript: fullText, lines, language: 'ru' }), { status: 200, headers });

  } catch(e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
  }
}
