import { NextRequest, NextResponse } from "next/server";
import { getIndex } from "@/lib/index";
import { embedQuery } from "@/lib/embeddings";
import { callOpenRouter, ORMessage } from "@/lib/openrouter";
import type { ScoredChunk } from "@/lib/types";

export const runtime = "nodejs";

function buildContext(chunks: ScoredChunk[]): string {
  return chunks
    .map(
      (c, i) =>
        `[Fragmento ${i + 1} | ${c.candidato} (${c.partido}), p. ${c.pagina}]\n${c.texto}`
    )
    .join("\n\n---\n\n");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { apiKey, model, pregunta, candidatos } = body as {
      apiKey: string;
      model: string;
      pregunta: string;
      candidatos?: string[];
    };

    if (!apiKey) {
      return NextResponse.json(
        { error: "Falta la API key de OpenRouter." },
        { status: 400 }
      );
    }
    if (!pregunta || pregunta.trim().length < 3) {
      return NextResponse.json(
        { error: "Escribe una pregunta." },
        { status: 400 }
      );
    }

    const index = getIndex();
    const queryEmbedding = await embedQuery(apiKey, pregunta);
    const results = index.search(queryEmbedding, 10, candidatos?.length ? candidatos : undefined);

    if (results.length === 0) {
      return NextResponse.json({
        respuesta:
          "No encontré fragmentos relevantes en los planes de gobierno cargados para responder esta pregunta. Intenta reformularla o ser más específico.",
        fuentes: [],
      });
    }

    const context = buildContext(results);

    const messages: ORMessage[] = [
      {
        role: "system",
        content: `Eres un asistente de consulta ciudadana sobre los planes de gobierno de las Elecciones Generales del Perú 2026. Respondes SIEMPRE en español, de forma clara y neutral, sin opinar ni favorecer a ningún candidato.

Reglas estrictas:
1. Responde ÚNICAMENTE con base en los fragmentos de contexto proporcionados. Si el contexto no contiene la respuesta, dilo explícitamente: "Los fragmentos disponibles no cubren este punto con suficiente detalle."
2. Cita SIEMPRE el candidato y el número de página entre paréntesis después de cada afirmación, así: (Candidato, p. X).
3. No inventes propuestas ni completes información que no esté en el contexto.
4. Sé conciso: responde en 3-6 oraciones o una lista breve.
5. Recuerda al usuario, si es pertinente, que esto es un resumen informativo y no reemplaza la lectura del plan completo.`,
      },
      {
        role: "user",
        content: `Pregunta del ciudadano: "${pregunta}"\n\nFragmentos recuperados de los planes de gobierno:\n\n${context}`,
      },
    ];

    const respuesta = await callOpenRouter(apiKey, model || "openai/gpt-4o-mini", messages);

    return NextResponse.json({
      respuesta,
      fuentes: results.map((r) => ({
        candidato: r.candidato,
        partido: r.partido,
        pagina: r.pagina,
      })),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error inesperado en el servidor." },
      { status: 500 }
    );
  }
}
