import { QdrantClient } from "@qdrant/js-client-rest";
import * as dotenv from 'dotenv';

dotenv.config();

export const qdrantClient = new QdrantClient({
    url: process.env.QDRANT_URL || 'http://localhost:6333',
});

console.log("QDRANT_URL", process.env.QDRANT_URL);

