import json, re, glob
from pypdf import PdfReader

META = {
    "fujimori.pdf":      {"candidato": "Keiko Fujimori",        "partido": "Fuerza Popular"},
    "sanchez.pdf":       {"candidato": "Roberto Sánchez",       "partido": "Juntos por el Perú"},
    "lopez_aliaga.pdf":  {"candidato": "Rafael López Aliaga",   "partido": "Renovación Popular"},
    "nieto.pdf":         {"candidato": "Jorge Nieto",           "partido": "Partido del Buen Gobierno"},
    "belmont.pdf":       {"candidato": "Ricardo Belmont",       "partido": "Partido Cívico Obras"},
    "alvarez.pdf":       {"candidato": "Carlos Álvarez",        "partido": "País para Todos"},
    "lopez_chau.pdf":    {"candidato": "Alfonso López-Chau",    "partido": "Ahora Nación"},
}

CHUNK_SIZE = 900
OVERLAP = 150

def clean(txt):
    txt = re.sub(r'[ \t]+', ' ', txt)
    txt = re.sub(r'\n{2,}', '\n', txt)
    return txt.strip()

def chunk_text(txt, size=CHUNK_SIZE, overlap=OVERLAP):
    txt = txt.strip()
    if len(txt) < 50:
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
for path in sorted(glob.glob('fuentes/*.pdf')):
    fname = path.split('/')[-1]
    meta = META[fname]
    reader = PdfReader(path)
    for page_num, page in enumerate(reader.pages, start=1):
        raw = page.extract_text() or ''
        text = clean(raw)
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
    print(f"{fname}: procesado ({page_num} páginas)")

print(f"\nTotal chunks: {len(all_chunks)}")
with open('data/chunks.json', 'w', encoding='utf-8') as f:
    json.dump(all_chunks, f, ensure_ascii=False)

# tiny stats
from collections import Counter
c = Counter(ch['candidato'] for ch in all_chunks)
for k, v in c.items():
    print(f"  {k}: {v} chunks")
