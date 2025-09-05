// RAG生成APIのログを簡易SSEで返す（コスト・難易度最小化版）
// ※本番ではセッションごとにサーバ側でログ保持が必要だが、ここではAPI呼び出し直後のみ最新ログを返す
export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  if (!sessionId) {
    return new Response('sessionId required', { status: 400 });
  }
  // ログはサーバ側で保持しないため、SSEで1回だけダミーで返す
  const encoder = new TextEncoder();
  const log = { ts: Date.now(), kind: 'info', message: 'RAG生成ログはAPI応答のtraceで確認してください' };
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`event: log\ndata: ${JSON.stringify(log)}\n\n`));
      controller.close();
    }
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  });
}
