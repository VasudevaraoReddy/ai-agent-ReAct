import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { ChromaClient } from 'chromadb';
import { OllamaEmbeddings } from '@langchain/ollama';
import OllamaLLM from 'src/utils/ollama.llm';
import { RunnableConfig } from '@langchain/core/runnables';

// Initialize embedding model for semantic search
const embeddings = new OllamaEmbeddings({
  model: 'nomic-embed-text:latest',
  baseUrl: 'http://10.95.108.25:11434',
});

//Custom embedding function for ChromaDB v3 compatibility
// class OllamaEmbeddingFunction {
//   async generate(texts: string[]): Promise<number[][]> {
//     try {
//       return await embeddings.embedDocuments(texts);
//     } catch (error) {
//       console.error('Error generating embeddings:', error);
//       throw error;
//     }
//   }
// }

class OllamaEmbeddingFunction {
  async generate(texts: string[]): Promise<number[][]> {
    try {
      return Promise.all(texts.map((text) => embeddings.embedQuery(text)));
    } catch (error) {
      console.error('Error generating embeddings:', error);
      throw error;
    }
  }
}

const recommendationsTool = tool(
  async (input: { question: string }, config?: RunnableConfig) => {
    const { question } = input;
    console.log('⏳ Loading recommendations from ChromaDB...');

    try {
      // Updated ChromaClient (no deprecated `path`)
      const client = new ChromaClient({
        host: '10.95.108.25',
        port: 8000,
        ssl: false,
      });

      const collection = await client.getCollection({
        name: 'azure-advisor-recommendations',
        embeddingFunction: new OllamaEmbeddingFunction(),
      });

      console.log('✅ Collection loaded successfully');
      console.log('Question: ', question);

      const queryResults = await collection.query({
        queryTexts: [question],
        nResults: 10,
        include: ['documents', 'metadatas', 'distances'],
      });

      const docs = queryResults.documents?.[0] || [];
      const metadatas = queryResults.metadatas?.[0] || [];
      const distances = queryResults.distances?.[0] || [];

      if (docs.length === 0) {
        return JSON.stringify({
          response:
            'No relevant recommendations found in ChromaDB for your question.',
        });
      }

      // Format results using metadata
      const context = docs
        .map((doc: any, i) => {
          try {
            const metadata = metadatas[i] as any;
            const parsedDoc = JSON.parse(doc);

            console.log(metadata);

            console.log(parsedDoc?.content, 'Parsed');
            const distance = distances[i];

            const id = parsedDoc?.id || `rec-${i}`;
            return `
            # Recommendation ${id} (Relevance: ${distance !== null ? (1 - distance).toFixed(3) : 'N/A'})
              - impactedService: ${metadata?.impactedService}
              - category: ${metadata?.category}
              - Raw Content: ${parsedDoc?.content}
            `;
          } catch (error) {
            console.error('Error formatting document:', error);
            return null;
          }
        })
        .filter(Boolean)
        .join('\n\n');

      const prompt = `
You are an expert Azure Advisor assistant. Answer the user's question using only the context below.

## Context (Most relevant Azure Advisor recommendations):
${context}

## Question:
${question}

## Instructions:
- Use only the information provided in the context above
- If the context doesn't contain relevant information, say so
- Be specific and actionable in your recommendations
- Mention the recommendation IDs when referencing specific recommendations
- Include relevance scores when helpful

## Answer:
`;

      const result = await OllamaLLM.invoke(prompt);
      const answer = result?.content?.toString() ?? 'No response generated.';

      return JSON.stringify({
        response: answer,
        sourceCount: docs.length,
        relevanceScores: distances.map((d: any) => (1 - d).toFixed(3)),
      });
    } catch (error: any) {
      console.error('❌ Error in recommendationsTool:', error);
      return JSON.stringify({
        response:
          'Error querying ChromaDB or generating response. Please ensure ChromaDB is running and the collection exists.',
        error: error.message,
      });
    }
  },
  {
    name: 'recommendations_qa',
    description:
      'Ask questions about Azure Advisor recommendations stored in ChromaDB using semantic search.',
    schema: z.object({
      question: z
        .string()
        .describe(
          'The exact question from the user about Azure recommendations.',
        ),
    }),
  },
);

export default recommendationsTool;
