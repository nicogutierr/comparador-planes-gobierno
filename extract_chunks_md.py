import json, re, glob, os

META = {
    "AHORA_NACION_-_AN.md":        {"candidato": "Alfonso López-Chau",    "partido": "Ahora Nación"},
    "FUERZA_POPULAR.md":           {"candidato": "Keiko Fujimori",        "partido": "Fuerza Popular"},
    "JUNTOS_POR_EL_PERU.md":       {"candidato": "Roberto Sánchez",       "partido": "Juntos por el Perú"},
    "PARTIDO_CIVICO_OBRAS.md":     {"candidato": "Ricardo Belmont",       "partido": "Partido Cívico Obras"},
    "PARTIDO_DEL_BUEN_GOBIERNO.md":{"candidato": "Jorge Nieto",           "partido": "Partido del Buen Gobierno"},
    "PARTIDO_PAIS_PARA_TODOS.md":  {"candidato": "Carlos Álvarez",        "partido": "País para Todos"},
    "RENOVACION_POPULAR.md":       {"candidato": "Rafael López Aliaga",   "partido": "Renovación Popular"},
}

CHUNK_SIZE = 900
OVERLAP = 150
PAGE_MARKER = re.compile(r'^\s*(\d{1,3})\s*$')

def clean(txt: str) -> str:
    txt = txt.replace("**", "").replace("*", "")
    txt = re.sub(r'[ \t]+', ' ', txt)
    txt = re.sub(r'\n{2,}', '\n', txt)
    return txt.strip()

def split_by_page(raw_text: str):
    """Divide el markdown en páginas usando líneas que son solo un número
    (marcador de página dejado por la conversión PDF -> markdown)."""
    lines = raw_text.split("\n")
    pages = []
    buffer = []
    current_page_guess = 1
    for line in lines:
        m = PAGE_MARKER.match(line)
        if m:
            page_num = int(m.group(1))
            # Solo lo tratamos como marcador de página si es un número plausible
            # (evita capturar años como 2026, cifras de presupuesto, etc.)
            if 1 <= page_num <= 400 and (not pages or page_num >= pages[-1][0] - 1):
                text = "\n".join(buffer).strip()
                if text:
                    pages.append((page_num, text))
                buffer = []
                current_page_guess = page_num + 1
                continue
        buffer.append(line)
    # texto remanente después del último marcador
    tail = "\n".join(buffer).strip()
    if tail:
        pages.append((current_page_guess, tail))
    return pages

def chunk_text(txt, size=CHUNK_SIZE, overlap=OVERLAP):
    txt = txt.strip()
    if len(txt) < 40:
        return []
    chunks = []
    start = 0
    while start < len(txt):
        end = min(start + size, len(txt))
        chunk = txt[start:end]
        if len(chunk.strip()) > 40:
            chunks.append(chunk.strip())
        if end == len(txt):
            break
        start = end - overlap
    return chunks

all_chunks = []
cid = 0
for path in sorted(glob.glob('fuentes-oficiales/*.md')):
    fname = os.path.basename(path)
    meta = META[fname]
    with open(path, encoding='utf-8') as f:
        raw = f.read()
    pages = split_by_page(raw)
    n_chunks_file = 0
    for page_num, page_text in pages:
        text = clean(page_text)
        if not text:
            continue
        for c in chunk_text(text):
            all_chunks.append({
                "id": cid,
                "candidato": meta["candidato"],
                "partido": meta["partido"],
                "archivo": fname,
                "pagina": page_num,
                "texto": c
            })
            cid += 1
            n_chunks_file += 1
    print(f"{fname}: {len(pages)} páginas detectadas, {n_chunks_file} chunks")

print(f"\nTotal chunks: {len(all_chunks)}")
with open('data/chunks.json', 'w', encoding='utf-8') as f:
    json.dump(all_chunks, f, ensure_ascii=False)

from collections import Counter
c = Counter(ch['candidato'] for ch in all_chunks)
for k, v in c.items():
    print(f"  {k}: {v} chunks")
