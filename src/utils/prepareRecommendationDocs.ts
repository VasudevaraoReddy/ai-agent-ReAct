import { getAdvisorRecommendations } from 'src/apis/getRecommendations.api';

export interface RecommendationDoc {
  id: string;
  content: string;
  metadata: {
    impactedService: string;
    category: string;
  };
}

function flattenRecommendations(list: any[]): any[] {
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

function formatToDocument(recs: any[]): RecommendationDoc[] {
  return recs.map(rec => {
    const content = `
Recommendation: ${rec.name || 'N/A'}
- Type: ${rec.type || 'N/A'}
- Impacted Field: ${rec.properties?.impactedField || 'N/A'}
- Impacted Value: ${rec.properties?.impactedValue || 'N/A'}
- Category: ${rec._category}
- Problem: ${rec.properties?.shortDescription?.problem || 'N/A'}
- Solution: ${rec.properties?.shortDescription?.solution || 'N/A'}
`;
    return {
      id: rec.id || `${rec.name}-${rec._impactedService}`,
      content,
      metadata: {
        impactedService: rec._impactedService,
        category: rec._category,
      },
    };
  });
}

export async function prepareRecommendationDocs(): Promise<RecommendationDoc[]> {
  const response = await getAdvisorRecommendations();
  const flattened = flattenRecommendations(response.list);
  return formatToDocument(flattened);
}
