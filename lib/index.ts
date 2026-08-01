import chunksData from "@/data/chunks.json";
import { VectorIndex } from "./embeddings";
import type { Chunk } from "./types";

let _index: VectorIndex | null = null;

export function getIndex(): VectorIndex {
  if (!_index) {
    _index = new VectorIndex(chunksData as (Chunk & { embedding: number[] })[]);
  }
  return _index;
}
