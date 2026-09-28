"""A minimal in-memory vector store over the RTA corpus.

For the MVP the corpus is small (a handful of curated, sourced documents),
so we embed everything once at process start and hold it in memory with
numpy. This is intentionally simple and fully offline/local (no external
embedding API needed, so it runs in CI without secrets). The interface is
narrow enough that swapping in Supabase pgvector later (for a larger corpus
and shared/persistent storage) only means reimplementing this one class.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from sentence_transformers import SentenceTransformer

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "rta_corpus.json"
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"


@dataclass
class CorpusDoc:
    id: str
    topic: str
    sections: list[str]
    source_name: str
    source_url: str
    text: str


class VectorStore:
    """Loads the RTA corpus, embeds it, and answers similarity queries."""

    def __init__(self, data_path: Path = DATA_PATH, model_name: str = EMBEDDING_MODEL_NAME):
        self._model = SentenceTransformer(model_name)
        self.docs: list[CorpusDoc] = self._load_docs(data_path)
        corpus_texts = [f"{d.topic}. {d.text}" for d in self.docs]
        embeddings = self._model.encode(corpus_texts, normalize_embeddings=True)
        self._embeddings = np.asarray(embeddings, dtype=np.float32)

    @staticmethod
    def _load_docs(data_path: Path) -> list[CorpusDoc]:
        raw = json.loads(data_path.read_text())
        return [CorpusDoc(**item) for item in raw]

    def search(self, query: str, top_k: int = 3) -> list[tuple[CorpusDoc, float]]:
        """Return the top_k most relevant docs for a query, with cosine similarity scores."""
        if not self.docs:
            return []
        query_embedding = self._model.encode([query], normalize_embeddings=True)[0]
        scores = self._embeddings @ query_embedding
        top_indices = np.argsort(-scores)[:top_k]
        return [(self.docs[i], float(scores[i])) for i in top_indices]


_store: VectorStore | None = None


def get_store() -> VectorStore:
    """Lazily construct a process-wide singleton so the model loads once."""
    global _store
    if _store is None:
        _store = VectorStore()
    return _store
