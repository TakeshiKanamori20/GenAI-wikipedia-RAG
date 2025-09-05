const byId = (id) => document.getElementById(id);
const fmtMs = (ms) => `${(ms/1000).toFixed(2)}s`;
const colorByKind = {
  load: '#2b6cb0',
  split: '#805ad5',
  embed: '#b7791f',
  index: '#2f855a',
  query: '#2c5282',
  rerank: '#b83280',
  llm: '#c05621',
  done: '#276749',
  warning: '#b7791f',
  error: '#c53030'
};

let sessionId = null;
let collected = { logs: [], metrics: {}, sources: [] };

function showLogs(logs) {
  const c = byId('console');
  c.innerHTML = '';
  (logs||[]).forEach(data => {
    const line = document.createElement('div');
    line.className = 'logline';
    const ts = new Date(data.ts).toLocaleTimeString();
    const kind = data.kind.toUpperCase();
    line.innerHTML = `<span class="tag" style="background:${colorByKind[data.kind]||'#4a5568'}">[${kind}]</span> <span class="time">${ts}</span> <span class="msg">${data.message}</span>`;
    c.appendChild(line);
  });
  c.scrollTop = c.scrollHeight;
}

function pill(title, url) {
  const a = document.createElement('a');
  a.className = 'pill';
  a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
  a.textContent = title;
  return a;
}

function showBanner(text, type) {
  const b = byId('banner');
  b.textContent = text; b.className = `banner ${type||''}`;
  if (!text) b.classList.add('hidden'); else b.classList.remove('hidden');
}

async function generate() {
  sessionId = crypto.randomUUID();
  collected = { logs: [], metrics: {}, sources: [] };
  showBanner('', '');

  const persons = [
    { name: byId('name1').value.trim(), weight: Number(byId('w1').value) },
    { name: byId('name2').value.trim(), weight: Number(byId('w2').value) },
    { name: byId('name3').value.trim(), weight: Number(byId('w3').value) }
  ].filter(p => p.name);

  if (persons.length === 0) {
    showBanner('少なくとも1名を入力してください', 'warn');
    return;
  }

  const body = {
    persons,
    temp: Number(byId('temp').value),
    creative: Number(byId('creative').value),
    topK: Number(byId('topK').value),
    topK_final: Number(byId('topK_final').value)
  };

  const r = await fetch('/api/mix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId },
    body: JSON.stringify(body)
  });

  const data = await r.json();
  collected.metrics = data.metrics || {}; collected.sources = data.sources || [];
  collected.logs = data.logs || [];
  showLogs(collected.logs);

  if (!r.ok) {
    if (r.status === 404) showBanner('検索に失敗した人物があります（黄）。', 'warn');
    else showBanner('致命的エラーが発生しました（赤）。', 'error');
  }

  // result card
  byId('card').innerHTML = data.html || '';
  const sources = byId('sources');
  sources.innerHTML = '';
  (data.sources||[]).forEach(s => sources.appendChild(pill(s.title, s.url)));

  // metrics
  const m = data.metrics || {};
  byId('metrics').innerHTML = `
    <table>
      <tbody>
        <tr><th>fetch</th><td>${fmtMs(m.fetchMs||0)}</td><th>split</th><td>${fmtMs(m.splitMs||0)}</td></tr>
        <tr><th>embed</th><td>${fmtMs(m.embedMs||0)}</td><th>index</th><td>${fmtMs(m.indexMs||0)}</td></tr>
        <tr><th>search</th><td>${fmtMs(m.searchMs||0)}</td><th>rerank</th><td>${fmtMs(m.rankMs||0)}</td></tr>
        <tr><th>gen</th><td>${fmtMs(m.genMs||0)}</td><th>total</th><td>${fmtMs(m.totalMs||0)}</td></tr>
        <tr><th>chunks</th><td>${m.chunksUsed||0}/${m.chunksTotal||0}</td><th>tokens</th><td>${m.promptTokensEst||0} + ${m.completionTokensEst||0}</td></tr>
      </tbody>
    </table>`;
}

['w1','w2','w3','temp','creative'].forEach(id => {
  const el = byId(id), v = byId(id+'v');
  el.addEventListener('input', () => v.textContent = el.value);
});

byId('gen').addEventListener('click', generate);

byId('copyLogs').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(collected, null, 2)], { type: 'application/json' });
  navigator.clipboard.writeText(JSON.stringify(collected, null, 2));
});

byId('downloadTrace').addEventListener('click', () => {
  const data = JSON.stringify(collected, null, 2);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  a.download = 'trace.json';
  a.click();
});
