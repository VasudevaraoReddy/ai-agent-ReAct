import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

const GoogleLLM = new ChatGoogleGenerativeAI({
  model: 'gemini-1.5-flash',
  temperature: 0.3,
  maxOutputTokens: 2048,
  apiKey: process.env.GEMINI_API_KEY, // Ensure this is defined in your environment
});

export default GoogleLLM;
