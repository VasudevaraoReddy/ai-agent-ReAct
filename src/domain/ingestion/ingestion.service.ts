import { Injectable, OnModuleInit } from '@nestjs/common';
import { qdrantClient } from 'src/utils/qdrant';
import { QdrantClient } from '@qdrant/js-client-rest';
import { CollectionNameMapping, createQdrantTextIndices } from 'src/utils/vector-store';
import { prepareRecommendationDocs } from 'src/utils/prepareRecommendationDocs';
import embeddings from 'src/utils/ollama.embeddings';

@Injectable()
export class IngestionService implements OnModuleInit {
    private readonly RECOMMENDATIONS_COLLECTION_NAME: string;
    qdrantClient: QdrantClient;

    constructor() {
        this.RECOMMENDATIONS_COLLECTION_NAME = process.env.RECOMMENDATIONS_COLLECTION_NAME || '';
    }

    async onModuleInit() {
        this.qdrantClient = qdrantClient;
    }

    async checkCollectionExists(collectionName: string) {
        try {
            await this.qdrantClient.getCollection(collectionName);
            return true;
        } catch (error) {
            return false;
        }
    }

    // Method to load menu items with location data into Qdrant
    async loadRecommendations() {
        try {
            const existingCollection = await this.checkCollectionExists(this.RECOMMENDATIONS_COLLECTION_NAME);
            if (existingCollection) {
                console.log(`Collection ${this.RECOMMENDATIONS_COLLECTION_NAME} already exists`);
            } else {
                console.log(`Creating collection ${this.RECOMMENDATIONS_COLLECTION_NAME}`);
                await this.qdrantClient.createCollection(this.RECOMMENDATIONS_COLLECTION_NAME, {
                    vectors: {
                        size: 768, // Size for nomic-embed-text model
                        distance: 'Cosine'
                    }
                });
            }

        
            const recommendations = await prepareRecommendationDocs();
            const BATCH_SIZE = 10;

            const processBatch = async (startIndex: number): Promise<void> => {
                if (startIndex >= recommendations.length) {
                    return;
                }
                const batch = recommendations.slice(startIndex, startIndex + BATCH_SIZE);
                const points: any[] = [];
                for (const recommendation of batch) {
                    const content = `${recommendation.content} ${recommendation.metadata.problem} ${recommendation.metadata.solution} ${recommendation.metadata.impactedService} ${recommendation.metadata.impactedValue} ${recommendation.metadata.category} ${recommendation.metadata.savingsAmount} ${recommendation.metadata.annualSavingsAmount} `;
                    const vector = await embeddings.embedQuery(content);
                    points.push({
                        id: recommendation.metadata.recommendationTypeId,
                        vector: vector,
                        payload: recommendation.metadata
                    });
                }
                console.log(`Upserting ${points.length} points to collection ${this.RECOMMENDATIONS_COLLECTION_NAME}`);
                await this.qdrantClient.upsert(this.RECOMMENDATIONS_COLLECTION_NAME, {
                    points: points,
                    wait: true
                });
                await processBatch(startIndex + BATCH_SIZE);
            };

            await processBatch(0);

            console.log(`Loaded recommendations into Qdrant collection ${this.RECOMMENDATIONS_COLLECTION_NAME}`);
            return {
                success: true,
                message: `Loaded ${recommendations.length} recommendations into Qdrant collection ${this.RECOMMENDATIONS_COLLECTION_NAME}`
            }
        } catch (error) {
            console.error(`Error loading recommendations to ${this.RECOMMENDATIONS_COLLECTION_NAME}:`, error);
            return false;
        }
    }

    async createIndices() {
        return createQdrantTextIndices([
            CollectionNameMapping.RECOMMENDATIONS_COLLECTION_NAME
        ]);
    }

}
