"use client";

import { useEffect, useState } from "react";
import { CANDIDATOS, PARTIDOS } from "@/lib/types";
import { MODELO_FIJO } from "@/lib/openrouter";

type Tab = "simple" | "comparativo";

const EJEMPLOS_TEMA = [
  "seguridad ciudadana",
  "educación",
  "salud",
  "minería informal",
  "empleo juvenil",
  "reforma del sistema de pensiones",
];

const EJEMPLOS_SIMPLE = [
  "¿Qué propone sobre becas educativas?",
  "¿Qué propone sobre formalización laboral?",
  "¿Qué medidas plantea contra la corrupción?",
  "¿Qué propone sobre infraestructura de agua y saneamiento?",
];

interface FuenteRef {
  candidato: string;
  partido: string;
  pagina: number;
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  fuentes?: FuenteRef[];
  error?: boolean;
}

interface CompareItem {
  candidato: string;
  partido: string;
  propuesta: string;
  sin_informacion?: boolean;
}

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const model = MODELO_FIJO;
  const [tab, setTab] = useState<Tab>("comparativo");

  // modo simple
  const [pregunta, setPregunta] = useState("");
  const [candidatosSimple, setCandidatosSimple] = useState<string[]>([]);
  const [mensajes, setMensajes] = useState<ChatMsg[]>([]);
  const [cargandoSimple, setCargandoSimple] = useState(false);

  // modo comparativo
  const [tema, setTema] = useState("");
  const [candidatosCompare, setCandidatosCompare] = useState<string[]>([...CANDIDATOS]);
  const [resultado, setResultado] = useState<CompareItem[] | null>(null);
  const [textoCrudo, setTextoCrudo] = useState<string | null>(null);
  const [cargandoCompare, setCargandoCompare] = useState(false);
  const [errorCompare, setErrorCompare] = useState<string | null>(null);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("or_api_key") : null;
    if (saved) setApiKey(saved);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && apiKey) {
      localStorage.setItem("or_api_key", apiKey);
    }
  }, [apiKey]);

  function toggleCand(list: string[], setList: (l: string[]) => void, c: string) {
    if (list.includes(c)) setList(list.filter((x) => x !== c));
    else setList([...list, c]);
  }

  async function enviarPregunta() {
    if (!pregunta.trim() || !apiKey) return;
    const q = pregunta.trim();
    setMensajes((m) => [...m, { role: "user", content: q }]);
    setPregunta("");
    setCargandoSimple(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          model,
          pregunta: q,
          candidatos: candidatosSimple,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMensajes((m) => [...m, { role: "assistant", content: data.error || "Error", error: true }]);
      } else {
        setMensajes((m) => [
          ...m,
          { role: "assistant", content: data.respuesta, fuentes: data.fuentes },
        ]);
      }
    } catch (e: any) {
      setMensajes((m) => [...m, { role: "assistant", content: String(e), error: true }]);
    } finally {
      setCargandoSimple(false);
    }
  }

  async function compararTema() {
    if (!tema.trim() || !apiKey) return;
    setCargandoCompare(true);
    setErrorCompare(null);
    setResultado(null);
    setTextoCrudo(null);
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          model,
          tema: tema.trim(),
          candidatos: candidatosCompare,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorCompare(data.error || "Error al comparar.");
      } else if (data.comparacion) {
        setResultado(data.comparacion);
      } else {
        setTextoCrudo(data.textoCrudo);
      }
    } catch (e: any) {
      setErrorCompare(String(e));
    } finally {
      setCargandoCompare(false);
    }
  }

  return (
    <div className="container">
      <header className="app">
        <h1>🗳️ Comparador de Planes de Gobierno · Perú 2026</h1>
        <p>
          Consulta y compara propuestas de los planes de gobierno presentados ante el JNE, con
          cita de candidato y página. Trabajo final · E-Government (PUCP).
        </p>
      </header>

      <div className="panel">
        <label>API key de OpenRouter</label>
        <input
          type="password"
          placeholder="sk-or-v1-..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        <p className="hint">
          Tu API key se guarda solo en tu navegador (localStorage) y se envía directamente a
          OpenRouter en cada consulta. No se almacena en ningún servidor. El modelo usado es
          GPT-4o mini.
        </p>
      </div>

      <div className="tabs">
        <div className={`tab ${tab === "comparativo" ? "active" : ""}`} onClick={() => setTab("comparativo")}>
          Modo comparativo
        </div>
        <div className={`tab ${tab === "simple" ? "active" : ""}`} onClick={() => setTab("simple")}>
          Modo simple (chat)
        </div>
      </div>

      {tab === "comparativo" && (
        <div className="panel">
          <label>Candidatos a comparar</label>
          <div className="row" style={{ marginBottom: 12 }}>
            {CANDIDATOS.map((c) => (
              <span
                key={c}
                className={`chip chip-candidato ${candidatosCompare.includes(c) ? "selected" : ""}`}
                onClick={() => toggleCand(candidatosCompare, setCandidatosCompare, c)}
              >
                {c}
                <small>{PARTIDOS[c]}</small>
              </span>
            ))}
          </div>

          <label>Tema a comparar</label>
          <div className="row">
            <input
              type="text"
              placeholder="Ej: seguridad ciudadana, educación, salud, minería informal..."
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && compararTema()}
              style={{ flex: 1 }}
            />
            <button onClick={compararTema} disabled={cargandoCompare || !apiKey || !tema.trim()}>
              {cargandoCompare ? "Comparando..." : "Comparar"}
            </button>
          </div>

          <p className="hint" style={{ marginTop: 8 }}>
            💡 Funciona mejor con un tema puntual (una idea, no una pregunta). Prueba:
          </p>
          <div className="row" style={{ marginTop: 6 }}>
            {EJEMPLOS_TEMA.map((ej) => (
              <span key={ej} className="chip example" onClick={() => setTema(ej)}>
                {ej}
              </span>
            ))}
          </div>

          {errorCompare && <div className="error" style={{ marginTop: 12 }}>{errorCompare}</div>}

          {cargandoCompare && (
            <p className="hint" style={{ marginTop: 12 }}>
              <span className="spinner" /> Buscando en los 7 planes de gobierno y generando comparación...
            </p>
          )}

          {resultado && (
            <div className="compare-grid" style={{ marginTop: 16 }}>
              {resultado.map((item, i) => (
                <div key={i} className={`compare-card ${item.sin_informacion ? "sin-info" : ""}`}>
                  <h3>{item.candidato}</h3>
                  <div className="partido">{item.partido}</div>
                  <p>{item.propuesta}</p>
                </div>
              ))}
            </div>
          )}

          {textoCrudo && (
            <div className="msg assistant" style={{ marginTop: 16, whiteSpace: "pre-wrap" }}>
              {textoCrudo}
            </div>
          )}
        </div>
      )}

      {tab === "simple" && (
        <div className="panel">
          <label>Filtrar por candidato (opcional, vacío = buscar en los 7)</label>
          <div className="row" style={{ marginBottom: 12 }}>
            {CANDIDATOS.map((c) => (
              <span
                key={c}
                className={`chip chip-candidato ${candidatosSimple.includes(c) ? "selected" : ""}`}
                onClick={() => toggleCand(candidatosSimple, setCandidatosSimple, c)}
              >
                {c}
                <small>{PARTIDOS[c]}</small>
              </span>
            ))}
          </div>

          <div style={{ minHeight: 60 }}>
            {mensajes.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                <strong>{m.role === "user" ? "Tú" : "Asistente"}:</strong> {m.content}
                {m.fuentes && m.fuentes.length > 0 && (
                  <div className="fuentes">
                    Fuentes:{" "}
                    {m.fuentes.map((f, j) => (
                      <span key={j}>
                        {f.candidato} (p. {f.pagina})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {cargandoSimple && (
              <p className="hint">
                <span className="spinner" /> Buscando y generando respuesta...
              </p>
            )}
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <textarea
              placeholder="Ej: ¿Qué propone sobre becas educativas?"
              value={pregunta}
              onChange={(e) => setPregunta(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviarPregunta();
                }
              }}
              style={{ flex: 1 }}
            />
            <button onClick={enviarPregunta} disabled={cargandoSimple || !apiKey || !pregunta.trim()}>
              Preguntar
            </button>
          </div>

          <p className="hint" style={{ marginTop: 8 }}>
            💡 Funciona mejor con "¿qué propone sobre [tema]?" — si buscas algo específico de un
            candidato, selecciónalo arriba en vez de nombrarlo en la pregunta. Prueba:
          </p>
          <div className="row" style={{ marginTop: 6 }}>
            {EJEMPLOS_SIMPLE.map((ej) => (
              <span key={ej} className="chip example" onClick={() => setPregunta(ej)}>
                {ej}
              </span>
            ))}
          </div>
        </div>
      )}

      <footer className="app">
        Fuente de datos: planes de gobierno presentados ante el Jurado Nacional de Elecciones (JNE)
        para las Elecciones Generales del Perú 2026. Herramienta informativa e independiente, sin
        afiliación a ningún partido. Las respuestas se generan con IA a partir de fragmentos
        recuperados de los documentos oficiales; pueden contener imprecisiones — verifica siempre
        citando la página indicada.
      </footer>
    </div>
  );
}
