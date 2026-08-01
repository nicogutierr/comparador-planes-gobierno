# Comparador de Planes de Gobierno · Perú 2026

Trabajo final del curso **E-Government Intelligence** (PUCP, Q-LAB). Asistente que permite
consultar y comparar las propuestas de los planes de gobierno presentados ante el JNE para las
Elecciones Generales del Perú 2026, citando siempre candidato y página fuente.

## Candidatos incluidos

| Candidato | Partido | Páginas del plan |
|---|---|---|
| Keiko Fujimori | Fuerza Popular | 137 |
| Roberto Sánchez | Juntos por el Perú | 70 |
| Rafael López Aliaga | Renovación Popular | 25 |
| Jorge Nieto | Partido del Buen Gobierno | 80 |
| Ricardo Belmont | Partido Cívico Obras | 27 |
| Carlos Álvarez | País para Todos | 48 |
| Alfonso López-Chau | Ahora Nación | 145 |

Fuente: planes de gobierno oficiales presentados ante el Jurado Nacional de Elecciones (JNE),
descargados directamente de la Plataforma Electoral del JNE en formato markdown (conversión
oficial del PDF presentado por cada organización política). Los archivos originales están en
`fuentes-oficiales/` (no se despliegan; solo se usa `data/chunks.json`, generado con
`extract_chunks_md.py`, que detecta los marcadores de página del propio documento para mantener
la cita exacta).

## Cómo funciona

1. Los 7 planes se segmentaron en 2,019 fragmentos citables (`extract_chunks_md.py` →
   `data/chunks.json`), con overlap de 150 caracteres entre fragmentos consecutivos.
2. Cada fragmento tiene un **embedding** precalculado (`scripts/build-embeddings.mjs`, modelo
   `openai/text-embedding-3-small` de 512 dimensiones vía OpenRouter) — mismo modelo y mismo
   patrón que usa `src/lib/rag.ts` en el proyecto de clase `chatbot-neo4j`, para mantener
   consistencia con la técnica enseñada en el curso.
3. En cada consulta, la app calcula el embedding de la pregunta del usuario (con su propia API
   key) y busca los fragmentos más cercanos por **similitud coseno** (`lib/embeddings.ts`) — de
   un candidato o de varios a la vez.
4. Esos fragmentos se envían como contexto a un modelo de chat vía **OpenRouter**, con
   instrucciones estrictas de responder solo con lo que dice el contexto y citar siempre
   `(Candidato, p. X)`.
5. **Modo simple**: pregunta libre, respuesta con fuentes.
   **Modo comparativo**: eliges un tema y candidatos; el sistema hace retrieval independiente
   por candidato y arma una tarjeta por candidato con su propuesta y citas.

No requiere base de datos vectorial externa (Pinecone, etc.): los 2,019 embeddings van
precalculados en `data/chunks.json` (~12 MB) y la búsqueda por coseno corre en la misma función
serverless. Solo se necesita la API key de OpenRouter, tanto para generar el embedding de la
pregunta como para la respuesta del modelo de chat.

## Requisitos cumplidos

- Deploy en Vercel con campo para pegar la API key de OpenRouter (no hay `.env` que configurar
  para usarlo — el evaluador solo pega su key en la interfaz).
- Datos ya poblados y ya vectorizados (`data/chunks.json` va en el repo con los embeddings
  incluidos; el evaluador no necesita generar nada, solo preguntar).
- Interfaz y respuestas en español.

## Desarrollo local

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`, pega tu API key de OpenRouter (openrouter.ai/keys) y prueba.
Probado end-to-end (modo simple y modo comparativo, con key real) antes de la entrega.

## Deploy en Vercel

1. Sube esta carpeta a un repositorio de GitHub (nuevo repo, `git init && git add . && git commit -m "inicial" && git push`).
2. En [vercel.com](https://vercel.com) → **New Project** → importa el repo.
3. Framework: Next.js (detectado automáticamente). No hace falta configurar variables de entorno:
   la API key la pega cada usuario en la interfaz, no vive en el servidor.
4. Deploy. Vercel te da una URL pública — esa es la que entregas junto con el repositorio.

## Reprocesar las fuentes o regenerar embeddings (opcional)

Si agregas o cambias algún plan de gobierno en `fuentes-oficiales/` (formato .md, con marcadores
de página en líneas que contienen solo un número):

```bash
python3 extract_chunks_md.py                 # regenera data/chunks.json (sin embeddings)
OPENROUTER_API_KEY=sk-or-v1-... node scripts/build-embeddings.mjs   # agrega los embeddings
```

`build-embeddings.mjs` es resumible: guarda progreso después de cada lote de 40 chunks y se
puede volver a correr si se interrumpe (salta los que ya tienen embedding). El script alternativo
`extract_chunks.py` (procesa PDF con `pypdf`) se conserva por si se vuelve a trabajar con PDF.

## Limitaciones conocidas (para la sección de riesgos del documento de diseño)

- El retrieval es semántico (embeddings + similitud coseno), no perfecto para nombres propios:
  en una prueba real, la pregunta "¿qué propone Jorge Nieto sobre IA?" **sin** usar el filtro de
  candidato mezcló fragmentos de otros candidatos, porque el embedding pondera más el tema
  ("inteligencia artificial en el Estado") que el nombre propio. Con el filtro de candidato
  activado (como hace el modo comparativo por diseño) la respuesta es correcta y específica.
  Es el mismo tipo de límite que ya identificaron en clase con los números de PL en
  `chatbot-neo4j` (los embeddings no distinguen bien tokens "exactos": nombres, números, siglas),
  resuelto ahí con un match exacto por regex como refuerzo — aquí se resuelve pidiendo al usuario
  seleccionar el candidato explícitamente en vez de nombrarlo dentro de la pregunta.
- Los documentos varían mucho en extensión (25 a 145 páginas) — candidatos con planes más
  extensos podrían aparecer sobrerrepresentados en una búsqueda libre sin filtro. Mitigación: el
  modo comparativo busca el mismo top-k *por candidato*, no en conjunto.
- El texto de "Roberto Sánchez" corresponde al plan de consenso post-primera vuelta (2026-06),
  distinto al plan original de Juntos por el Perú de la primera vuelta — se documenta
  explícitamente por trazabilidad.
- Herramienta informativa, no oficial ni afiliada a ningún partido ni al JNE.
