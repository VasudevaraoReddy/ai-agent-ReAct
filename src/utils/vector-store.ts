import { qdrantClient } from "./qdrant";

const recommendationsCollectionName = process.env.RECOMMENDATIONS_COLLECTION_NAME || '';

const recommendationsCollectionIndexKeys = process.env.RECOMMENDATIONS_COLLECTION_INDEX_KEYS || '';

const CollectionIndexKeysMapping = {
    [recommendationsCollectionName]: recommendationsCollectionIndexKeys,
} as const;

export const CollectionNameMapping = {
    RECOMMENDATIONS_COLLECTION_NAME: recommendationsCollectionName,
} as const;

/**
 * Create text indices on Qdrant collections for better text search
 */
export const createQdrantTextIndices = async (
    collectionNames: (typeof CollectionNameMapping)[keyof typeof CollectionNameMapping][],
  ) => {
    const client = qdrantClient;
    for (const collectionName of collectionNames) {
      console.log(`Creating text indices for collection: ${collectionName}`);
  
      try {
        // Check if collection exists
        await client.getCollection(collectionName);
  
        // Get the index keys for this collection
        const indexKeysEnvVar = CollectionIndexKeysMapping[collectionName];
        // format is tokenizer:fieldName,tokenizer:fieldName
        const keysWithTokenizer = indexKeysEnvVar.split(',').map(key => key.split(':'));
        console.log(`Creating indices for keys: ${keysWithTokenizer.join(', ')}`);
  
        // Delete existing indices if they exist
        try {
          for (const [tokenizer, fieldName] of keysWithTokenizer) {
            console.log(`Attempting to delete existing index for ${fieldName}`);
            await client.deletePayloadIndex(collectionName, fieldName);
          }
        } catch (error) {
          console.log(
            `No existing indices found or error deleting: ${error.message}`,
          );
        }
  
        // Create indices for each field
        for (const [tokenizer, fieldName] of keysWithTokenizer) {
          try {
  
            await client.createPayloadIndex(collectionName, {
              field_name: fieldName,
              field_schema: {
                type: 'text',
                tokenizer: tokenizer,
                min_token_len: 2,
                max_token_len: 20,
                lowercase: true,
              },
            });
            console.log(
              `Created ${tokenizer} index on ${fieldName} in ${collectionName}`,
            );
          } catch (error) {
            console.error(`Error creating index for ${fieldName}:`, error);
          }
        }
      } catch (error) {
        console.error(`Error setting up indices for ${collectionName}:`, error);
      }
    }
    console.log('Finished creating text indices');
    return true;
  };
  