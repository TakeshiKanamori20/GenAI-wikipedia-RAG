// 用語解説表示
window.addEventListener('DOMContentLoaded', () => {
  const info = document.createElement('div');
  info.className = 'explain';
  info.innerHTML = `
    <h3 style="margin-bottom:0.2em;font-size:1.05em;">用語解説</h3>
    <div style="display:flex;flex-wrap:wrap;gap:1em;font-size:0.98em;line-height:1.5;margin-bottom:0.2em;">
      <span><b>重み</b>：各人物の特徴をどれだけ合成文に反映するかの割合です。</span>
      <span><b>温度</b>：AIの生成文の多様性・ランダム性。高いほど自由な文になります。</span>
      <span><b>創造度</b>：AIがどれだけ新しい・独創的な表現をするかの度合いです。</span>
      <span><b>chunk（分割）</b>：長い説明文をAIが扱いやすいサイズに分割した単位です。</span>
      <span><b>Embedding（ベクトル化）</b>：テキストをAIが意味的に理解できる数値の並び（ベクトル）に変換する処理です。</span>
      <span><b>類似度（コサイン類似度）</b>：2つのベクトルがどれだけ似ているかを示す統計的指標。1に近いほど意味が近いです。コサイン類似度は「2つのベクトルのなす角度のcos値」で、統計・機械学習でよく使われます。</span>
      <span><b>重要部分抽出</b>：類似度が高いchunk（説明文の一部）をAIが「重要」と判断して抽出します。</span>
      <span style="color:#555">※ 類似度計算には統計的手法（コサイン類似度）を使っています。</span>
    </div>
  `;
  info.style.marginBottom = '0.2em';
  info.style.paddingBottom = '0';
  document.body.insertBefore(info, document.body.firstChild);
  // RAGコンソールの表示領域をさらに広げる
  const consoleDiv = byId('console');
  if (consoleDiv) {
    consoleDiv.style.minHeight = '400px';
    consoleDiv.style.maxHeight = '800px';
    consoleDiv.style.overflowY = 'auto';
    consoleDiv.style.fontSize = '1.05em';
  }

  // chunkサイズ・抽出数パラメータUI削除（不要）
  const paramDiv = document.querySelector('.params-extra');
  if (paramDiv) paramDiv.remove();
});

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
    let msg = data.message;
    // 類似度スコア付きchunk抽出ログ
    if (data.kind === 'search' && data.similarities) {
      msg += '<br><b>抽出された重要chunkと類似度:</b><ul>';
      data.similarities.forEach((sim, i) => {
        msg += `<li>chunk${i+1}: 類似度=${typeof sim.score === 'number' ? sim.score.toFixed(3) : 'N/A'}<br><span style='font-size:0.9em;color:#555'>${sim.text}</span></li>`;
      });
      msg += '</ul>';
    }
    // 類似度分布の根拠説明
    if (data.kind === 'search' && data.distribution) {
      msg += '<details style="margin-top:4px"><summary>全chunkの類似度分布（根拠を表示）</summary><ul>';
      data.distribution.forEach((sim, i) => {
        msg += `<li>chunk${i+1}: 類似度=${typeof sim.score === 'number' ? sim.score.toFixed(3) : 'N/A'}</li>`;
      });
      msg += '</ul></details>';
    }
    line.innerHTML = `<span class="tag" style="background:${colorByKind[data.kind]||'#4a5568'}">[${kind}]</span> <span class="time">${ts}</span> <span class="msg">${msg}</span>`;
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

  const tempVal = Number(byId('temp').value);
  const creativeVal = Number(byId('creative').value);
  // chunkSize, topN, topK, topK_finalは固定値
  const body = {
    persons,
    temp: tempVal,
    creative: creativeVal,
    chunkSize: 300,
    topN: 3,
    topK: 12,
    topK_final: 6
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
  const params = document.createElement('div');
  params.className = 'params';
  params.innerHTML = `<b>重み:</b> ${persons.map(p=>p.weight).join(', ')}　<b>温度:</b> ${tempVal}　<b>創造度:</b> ${creativeVal}`;
  byId('card').innerHTML = '';
  byId('card').appendChild(params);
  // 生成文（profile）があれば表示
  if (data.profile) {
    const profileDiv = document.createElement('div');
    profileDiv.className = 'profile';
    profileDiv.textContent = data.profile;
    byId('card').appendChild(profileDiv);
  }
  const sources = byId('sources');
  sources.innerHTML = '';
  (data.sources||[]).forEach(s => sources.appendChild(pill(s.title, s.url)));
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
