// src/utils/embedAndStoreChroma.ts

// import { RecommendationDoc } from './prepareRecommendationDocs';
// import { OllamaEmbeddings } from '@langchain/ollama';
// import { ChromaClient } from 'chromadb';

// const COLLECTION_NAME = 'azure-advisor-recommendations';

// // Ollama embedding config
// const embeddings = new OllamaEmbeddings({
//   model: 'nomic-embed-text:latest',
//   baseUrl: 'http://10.95.108.25:11434',
// });

// // Initialize Chroma client for v3
// const chroma = new ChromaClient({
//   path: 'http://10.95.108.25:8000',
// });

// // Minimal embedding function that does nothing (we provide embeddings manually)
// class PassthroughEmbeddingFunction {
//   async generate(texts: string[]): Promise<number[][]> {
//     // Return empty arrays - this won't be used since we provide embeddings manually
//     return texts.map(() => []);
//   }
// }

// export async function embedAndStoreChroma(docs: RecommendationDoc[]) {
//   try {
//     // Try to delete existing collection if it exists
//     await chroma.deleteCollection({ name: COLLECTION_NAME });
//     console.log('✅ Existing collection deleted');
//   } catch {
//     console.log('ℹ️ Collection does not exist yet, creating fresh');
//   }

//   // Create collection with passthrough embedding function
//   const collection = await chroma.createCollection({
//     name: COLLECTION_NAME,
//     embeddingFunction: new PassthroughEmbeddingFunction(),
//     metadata: { 'hnsw:space': 'cosine' },
//   });

//   // Generate embeddings from recommendation content
//   const contents = docs.map((doc) => {
//     return doc.content;
//   });
//   const vectors = await embeddings.embedDocuments(contents);
//   const ids = docs.map((doc) => doc.id);

//   // Prepare metadata with all available fields from RecommendationDoc
//   const metadatas = docs.map((doc) => {
//     return doc.metadata;
//   });

//   // Add to collection with manual embeddings
//   await collection.add({
//     ids,
//     embeddings: vectors,
//     documents: contents,
//     metadatas,
//   });

//   console.log(`✅ Successfully stored ${docs.length} recommendation documents`);
//   return {
//     message: `Stored ${docs.length} recommendation documents into ChromaDB`,
//     collectionName: COLLECTION_NAME,
//     totalDocuments: docs.length,
//     costRecommendations: docs.filter(
//       (doc) => doc.metadata.category.toLowerCase() === 'cost',
//     ).length,
//   };
// }

// // Helper function to query recommendations from ChromaDB
// export async function queryRecommendations(
//   query: string,
//   nResults: number = 5,
//   whereClause?: Record<string, any>,
// ) {
//   try {
//     const collection = await chroma.getCollection({
//       name: COLLECTION_NAME,
//     });

//     // Generate embedding for the query
//     const queryVector = await embeddings.embedQuery(query);

//     // Query the collection
//     const results = await collection.query({
//       queryEmbeddings: [queryVector],
//       nResults,
//       where: whereClause,
//     });

//     return {
//       documents: results.documents[0],
//       metadatas: results.metadatas[0],
//       distances: results.distances?.[0],
//       ids: results.ids[0],
//     };
//   } catch (error) {
//     console.error('Error querying recommendations from ChromaDB:', error);
//     throw error;
//   }
// }

// // Helper function to get cost-specific recommendations
// export async function queryCostRecommendations(
//   query: string,
//   nResults: number = 5,
// ) {
//   return queryRecommendations(query, nResults, { category: 'cost' });
// }

// // Helper function to get recommendations for a specific service
// export async function queryServiceRecommendations(
//   serviceName: string,
//   query: string,
//   nResults: number = 5,
// ) {
//   return queryRecommendations(query, nResults, {
//     impactedService: serviceName,
//   });
// }

import { RecommendationDoc } from './prepareRecommendationDocs';
import { OllamaEmbeddings } from '@langchain/ollama';
import { QdrantClient } from '@qdrant/js-client-rest';
import { randomUUID } from 'crypto';

const COLLECTION_NAME = 'azure-advisor-recommendations';

const embeddings = new OllamaEmbeddings({
  model: 'nomic-embed-text:latest',
  baseUrl: 'http://10.95.108.25:11434',
});

const qdrant = new QdrantClient({
  url: 'http://10.95.108.25:6333',
});

export async function embedAndStoreQdrant(docs: RecommendationDoc[]) {
  const contents = docs.map((doc) => doc.content);
  const metadatas = docs.map((doc) => ({
    ...doc.metadata,
    content: doc.content,
  }));
  const ids = docs.map(() => randomUUID());
  const vectors = await embeddings.embedDocuments(contents);

  // 🔁 Check and delete collection if it exists
  const collections = await qdrant.getCollections();
  const exists = collections.collections.some(
    (col) => col.name === COLLECTION_NAME,
  );

  if (exists) {
    console.log(`🗑️ Deleting existing collection '${COLLECTION_NAME}'...`);
    await qdrant.deleteCollection(COLLECTION_NAME);
  }

  // ✅ Create fresh collection
  await qdrant.createCollection(COLLECTION_NAME, {
    vectors: {
      size: vectors[0].length,
      distance: 'Cosine',
    },
  });
  console.log(`✅ Created new collection '${COLLECTION_NAME}'`);

  // ✅ Insert new data
  const payload = contents.map((_, idx) => ({
    id: ids[idx],
    vector: vectors[idx],
    payload: metadatas[idx],
  }));

  await qdrant.upsert(COLLECTION_NAME, {
    points: payload,
  });

  console.log(`✅ Stored ${docs.length} recommendations in Qdrant`);
  return {
    message: `Stored ${docs.length} documents`,
    collection: COLLECTION_NAME,
    total: docs.length,
  };
}
