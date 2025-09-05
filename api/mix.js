// テキスト分割関数
function splitText(text, chunkSize = 300) {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

// OpenAI Embedding APIでベクトル化
async function getEmbeddings(texts, apiKey) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'text-embedding-ada-002',
      input: texts
    })
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data.map(d => d.embedding);
}

// コサイン類似度計算
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
// Vercel Serverless Function: /api/mix

import fetch from 'node-fetch';

export const config = { runtime: 'nodejs' };

async function fetchWikipediaSummary(name) {
  const url = `https://ja.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;
  const res = await fetch(url);
  if (!res.ok) return '';
  const data = await res.json();
  return data.extract || '';
}

async function callOpenAIProfile(persons, temp, creative) {
  const apiKey = process.env.OPENAI_API_KEY;
  const prompt = `以下の3人のWikipedia要約を参考に、重みを考慮して合成した架空人物のプロフィールを日本語で作成してください。\n\n` +
    persons.map(p => `${p.name} (${p.weight}): ${p.summary}`).join('\n') +
    `\n\n温度: ${temp}, 創造度: ${creative}`;
  const body = {
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'あなたはWikipedia情報を元に人物プロフィールを生成するAIです。' },
      { role: 'user', content: prompt }
    ],
    temperature: temp,
    max_tokens: 512
  };
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) return '生成失敗';
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '生成失敗';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { persons, temp, creative, chunkSize = 300, topN = 3 } = req.body;
  if (!persons || persons.length === 0) {
    return res.status(400).json({ error: '人物情報がありません' });
  }
  const logs = [];
  const t0 = Date.now();
  logs.push({ ts: t0, kind: 'load', message: '人物名からWikipediaの説明文を集めています。' });
  const personsWithSummary = await Promise.all(persons.map(async p => {
    const summary = await fetchWikipediaSummary(p.name);
    if (!summary) {
      logs.push({ ts: Date.now(), kind: 'warning', message: `${p.name} のWikipedia説明文が取得できませんでした。` });
    }
    return { ...p, summary };
  }));
  // 分割
  const allChunks = personsWithSummary.flatMap(p => splitText(p.summary, chunkSize));
  const chunkCount = allChunks.length;
  logs.push({ ts: Date.now(), kind: 'split', message: `Wikipediaの説明文を分割しています（分割数: ${chunkCount}）。` });
  // Embedding
  logs.push({ ts: Date.now(), kind: 'embed', message: `分割した${chunkCount}個のテキストをEmbedding（ベクトル化）します。` });
  const apiKey = process.env.OPENAI_API_KEY;
  const embeddings = await getEmbeddings(allChunks, apiKey);
  // クエリベクトル（合成人物の特徴を抽出したい場合、全説明文を結合）
  const queryText = personsWithSummary.map(p => p.summary).join(' ');
  const [queryEmbedding] = await getEmbeddings([queryText], apiKey);
  // 類似度計算
  const similarities = embeddings.map(e => cosineSimilarity(e, queryEmbedding));
  // 類似度上位3つのテキストを重要部分として抽出
  const importantChunks = allChunks
    .map((chunk, i) => ({ chunk, score: similarities[i] }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(obj => obj.chunk);
  // 類似度上位chunkとスコアをsearchログに含める
  // 全chunkの類似度分布も含める
  logs.push({
    ts: Date.now(),
    kind: 'search',
    message: `Embeddingベクトルの類似度計算で重要な部分を抽出しました（上位${topN}件）。`,
    similarities: importantChunks.map((chunk, idx) => {
      const i = allChunks.findIndex(c => c === chunk);
      return {
        text: chunk,
        score: similarities[i] || 0
      };
    }),
    distribution: allChunks.map((chunk, i) => ({
      text: chunk,
      score: similarities[i]
    }))
  });
  // OpenAIで合成プロフィール生成（重要部分のみプロンプトに含める）
  const personsWithImportant = personsWithSummary.map(p => ({
    ...p,
    summary: importantChunks.join('\n')
  }));
  logs.push({ ts: Date.now(), kind: 'llm', message: `LLM（AI）に「3人の特徴を合成した架空人物のプロフィールを作って」とお願いしています（プロンプト長: ${queryText.length}文字）。` });
  const profile = await callOpenAIProfile(personsWithImportant, temp, creative);
  logs.push({ ts: Date.now(), kind: 'done', message: '合成プロフィールが完成しました！' });
  // メトリクス例（ダミー）
  const metrics = {
    fetchMs: 0,
    splitMs: 0,
    embedMs: 0,
    indexMs: 0,
    searchMs: 0,
    rankMs: 0,
    genMs: 0,
    totalMs: 0,
    chunksUsed: chunkCount,
    chunksTotal: chunkCount,
    promptTokensEst: totalText.length,
    completionTokensEst: profile.length
  };
  res.status(200).json({ profile, metrics, logs });
}
