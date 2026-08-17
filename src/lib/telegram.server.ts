// Server-only Telegram alerting helper.

export async function sendTelegram(
  botToken: string | null | undefined,
  chatId: string | null | undefined,
  text: string,
): Promise<{ ok: boolean; message: string }> {
  if (!botToken || !chatId) {
    return { ok: false, message: "Telegram is not configured (bot token or chat ID missing)." };
  }
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  const body = (await res.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
  if (!res.ok || !body?.ok) {
    return {
      ok: false,
      message: `Telegram error [${res.status}]: ${body?.description ?? "unknown error"}`,
    };
  }
  return { ok: true, message: "Telegram message sent." };
}
