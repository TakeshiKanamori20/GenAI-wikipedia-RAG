// Vercel Serverless Function: /api/mix
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  // TODO: RAG生成ロジックをここに実装
  // 例: Wikipedia取得→分割→埋め込み→検索→LLM生成
  return res.status(200).json({ message: 'RAG生成API（仮）' });
}
