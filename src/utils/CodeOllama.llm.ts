import * as dotenv from 'dotenv';
import { ChatOllama } from '@langchain/ollama';

dotenv.config();

// Detect if we're using CodeLlama
const modelName = process.env.MODEL_NAME_1?.toLowerCase() || '';
const isCodeLlama = modelName.includes('codellama');

const CodeOllamaLLM = new ChatOllama({
  model: process.env.MODEL_NAME_1,
  baseUrl: process.env.MODEL_BASE_URL,
  temperature: isCodeLlama ? 0.0 : 0.1, // Lower temperature for CodeLlama
  // Adjust parameters for CodeLlama models
  ...(isCodeLlama && {
    topP: 0.9,
    topK: 40,
    repeatPenalty: 1.1,
    // Increase context window if supported
    numCtx: 4096,
    // Limit output tokens to prevent truncation
    numPredict: 2048,
  }),
});

export default CodeOllamaLLM;
