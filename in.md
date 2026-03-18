Инструкции для нейросети (точечные правки)

Правка 1 — app.js, строка 1557–1604
Найди точно (строка 1557):
// Получаем метаданные YouTube через oEmbed (без CORS, без ключа)
async function fetchYouTubeMeta(videoId) {
После строки 1563 (после закрывающей } функции fetchYouTubeMeta) добавь новую функцию:
javascript// Получаем субтитры через Supadata API (бесплатно, без ключа, без CORS)
async function fetchYouTubeTranscript(videoId) {
  try {
    // Вариант 1: Supadata
    const res = await fetch(`https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}&lang=ru`);
    if (res.ok) {
      const data = await res.json();
      // data.content — массив [{text, offset, duration}] или строка
      if (Array.isArray(data.content)) {
        return data.content.map(s => s.text).join(' ');
      }
      if (typeof data.content === 'string') return data.content;
    }
  } catch(e) { console.warn('[Transcript] Supadata failed:', e.message); }

  try {
    // Вариант 2: youtubetranscript.com proxy
    const res2 = await fetch(`https://youtubetranscript.com/?server_vid=${videoId}`);
    if (res2.ok) {
      const xml = await res2.text();
      const texts = [...xml.matchAll(/<text[^>]*>([^<]+)<\/text>/g)].map(m =>
        m[1].replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"')
      );
      if (texts.length > 0) return texts.join(' ');
    }
  } catch(e) { console.warn('[Transcript] Proxy failed:', e.message); }

  return null; // субтитры недоступны
}

Правка 2 — app.js, строка 1593–1604
Найди точно:
javascript  matContext = { type: 'youtube', url: val, ytId, title: null, channel: null };
  openMatWorkspaceFlow('▶ YouTube');

  // Загружаем только метаданные (oEmbed) — без прокси
  try {
    const meta = await fetchYouTubeMeta(ytId);
    matContext.title   = meta.title       || null;
    matContext.channel = meta.author_name || null;
    console.log('[YT] Meta loaded:', matContext.title, '/', matContext.channel);
  } catch(e) {
    console.warn('[YT] oEmbed failed:', e.message);
  }
}
Замени на:
javascript  matContext = { type: 'youtube', url: val, ytId, title: null, channel: null, transcript: null };
  openMatWorkspaceFlow('▶ YouTube');

  // Загружаем метаданные + субтитры параллельно
  const [meta, transcript] = await Promise.allSettled([
    fetchYouTubeMeta(ytId),
    fetchYouTubeTranscript(ytId)
  ]);

  if (meta.status === 'fulfilled') {
    matContext.title   = meta.value.title       || null;
    matContext.channel = meta.value.author_name || null;
    console.log('[YT] Meta loaded:', matContext.title, '/', matContext.channel);
  } else {
    console.warn('[YT] oEmbed failed:', meta.reason?.message);
  }

  if (transcript.status === 'fulfilled' && transcript.value) {
    matContext.transcript = transcript.value;
    console.log('[YT] Transcript loaded, length:', transcript.value.length);
  } else {
    console.warn('[YT] Transcript unavailable');
  }
}

