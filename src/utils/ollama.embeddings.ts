import { OllamaEmbeddings } from "@langchain/ollama";
import * as dotenv from 'dotenv';

dotenv.config();

// Create embeddings model
const embeddings = new OllamaEmbeddings({
    model: process.env.EMBEDDING_MODEL,
    baseUrl: process.env.EMBEDDING_BASE_URL
});

export default embeddings;
