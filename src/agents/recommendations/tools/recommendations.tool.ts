import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { RunnableConfig } from '@langchain/core/runnables';
import embeddings from 'src/utils/ollama.embeddings';
import { qdrantClient } from 'src/utils/qdrant';

/**
 * Create filter based on category, impactedService, or other parameters
 */
const createFilter = (category?: string, impactedService?: string) => {
  const filter: any = { must: [] };

  if (category) {
    filter.must.push({
      key: 'category',
      match: {
        text: category,
      },
    });
  }

  if (impactedService) {
    filter.must.push({
      key: 'impactedService',
      match: {
        text: impactedService,
      },
    });
  }

  return filter.must.length > 0 ? filter : undefined;
};

const recommendationsTool = tool(
  async (
    input: {
      question: string;
      filterLevel?: string;
      category?: string;
    },
    config?: RunnableConfig,
  ) => {
    const { question, filterLevel, category } = input;
    console.log('⏳ Loading recommendations from Qdrant...');
    console.log(
      `Question: ${question}, FilterLevel: ${filterLevel}, Category: ${category}`,
    );
    try {
      const client = qdrantClient;
      const collectionName =
        process.env.RECOMMENDATIONS_COLLECTION_NAME ||
        'azure-advisor-recommendations';

      // Get embedding for query
      const queryVector = await embeddings.embedQuery(question);

      // Create filter if needed
      const filter = createFilter(category, filterLevel);

      // Search Qdrant collection
      const resultsWithFilter = await client.query(collectionName, {
        query: queryVector,
        limit: 10,
        filter: filter,
        with_payload: true,
      });

      const resultsWithOutFilter = await client.search(collectionName, {
        vector: queryVector,
        limit: 10,
        with_payload: true,
      });

      if (
        resultsWithFilter.points.length === 0 &&
        resultsWithOutFilter.length === 0
      ) {
        return JSON.stringify({
          success: false,
          message: `No relevant recommendations found for your question${category ? ' in category ' + category : ''}${filterLevel ? ' for service ' + filterLevel : ''}.`,
          results: [],
        });
      }

      // Format results to return to the agent
      let results: any[] = [];
      if (resultsWithFilter.points.length > 0) {
        results = resultsWithFilter.points.map((result, i) => {
          const payload = result?.payload || {};
          return {
            id: payload.id || `rec-${i}`,
            relevance: result?.score?.toFixed(3) || 'N/A',
            metadata: payload,
            content: payload?.content || '',
            score: result?.score,
          };
        });
      }
      if (resultsWithOutFilter.length > 0) {
        results = resultsWithOutFilter.map((result, i) => {
          return {
            id: result?.id,
            relevance: result?.score?.toFixed(3) || 'N/A',
            metadata: result?.payload,
            content: result?.payload?.content || '',
            score: result?.score,
          };
        });
      }
      return JSON.stringify({
        success: true,
        message: `Found ${results.length} recommendations.`,
        results,
      });
    } catch (error: any) {
      console.error('❌ Error in recommendationsTool:', error);
      return JSON.stringify({
        success: false,
        message: 'Error querying recommendations database.',
        error: error.message,
        results: [],
      });
    }
  },
  {
    name: 'get_recommendations',
    description: `
    Use this tool to retrieve Azure service recommendations. 

    - Always pass the user’s full question as the 'question' parameter.
    - Use 'filterLevel' to specify the Azure  resource type (e.g., microsoft.containerservice/managedclusters).
    - Use 'category' to filter by recommendation type (e.g., Performance, Cost, Security).`,
    schema: z.object({
      question: z
        .string()
        .describe(
          'The exact question from the user about Azure recommendations.',
        ),
      filterLevel: z
        .string()
        .optional()
        .describe(
          'Optional filter for specific Azure service (e.g., microsoft.compute/virtualmachines)',
        ),
      category: z
        .string()
        .optional()
        .describe(
          'Optional filter for specific category (e.g., Cost, Security, Performance)',
        ),
    }),
  },
);

export default recommendationsTool;
