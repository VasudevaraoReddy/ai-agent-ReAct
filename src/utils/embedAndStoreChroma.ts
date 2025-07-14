// src/utils/embedAndStoreChroma.ts

import { RecommendationDoc } from './prepareRecommendationDocs';
import { OllamaEmbeddings } from '@langchain/ollama';
import { ChromaClient } from 'chromadb';

const COLLECTION_NAME = 'azure-advisor-recommendations';

// Ollama embedding config
const embeddings = new OllamaEmbeddings({
  model: 'nomic-embed-text:latest',
  baseUrl: 'http://10.95.108.25:11434',
});

// Initialize Chroma client for v3
const chroma = new ChromaClient({
  path: 'http://10.95.108.25:8000',
});

// Minimal embedding function that does nothing (we provide embeddings manually)
class PassthroughEmbeddingFunction {
  async generate(texts: string[]): Promise<number[][]> {
    // Return empty arrays - this won't be used since we provide embeddings manually
    return texts.map(() => []);
  }
}

export async function embedAndStoreChroma(docs: RecommendationDoc[]) {
  try {
    try {
      // 1. Try to delete existing collection if it exists
      await chroma.deleteCollection({ name: COLLECTION_NAME });
      console.log('✅ Existing collection deleted');
    } catch {
      console.log('ℹ️ Collection does not exist yet, creating fresh');
    }

    // 2. Create collection with passthrough embedding function
    const collection = await chroma.createCollection({
      name: COLLECTION_NAME,
      embeddingFunction: new PassthroughEmbeddingFunction(),
      metadata: { 'hnsw:space': 'cosine' },
    });

    // 3. Generate embeddings manually
    const contents = docs.map((doc) => {
      return JSON.stringify({
        id: doc.id,
        content: doc.content,
      });
    });
    const vectors = await embeddings.embedDocuments(contents);
    const ids = docs.map((doc) => doc.id);
    const metadatas = docs.map((doc) => doc.metadata);

    // 4. Add to collection with manual embeddings
    await collection.add({
      ids,
      embeddings: vectors,
      documents: contents,
      metadatas,
    });

    return {
      message: `Stored ${docs.length} documents into ChromaDB`,
      collectionName: COLLECTION_NAME,
    };
  } catch (error) {
    console.error('Error storing documents to ChromaDB:', error);
    throw error;
  }
}