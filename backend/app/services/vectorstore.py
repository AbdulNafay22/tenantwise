"""A minimal in-memory vector store over the RTA corpus.

For the MVP the corpus is small (a handful of curated, sourced documents),
so we embed everything once at process start and hold it in memory with
numpy. This is intentionally simple and fully offline/local (no external
embedding API needed, so it runs in CI without secrets). The interface is
narrow enough that swapping in Supabase pgvector later (for a larger corpus
and shared/persistent storage) only means reimplementing this one class.

Uses `fastembed` (ONNX Runtime) rather than `sentence-transformers` (which
pulls in PyTorch) for the same "sentence-transformers/all-MiniLM-L6-v2"
model and near-identical embeddings, specifically to fit Render's free-tier
512MB RAM limit -- the PyTorch runtime's own baseline footprint alone
exceeded that limit in a real deploy (see git history, 2026-09-29). This is
a deliberate memory-driven choice, not a downgrade: same model weights,
same retrieval quality (re-verified against the eval gate after switching).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from fastembed import TextEmbedding

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "rta_corpus.json"
EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


def _normalize(vectors: np.ndarray) -> np.ndarray:
    """L2-normalize rows so a dot product equals cosine similarity. fastembed
    doesn't guarantee pre-normalized output the way sentence-transformers'
    `encode(..., normalize_embeddings=True)` did, so this is done explicitly
    to keep the exact same similarity math as before the fastembed switch."""
    norms = np.linalg.norm(vectors, axis=-1, keepdims=True)
    norms[norms == 0] = 1.0  # avoid dividing a degenerate all-zero embedding
    return vectors / norms


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
        self._model = TextEmbedding(model_name)
        self.docs: list[CorpusDoc] = self._load_docs(data_path)
        corpus_texts = [f"{d.topic}. {d.text}" for d in self.docs]
        embeddings = np.asarray(list(self._model.embed(corpus_texts)), dtype=np.float32)
        self._embeddings = _normalize(embeddings)

    @staticmethod
    def _load_docs(data_path: Path) -> list[CorpusDoc]:
        raw = json.loads(data_path.read_text())
        return [CorpusDoc(**item) for item in raw]

    def search(self, query: str, top_k: int = 3) -> list[tuple[CorpusDoc, float]]:
        """Return the top_k most relevant docs for a query, with cosine similarity scores."""
        if not self.docs:
            return []
        query_embedding = np.asarray(list(self._model.embed([query]))[0], dtype=np.float32)
        query_embedding = _normalize(query_embedding[np.newaxis, :])[0]
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
