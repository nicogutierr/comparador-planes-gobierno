import { readFile, writeFile } from "fs/promises";
import path from "path";

// Mismo patrón que scripts/build-rag-index.mjs del proyecto de clase (chatbot-neo4j):
// embeddings de OpenRouter, mismo modelo y mismas dimensiones.
//
// Resumible por tiempo: guarda progreso en data/chunks.json después de cada lote,
// y se detiene sola tras ~TIME_BUDGET_MS para poder correrse en varias invocaciones
// cortas (útil en entornos con límite de tiempo por comando). Volver a correr el
// script continúa donde quedó (salta los chunks que ya tienen "embedding").

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  console.error("Falta OPENROUTER_API_KEY. Ejemplo:");
  console.error("  OPENROUTER_API_KEY=sk-or-v1-... node scripts/build-embeddings.mjs");
  process.exit(1);
}

const EMBED_MODEL = "openai/text-embedding-3-small";
const EMBED_DIMENSIONS = 512;
const DATA_PATH = path.resolve("data/chunks.json");
const BATCH_SIZE = 40;
const TIME_BUDGET_MS = Number(process.env.TIME_BUDGET_MS || 35000);

async function embedBatch(texts) {
  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts, dimensions: EMBED_DIMENSIONS }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter embeddings error: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.data.map((d) => d.embedding.map((x) => Math.round(x * 1e5) / 1e5));
}

async function main() {
  const started = Date.now();
  const chunks = JSON.parse(await readFile(DATA_PATH, "utf-8"));

  const pending = chunks.filter((c) => !c.embedding);
  console.log(`Total: ${chunks.length} | ya embebidos: ${chunks.length - pending.length} | pendientes: ${pending.length}`);

  if (pending.length === 0) {
    console.log("DONE: no quedan chunks pendientes.");
    return;
  }

  let processed = 0;
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    if (Date.now() - started > TIME_BUDGET_MS) {
      console.log(`Tiempo agotado, guardando progreso parcial (${processed} procesados en esta corrida).`);
      break;
    }
    const batch = pending.slice(i, i + BATCH_SIZE);
    let embeddings;
    let attempt = 0;
    while (true) {
      try {
        embeddings = await embedBatch(batch.map((c) => c.texto));
        break;
      } catch (e) {
        attempt++;
        if (attempt > 3) throw e;
        await new Promise((r) => setTimeout(r, 800 * attempt));
      }
    }
    batch.forEach((c, j) => {
      c.embedding = embeddings[j];
    });
    processed += batch.length;
    await writeFile(DATA_PATH, JSON.stringify(chunks), "utf-8");
    console.log(`Guardado progreso: ${chunks.length - chunks.filter((c) => !c.embedding).length}/${chunks.length}`);
  }

  const remaining = chunks.filter((c) => !c.embedding).length;
  if (remaining === 0) {
    console.log("DONE: todos los chunks tienen embedding.");
  } else {
    console.log(`PENDING: quedan ${remaining} chunks. Volver a correr el script para continuar.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
