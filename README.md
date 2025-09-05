# GenAI Wikipedia RAG (Vercel版)

## 概要
- Wikipedia人物1〜3名をRAGで参照し、掛け合わせた『架空の新人物』プロフィールを生成
- SSEログ/メトリクス/traceエクスポート/カードHTML出力
- Vercel Serverless/Edge Functions対応

## ディレクトリ構成
- `/api/` ... Vercel API (mix, logs/stream)
- `/public/` ... フロント (index.html, app.js, style.css)
- `.env.example` ... サンプル環境変数
- `vercel.json` ... ルーティング

## 不要ファイル削除手順
- `server.js` ... Expressサーバは不要
- `logs/`, `GenAI-wikipedia-RAG/`, `bfg-1.15.0.jar`, `replacements.txt` なども不要

## デプロイ
1. Vercelで新規プロジェクト作成
2. 環境変数（OPENAI_API_KEY等）を設定
3. `vercel deploy` で公開

---

Express版からVercel構成へ完全移行済み。
