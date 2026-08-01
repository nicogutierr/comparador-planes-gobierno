export interface ORMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function callOpenRouter(
  apiKey: string,
  model: string,
  messages: ORMessage[],
  temperature = 0.2
): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://comparador-planes-gobierno.vercel.app",
      "X-Title": "Comparador de Planes de Gobierno - PUCP E-Government",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `OpenRouter respondió ${res.status}: ${errText || res.statusText}`
    );
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter no devolvió contenido en la respuesta.");
  }
  return content as string;
}

export const MODELO_FIJO = "openai/gpt-4o-mini";
