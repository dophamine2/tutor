Файл 3: app.js — 3 точечные правки
Правка А — заменить функцию fetchYouTubeTranscript.
Найти точно:
javascript// Получаем субтитры через Supadata API (бесплатно, без ключа, без CORS)
async function fetchYouTubeTranscript(videoId) {
Заменить всю функцию до закрывающей } на:
javascriptasync function fetchYouTubeTranscript(videoId) {
  try {
    const res = await fetch(`/.netlify/functions/transcript?videoId=${videoId}`);
    if (!res.ok) { console.warn('[Transcript] Function returned', res.status); return null; }
    const data = await res.json();
    if (data.transcript) {
      if (data.lines && matContext) matContext.transcriptLines = data.lines;
      console.log('[Transcript] OK, lang:', data.language, 'chars:', data.transcript.length);
      return data.transcript;
    }
    console.warn('[Transcript] Empty:', data.error);
    return null;
  } catch(e) {
    console.warn('[Transcript] Failed:', e.message);
    return null;
  }
}

Правка Б — улучшить блок субтитров в промпте.
Найти точно:
javascript    const transcriptBlock = ytTranscript
      ? `\n\nРЕАЛЬНЫЕ СУБТИТРЫ ВИДЕО (используй этот текст как основу):\n"""\n${ytTranscript.slice(0, 12000)}\n"""`
      : '';
Заменить на:
javascript    const ytLines = ctx.transcriptLines || null;
    let transcriptBlock = '';
    if (ytTranscript) {
      if (ytLines && ytLines.length > 0) {
        const keyLines = [];
        let lastOffset = -30;
        ytLines.forEach(l => {
          if (l.offset - lastOffset >= 30) {
            keyLines.push(`[${Math.floor(l.offset/60)}:${String(l.offset%60).padStart(2,'0')}] (t=${l.offset}s) ${l.text}`);
            lastOffset = l.offset;
          }
        });
        transcriptBlock = `\n\nРЕАЛЬНЫЕ СУБТИТРЫ С ТАЙМКОДАМИ:\n"""\n${keyLines.slice(0, 80).join('\n')}\n"""\n\nПолный текст:\n${ytTranscript.slice(0, 8000)}`;
      } else {
        transcriptBlock = `\n\nРЕАЛЬНЫЕ СУБТИТРЫ ВИДЕО:\n"""\n${ytTranscript.slice(0, 12000)}\n"""`;
      }
    }

Правка В — добавить transcriptLines в инициализацию matContext.
Найти точно:
javascript  matContext = { type: 'youtube', url: val, ytId, title: null, channel: null, transcript: null };
Заменить на:
javascript  matContext = { type: 'youtube', url: val, ytId, title: null, channel: null, transcript: null, transcriptLines: null };
```

---

## Часть 2 — Настройка Netlify

После того как файлы закоммичены и запушены в репозиторий:

**1.** Открыть `netlify.app` → твой сайт → вкладка **Deploys** → убедиться что новый деплой прошёл успешно.

**2.** Проверить что функция задеплоилась: вкладка **Functions** в панели Netlify — там должна появиться `transcript`.

**3.** Проверить функцию вручную в браузере — открыть:
```
https://ИМЯ_ТВОЕГО_САЙТА.netlify.app/.netlify/functions/transcript?videoId=dQw4w9WgXcQ
Должен вернуться JSON с полем transcript.
4. Если функция не появилась — проверить в настройках сайта: Site configuration → Build & deploy → Functions directory — должно быть netlify/functions.