Правка 3 — app.js, строка 1728–1782
Найди точно (строка 1728):
javascript  if (isYT) {
    const ytTitle   = ctx.title   || null;
    const ytChannel = ctx.channel || null;
    const ytUrl     = ctx.url;
    const ytId      = ctx.ytId;

    // Промпт для определения темы
    titlePrompt = ytTitle
Замени весь блок if (isYT) { ... } (строки 1728–1782) на:
javascript  if (isYT) {
    const ytTitle      = ctx.title      || null;
    const ytChannel    = ctx.channel    || null;
    const ytUrl        = ctx.url;
    const ytId         = ctx.ytId;
    const ytTranscript = ctx.transcript || null;

    // Если есть субтитры — используем реальный текст
    const transcriptBlock = ytTranscript
      ? `\n\nРЕАЛЬНЫЕ СУБТИТРЫ ВИДЕО (используй этот текст как основу):\n"""\n${ytTranscript.slice(0, 12000)}\n"""`
      : '';

    const hasTranscript = !!ytTranscript;

    // Промпт для определения темы
    titlePrompt = ytTitle
      ? `YouTube-видео называется "${ytTitle}"${ytChannel ? `, канал "${ytChannel}"` : ''}. Напиши короткое академическое название учебной темы этого видео на русском языке. Только название, без кавычек и точек.`
      : `URL YouTube-видео: ${ytUrl}. Определи тему и напиши короткое академическое название на русском языке. Только название.`;

    // Промпт для конспекта — с реальным транскриптом если есть
    const videoInfo = [
      ytTitle   ? `Название видео: "${ytTitle}"` : null,
      ytChannel ? `Канал: ${ytChannel}`          : null,
      `Ссылка: ${ytUrl}`,
    ].filter(Boolean).join('\n');

    notePrompt = `Ты опытный преподаватель-методист. Пользователь изучает YouTube-видео.

${videoInfo}
${hasTranscript ? transcriptBlock : ''}

${hasTranscript
  ? 'Используй РЕАЛЬНЫЙ ТЕКСТ СУБТИТРОВ выше как основу. Выдели ключевые моменты с реальными таймкодами из субтитров.'
  : 'На основе названия видео и своих знаний составь подробный учебный конспект.'}

Строго используй эту структуру (только HTML, без markdown, без \`\`\`html):
<div class="ai-note">
  <div class="ai-note-section">
    <div class="ai-note-section-title">О чём это видео</div>
    <p>${hasTranscript ? 'На основе реального содержания:' : ''} 2–3 предложения: что разбирается, для кого, зачем смотреть.</p>
  </div>
  <div class="ai-note-section">
    <div class="ai-note-section-title">Ключевые моменты с таймкодами</div>
    <ul>
      <li><a class="yt-ts-link" href="https://www.youtube.com/watch?v=${ytId}&t=СЕКУНДЫs" target="_blank">▶ М:СС</a> <strong>Тема момента</strong> — что объясняется в этом фрагменте</li>
    </ul>
    <p style="font-size:11px;color:var(--tx2);margin-top:4px">${hasTranscript ? '↑ Таймкоды из реальных субтитров' : '↑ Нажми ▶ — откроется YouTube ровно на этом месте'}</p>
  </div>
  <div class="ai-note-section">
    <div class="ai-note-section-title">Основные понятия</div>
    <ul><li><strong>Термин</strong> — определение своими словами</li></ul>
  </div>
  <div class="ai-note-section">
    <div class="ai-note-section-title">Ключевые формулы</div>
    <p>Каждая формула на отдельной строке в LaTeX: $формула$ — пояснение</p>
  </div>
  <div class="ai-note-section">
    <div class="ai-note-section-title">Типичные ошибки</div>
    <ul><li>Ошибка — как избежать</li></ul>
  </div>
  <div class="ai-note-section">
    <div class="ai-note-section-title">Главное запомнить</div>
    <ul><li>Ключевой тезис</li></ul>
  </div>
</div>
Отвечай только HTML. Без вступления. ${hasTranscript ? 'Опирайся на реальный текст субтитров.' : 'Используй минимум 5 таймкодов.'} На русском языке.`;
```

---

### Итог

После этих 3 правок логика будет такой:
```
Пользователь вводит YouTube-ссылку
      ↓
Параллельно: oEmbed (название) + Supadata (субтитры)
      ↓
Если субтитры получены → AI анализирует РЕАЛЬНЫЙ ТЕКСТ
Если субтитров нет → AI работает по названию (как раньше)
      ↓
Таймкоды в конспекте — реальные (из субтитров)

⚠️ Важно: Supadata API бесплатен, но у него есть лимит запросов. Если в проекте большая нагрузка — понадобится API-ключ или свой бэкенд-прокси. Для тестирования и MVP работает без ключа.