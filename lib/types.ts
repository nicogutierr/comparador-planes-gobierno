export interface Chunk {
  id: number;
  candidato: string;
  partido: string;
  archivo: string;
  pagina: number;
  texto: string;
  embedding?: number[];
}

export interface ScoredChunk extends Chunk {
  score: number;
}

export const CANDIDATOS = [
  "Keiko Fujimori",
  "Roberto Sánchez",
  "Rafael López Aliaga",
  "Jorge Nieto",
  "Ricardo Belmont",
  "Carlos Álvarez",
  "Alfonso López-Chau",
] as const;

export const PARTIDOS: Record<string, string> = {
  "Keiko Fujimori": "Fuerza Popular",
  "Roberto Sánchez": "Juntos por el Perú",
  "Rafael López Aliaga": "Renovación Popular",
  "Jorge Nieto": "Partido del Buen Gobierno",
  "Ricardo Belmont": "Partido Cívico Obras",
  "Carlos Álvarez": "País para Todos",
  "Alfonso López-Chau": "Ahora Nación",
};
