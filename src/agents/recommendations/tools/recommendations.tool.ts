import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { getAdvisorRecommendations } from 'src/apis/getRecommendations.api';
import { RunnableConfig } from '@langchain/core/runnables';
import OllamaLLM from 'src/utils/ollama.llm';

interface GroupedRecommendation {
  impactedService: string;
  recommendations: any[];
}

// Flatten all recommendations into a single array with impactedService
function flattenRecommendations(list: GroupedRecommendation[]) {
  const flat: any[] = [];
  list.forEach(group => {
    group.recommendations.forEach(rec => {
      flat.push({
        ...rec,
        _impactedService: group.impactedService,
        _category: rec.properties?.category ?? 'Uncategorized',
      });
    });
  });
  return flat;
}

// Group back by impactedService
function groupByImpactedService(recs: any[]): GroupedRecommendation[] {
  const grouped: Record<string, any[]> = {};
  recs.forEach(rec => {
    const service = rec._impactedService || 'Unknown';
    if (!grouped[service]) grouped[service] = [];
    grouped[service].push(rec);
  });

  return Object.entries(grouped).map(([impactedService, recommendations]) => ({
    impactedService,
    recommendations,
  }));
}

// Format recommendations for LLM input
function formatRecommendations(grouped: GroupedRecommendation[], start = 1): { text: string; count: number } {
  let count = start;
  let output = '';

  grouped.forEach(group => {
    output += `\n## Impacted Service: ${group.impactedService}\n`;
    group.recommendations.forEach(rec => {
      output += `
Recommendation ${count}:
- ID: ${rec.id || 'N/A'}
- Name: ${rec.name || 'N/A'}
- Type: ${rec.type || 'N/A'}
- Impacted Field: ${rec.properties?.impactedField || 'N/A'}
- Impacted Value: ${rec.properties?.impactedValue || 'N/A'}
- Category: ${rec.properties?.category || 'N/A'}
- Problem: ${rec.properties?.shortDescription?.problem || 'N/A'}
- Solution: ${rec.properties?.shortDescription?.solution || 'N/A'}
`;
      count++;
    });
  });

  return { text: output, count };
}

const recommendationsTool = tool(
  async (
    input: { message: string; service: string; filterLevel?: string; category?: string },
    config?: RunnableConfig
  ) => {
    const { message, service, filterLevel, category } = input;
    console.log('In recommendations tool:', { service, filterLevel, category });

    try {
      const response = await getAdvisorRecommendations();
      const allGrouped = response.list;

      let allRecs = flattenRecommendations(allGrouped);
     
      // Filter by impactedService (filterLevel)
      if (filterLevel) {
        const impactedLower = filterLevel.toLowerCase();
        allRecs = allRecs.filter(rec =>
          impactedLower.toLowerCase().includes(rec._impactedService.toLowerCase())
        );
      }

      // Optional: filter by category
      if (category) {
        const categoryLower = category.toLowerCase();
        allRecs = allRecs.filter(rec =>
          rec.properties?.category?.toLowerCase() === categoryLower
        );
      }

      if (allRecs.length === 0) {
        return JSON.stringify({
          response: `No recommendations found for "${service}"${filterLevel ? ` with impacted service "${filterLevel}"` : ''}${category ? ` and category "${category}"` : ''}.`,
        });
      }

      const regrouped = groupByImpactedService(allRecs);
      const { text: formatted } = formatRecommendations(regrouped);

      const prompt = `
You are an Azure cloud expert that helps explain Azure Advisor recommendations in simple, clear terms.

Analyze the following recommendations related to **${service}**, and for each:
1. Summarize the issue in plain language
2. Explain the impact and urgency
3. Suggest implementation steps
4. State benefits of applying the recommendation

Here are the recommendations:
${formatted}

Respond in clear, plain English, grouped by impacted service.
`;

      const result = await OllamaLLM.invoke(prompt);
      const content = result?.content?.toString() ?? '';

      return JSON.stringify({
        response: content,
        recommendations: allRecs,
        input: input,
      });
    } catch (error) {
      console.error('Failed to process recommendations:', error);
      return JSON.stringify({ response: 'Error retrieving recommendations.' });
    }
  },
  {
    name: 'recommendations_api_service',
    description: 'Get Azure Advisor recommendations filtered by impacted service and/or category.',
    schema: z.object({
      message: z.string().describe('Exact user query (do not change it)'),
      service: z.string().describe('Target Azure service, e.g., "SQL Server", "VM", etc.'),
      filterLevel: z.string().optional().describe('Optional impacted service, e.g., "Microsoft.Sql/servers"'),
      category: z.string().optional().describe('Optional recommendation category like "Cost", "Security", etc.'),
    }),
  }
);

export default recommendationsTool;

