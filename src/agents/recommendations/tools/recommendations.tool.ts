import { tool } from '@langchain/core/tools';
import { boolean, z } from 'zod';
import { getRecommendations } from 'src/apis/getRecommendations.api';
import { RunnableConfig } from '@langchain/core/runnables';

const recommendationsTool = tool(
  async (input: { service: string }, config?: RunnableConfig) => {
    const { service } = input;
    console.log('In recommendations tool:', { service: service });
    try {
      const response = await getRecommendations('Vault');
      const apiRecommendations = response.data;
      const formattedResponse = {
        recommendations: apiRecommendations?.recommendations || [],
        uniqueImpactedFields: apiRecommendations?.uniqueImpactedFields || [],
        found: false,
      };

      if (apiRecommendations?.recommendations?.length === 0) {
        formattedResponse.found = false;
      } else {
        formattedResponse.found = true;
      }
      return JSON.stringify(formattedResponse);
    } catch (apiError) {
      console.error('Failed to fetch recommendations from API:', apiError);
      const errorResponse = {
        found: false,
      };
      return JSON.stringify(errorResponse);
    }
  },
  {
    name: 'recommendations_api_service',
    description: `Use this tool to get azure advisor recommendations for cloud services based on user requirements.`,
    schema: z.object({
      message: z
        .string()
        .describe('The exact user query for cloud service recommendations'),
      service: z
        .string()
        .describe(
          'The cloud service name (e.g., "SQL Server", "VM", "Storage","Vault)',
        ),
    }),
  },
);

export default recommendationsTool;
