// src/apis/getRecommendations.api.ts
import { DefaultAzureCredential } from "@azure/identity";
import axios from "axios";
import * as dotenv from "dotenv";

dotenv.config();

const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
const apiVersion = "2023-01-01";
const advisorUrl = `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.Advisor/recommendations?api-version=${apiVersion}`;

// Define types
interface Recommendation {
  id: string;
  name: string;
  type: string;
  properties: {
    category: string;
    impactedField: string;
    impactedValue: string;
    shortDescription: {
      problem: string;
      solution: string;
    };
    [key: string]: any; // allows additional properties
  };
}

interface GroupedRecommendations {
  totalRecommendations: number;
  impactedServicesList: string[];
  list: {
    impactedService: string;
    recommendations: Recommendation[];
  }[];
}

export const getAdvisorRecommendations = async (): Promise<GroupedRecommendations> => {
  try {
    const credential = new DefaultAzureCredential();
    const token = await credential.getToken("https://management.azure.com/.default");

    let nextLink: any = advisorUrl;
    const recommendations: Recommendation[] = [];

    while (nextLink) {
      const { data } = await axios.get<{ value: Recommendation[]; nextLink?: string }>(nextLink, {
        headers: {
          Authorization: `Bearer ${token.token}`,
          "Content-Type": "application/json",
        },
      });

      if (Array.isArray(data.value)) {
        recommendations.push(...data.value);
      }

      nextLink = data.nextLink || null;
    }

    // Group recommendations by impactedField
    const grouped: Record<string, Recommendation[]> = {};

    for (const rec of recommendations) {
      const field = rec.properties.impactedField.toLowerCase() || "Unknown";
      if (!grouped[field]) {
        grouped[field] = [];
      }
      grouped[field].push({
        ...rec,
        properties: {
          ...rec.properties,
          impactedField: field.toLowerCase(),
        },
      });
    }

    // Format the final output
    const result: GroupedRecommendations = {
      totalRecommendations: recommendations.length,
      impactedServicesList: Object.keys(grouped),
      list: Object.entries(grouped).map(([key, value]) => ({
        impactedService: key,
        recommendations: value,
      })),
    };

    return result;
  } catch (err: any) {
    console.error("Error fetching recommendations:", err.message);
    throw err;
  }
};
