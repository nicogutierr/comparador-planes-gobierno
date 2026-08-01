import { NextRequest, NextResponse } from "next/server";
import { getIndex } from "@/lib/index";
import { embedQuery } from "@/lib/embeddings";
import { callOpenRouter, ORMessage } from "@/lib/openrouter";
import { CANDIDATOS } from "@/lib/types";
import type { ScoredChunk } from "@/lib/types";

export const runtime = "nodejs";

function buildContextPorCandidato(chunks: ScoredChunk[]): string {
  const porCandidato = new Map<string, ScoredChunk[]>();
  for (const c of chunks) {
    if (!porCandidato.has(c.candidato)) porCandidato.set(c.candidato, []);
    porCandidato.get(c.candidato)!.push(c);
  }
  let out = "";
  for (const [candidato, items] of porCandidato.entries()) {
    out += `\n### ${candidato} (${items[0].partido})\n`;
    for (const it of items) {
      out += `[p. ${it.pagina}] ${it.texto}\n\n`;
    }
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { apiKey, model, tema, candidatos } = body as {
      apiKey: string;
      model: string;
      tema: string;
      candidatos?: string[];
    };

    if (!apiKey) {
      return NextResponse.json({ error: "Falta la API key de OpenRouter." }, { status: 400 });
    }
    if (!tema || tema.trim().length < 3) {
      return NextResponse.json({ error: "Escribe un tema para comparar." }, { status: 400 });
    }

    const listaCandidatos = candidatos?.length ? candidatos : [...CANDIDATOS];
    const index = getIndex();
    const queryEmbedding = await embedQuery(apiKey, tema);
    const chunks = index.searchPerCandidato(queryEmbedding, listaCandidatos, 4);

    const encontrados = new Set(chunks.map((c) => c.candidato));
    const sinDatos = listaCandidatos.filter((c) => !encontrados.has(c));

    const context = buildContextPorCandidato(chunks);

    const messages: ORMessage[] = [
      {
        role: "system",
        content: `Eres un asistente de comparación electoral neutral para las Elecciones Generales del Perú 2026. Respondes SIEMPRE en español.

Se te dan fragmentos de los planes de gobierno de varios candidatos, agrupados por candidato, sobre un tema específico.

Devuelve tu respuesta ÚNICAMENTE como un array JSON válido (sin texto adicional, sin markdown, sin \`\`\`), con esta forma exacta:
[
  {"candidato": "Nombre", "partido": "Partido", "propuesta": "Resumen de 2-3 oraciones de lo que propone sobre el tema, citando páginas como (p. X) dentro del texto.", "sin_informacion": false}
]

Reglas:
- Si un candidato no tiene fragmentos suficientes sobre el tema, pon "propuesta": "No se encontró información suficiente sobre este tema en el plan disponible." y "sin_informacion": true.
- No opines, no compares cuál propuesta es "mejor". Solo resume objetivamente cada una.
- Cita SIEMPRE la página entre paréntesis, ej: (p. 12).
- No inventes propuestas fuera de los fragmentos dados.`,
      },
      {
        role: "user",
        content: `Tema a comparar: "${tema}"\n\nCandidatos a incluir: ${listaCandidatos.join(", ")}\n\nFragmentos por candidato:\n${context}\n\n${
          sinDatos.length
            ? `Nota: no se encontraron fragmentos relevantes para: ${sinDatos.join(", ")}. Márcalos con sin_informacion: true.`
            : ""
        }`,
      },
    ];

    const raw = await callOpenRouter(apiKey, model || "openai/gpt-4o-mini", messages, 0.1);

    let parsed: any[] = [];
    try {
      const match = raw.match(/\[[\s\S]*\]/);
      parsed = JSON.parse(match ? match[0] : raw);
    } catch {
      // fallback: si el modelo no devolvió JSON limpio, se entrega el texto crudo
      return NextResponse.json({
        comparacion: null,
        textoCrudo: raw,
      });
    }

    return NextResponse.json({
      comparacion: parsed,
      textoCrudo: null,
      fuentes: chunks.map((c) => ({
        candidato: c.candidato,
        partido: c.partido,
        pagina: c.pagina,
      })),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error inesperado en el servidor." },
      { status: 500 }
    );
  }
}
