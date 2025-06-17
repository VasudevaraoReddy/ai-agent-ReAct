import * as dotenv from 'dotenv';
import { ChatOllama } from '@langchain/ollama';

dotenv.config();

const OllamaLLM  = new ChatOllama({
  model: process.env.MODEL_NAME,
  baseUrl: process.env.MODEL_BASE_URL,
});

export default OllamaLLM;
