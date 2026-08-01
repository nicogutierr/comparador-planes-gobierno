import type { Chunk, ScoredChunk } from "./types";

// Mismo patrón que src/lib/rag.ts del proyecto de clase (chatbot-neo4j):
// embeddings vía OpenRouter (openai/text-embedding-3-small, 512d) + similitud coseno.
// La diferencia con el chat de clase (que responde una sola entidad, ej. un PL) es que
// aquí necesitamos comparar VARIOS candidatos a la vez, así que se agrega
// searchPerCandidato() para hacer retrieval independiente por candidato (ver README,
// sección de riesgos: evita que un plan más extenso domine los resultados).

export const EMBED_MODEL = "openai/text-embedding-3-small";
export const EMBED_DIMENSIONS = 512;

export async function embedQuery(apiKey: string, query: string): Promise<number[]> {
  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: query, dimensions: EMBED_DIMENSIONS }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`OpenRouter embeddings error: ${res.status} ${err || res.statusText}`);
  }
  const data = await res.json();
  return data.data[0].embedding as number[];
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class VectorIndex {
  constructor(private chunks: (Chunk & { embedding: number[] })[]) {}

  search(queryEmbedding: number[], topK = 8, filterCandidatos?: string[]): ScoredChunk[] {
    const pool = filterCandidatos && filterCandidatos.length
      ? this.chunks.filter((c) => filterCandidatos.includes(c.candidato))
      : this.chunks;

    const scored: ScoredChunk[] = pool.map((c) => ({
      ...c,
      score: cosineSimilarity(queryEmbedding, c.embedding),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  searchPerCandidato(queryEmbedding: number[], candidatos: string[], topKEach = 4): ScoredChunk[] {
    const out: ScoredChunk[] = [];
    for (const cand of candidatos) {
      out.push(...this.search(queryEmbedding, topKEach, [cand]));
    }
    return out;
  }
}
