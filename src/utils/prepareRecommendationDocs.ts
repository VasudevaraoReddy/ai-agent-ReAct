// src/utils/prepareRecommendationDocs.ts
import { getAdvisorRecommendations } from 'src/apis/getRecommendations.api';

export interface RecommendationDoc {
  id: string;
  content: string;
  metadata: {
    id: string;
    recommendationTypeId: string;
    impactedService: string;
    impactedValue: string;
    category: string;
    savingsAmount?: string;
    annualSavingsAmount?: string;
    savingsCurrency?: string;
    impact?: string;
    region?: string;
    sku?: string;
    term?: string;
    qty?: string;
    recommendationType?: string;
    targetResourceCount?: string;
    lookbackPeriod?: string;
    lastUpdated?: string;
    problem: string;
    solution: string;
  };
}

function flattenRecommendations(list: any[]): any[] {
  const flat: any[] = [];
  list.forEach((group) => {
    group.recommendations.forEach((rec) => {
      flat.push({
        ...rec,
        impactedValue: rec.impactedValue,
        _impactedService: group.impactedService,
        _category: rec.properties?.category ?? 'Uncategorized',
      });
    });
  });
  return flat;
}

function generateNaturalContent(metadata: any): string {
  const parts = [
    `Recommendation (${metadata.id ?? 'N/A'}):`,
    `This is a ${metadata.impact?.toLowerCase() ?? 'medium'} impact recommendation in the category of ${metadata.category ?? 'General'} for the Azure service "${metadata.impactedService ?? 'N/A'}" affecting resource "${metadata.impactedValue ?? 'N/A'}".`,
    `Problem: ${metadata.problem ?? 'Not specified'}.`,
    `Solution: ${metadata.solution ?? 'Not specified'}.`,
    `Region: ${metadata.region ?? 'N/A'}, Term: ${metadata.term ?? 'N/A'}.`,
    `Estimated cost savings: ${metadata.savingsAmount ?? 'N/A'} per month, ${metadata.annualSavingsAmount ?? 'N/A'} per year.`,
  ];
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function formatToDocument(recs: any[]): RecommendationDoc[] {
  return recs.map((rec) => {
    const extendedProps = rec.properties?.extendedProperties || {};

    const metadata = {
      impactedService: rec?.properties?.impactedField,
      category: rec?.properties?.category,
      impact: rec?.properties?.impact,
      impactedValue: rec?.properties?.impactedValue,
      lastUpdated: rec?.properties?.lastUpdated,
      recommendationTypeId: rec?.properties?.recommendationTypeId,
      id: rec?.id,
      problem: rec?.properties?.shortDescription?.problem,
      solution: rec?.properties?.shortDescription?.solution,
      savingsAmount: extendedProps.savingsAmount,
      annualSavingsAmount: extendedProps.annualSavingsAmount,
      savingsCurrency: extendedProps.savingsCurrency,
      region: extendedProps.region || extendedProps.location,
      sku: extendedProps.sku || extendedProps.displaySKU,
      term: extendedProps.term,
      qty: extendedProps.displayQty || extendedProps.qty,
      recommendationType: extendedProps.recommendationType || 'N/A',
      targetResourceCount: extendedProps.targetResourceCount || 'N/A',
      lookbackPeriod: extendedProps.lookbackPeriod || 'N/A',
    };

    return {
      id: rec.id || `${rec.name}-${rec._impactedService}`,
      content: generateNaturalContent(metadata),
      metadata,
    };
  });
}

export async function prepareRecommendationDocs(): Promise<
  RecommendationDoc[]
> {
  const response = await getAdvisorRecommendations();
  const flattened = flattenRecommendations(response.list);
  return formatToDocument(flattened);
}

export function extractCostSavingsSummary(docs: RecommendationDoc[]): {
  totalMonthlySavings: number;
  totalAnnualSavings: number;
  currency: string;
  costRecommendationsCount: number;
  savingsBreakdown: Array<{
    service: string;
    monthlySavings: number;
    annualSavings: number;
    sku: string;
    region: string;
  }>;
} {
  const costRecommendations = docs.filter(
    (doc) =>
      doc.metadata.category.toLowerCase() === 'cost' &&
      doc.metadata.savingsAmount,
  );

  let totalMonthlySavings = 0;
  let totalAnnualSavings = 0;
  let currency = 'USD';
  const savingsBreakdown: Array<{
    service: string;
    monthlySavings: number;
    annualSavings: number;
    sku: string;
    region: string;
  }> = [];

  costRecommendations.forEach((doc) => {
    const monthlySavings = parseFloat(doc.metadata.savingsAmount || '0');
    const annualSavings = parseFloat(doc.metadata.annualSavingsAmount || '0');

    totalMonthlySavings += monthlySavings;
    totalAnnualSavings += annualSavings;

    if (doc.metadata.savingsCurrency) {
      currency = doc.metadata.savingsCurrency;
    }

    savingsBreakdown.push({
      service: doc.metadata.impactedService,
      monthlySavings,
      annualSavings,
      sku: doc.metadata.sku || 'N/A',
      region: doc.metadata.region || 'N/A',
    });
  });

  return {
    totalMonthlySavings,
    totalAnnualSavings,
    currency,
    costRecommendationsCount: costRecommendations.length,
    savingsBreakdown,
  };
}
