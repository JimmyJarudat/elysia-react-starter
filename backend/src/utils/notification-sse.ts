type SSEController = ReadableStreamDefaultController;

const connections = new Map<number, Set<SSEController>>();

export function sseSubscribe(userId: number, controller: SSEController) {
  if (!connections.has(userId)) connections.set(userId, new Set());
  connections.get(userId)!.add(controller);
}

export function sseUnsubscribe(userId: number, controller: SSEController) {
  connections.get(userId)?.delete(controller);
  if (connections.get(userId)?.size === 0) connections.delete(userId);
}

export function ssePushToUser(userId: number, event: object) {
  const userConns = connections.get(userId);
  if (!userConns?.size) return;

  const encoder = new TextEncoder();
  const payload = encoder.encode(`data: ${JSON.stringify(event)}\n\n`);

  for (const ctrl of [...userConns]) {
    try {
      ctrl.enqueue(payload);
    } catch {
      userConns.delete(ctrl);
    }
  }
}
