// import { AIMessage, SystemMessage } from '@langchain/core/messages';
// import { CloudGraphState } from 'src/workflows/cloud.workflow';
// import OllamaLLM from 'src/utils/ollama.llm';
// import { ChromaClient } from 'chromadb';
// import { OllamaEmbeddings } from '@langchain/ollama';
// import { RETURN } from '@langchain/langgraph/dist/constants';

// // Initialize embedding model for semantic search
// const embeddings = new OllamaEmbeddings({
//   model: 'nomic-embed-text:latest',
//   baseUrl: 'http://10.95.108.25:11434',
// });

// // ChromaDB client configuration
// const chroma = new ChromaClient({
//   path: 'http://10.95.108.25:8000',
// });

// // Helper function to safely extract string content from messages
// const getMessageContent = (message: any): string => {
//   if (typeof message.content === 'string') {
//     return message.content;
//   } else if (Array.isArray(message.content)) {
//     // Handle complex message content - extract text from array
//     return message.content
//       .map((item: any) => item.text || item.content || '')
//       .join(' ')
//       .trim();
//   }
//   return '';
// };

// // Helper function to query ChromaDB directly
// const queryRecommendations = async (question: string) => {
//   console.log('⏳ Loading recommendations from ChromaDB...');

//   try {
//     const collection = await chroma.getCollection({
//       name: 'azure-advisor-recommendations',
//     });

//     console.log('✅ Collection loaded successfully');
//     console.log('Question: ', question);

//     // Generate embedding for the question
//     const queryVector = await embeddings.embedQuery(question);

//     // Query with the current question to get relevant recommendations
//     const result = await collection.query({
//       queryEmbeddings: [queryVector],
//       nResults: 5, // Reduced per question to avoid overwhelming context
//       include: ['documents', 'metadatas', 'distances'],
//     });

//     const docs = result.documents?.[0] || [];
//     const metadatas = result.metadatas?.[0] || [];
//     const distances = result.distances?.[0] || [];

//     // Sort by relevance (distance) and take top 10
//     const sortedResults = docs
//       .map((doc, i) => ({
//         doc,
//         metadata: metadatas[i],
//         distance: distances[i],
//       }))
//       .sort((a, b) => {
//         // Handle null values for distance
//         const distA = a.distance === null ? Infinity : a.distance; // Treat null as the highest distance
//         const distB = b.distance === null ? Infinity : b.distance; // Treat null as the highest distance

//         return distA - distB;
//       })
//       .slice(0, 10);

//     if (sortedResults.length === 0) {
//       return {
//         context: '',
//         sourceCount: 0,
//         relevanceScores: [],
//       };
//     }

//     const context = sortedResults
//       .map(({ doc, metadata, distance }, i) => {
//         try {
//           const content = doc;

//           return content;
//         } catch (error) {
//           console.error('Error formatting document:', error);
//           return null;
//         }
//       })
//       .filter(Boolean)
//       .join('\n\n');

//     return {
//       context: context,
//       sourceCount: sortedResults.length,
//       relevanceScores: sortedResults.map(({ distance }) =>
//         distance !== null ? (1 - distance).toFixed(3) : 'N/A',
//       ),
//     };
//   } catch (error: any) {
//     console.error('❌ Error querying ChromaDB:', error);
//     throw error;
//   }
// };

// // Helper function to build enhanced prompt with current question and context
// const buildEnhancedPrompt = (
//   currentQuestion: string,
//   context: string,
// ): string => {
//   return `
// You are an expert Azure Advisor assistant, providing actionable recommendations based on the context below. Ensure you directly answer the user's question using the most relevant recommendations.

// ## Current Question:
// **${currentQuestion}**

// ## Context (Most Relevant Azure Advisor Recommendations):
// **${context}**

// ## Instructions:
// - List **all** the recommendations from the context (up to a maximum of 5). Do **not skip** or **summarize** them.
// - For each recommendation, provide detailed, **actionable** advice.
// - Include specific **recommendation IDs** and reference them clearly.
// - When applicable, include **cost savings** information or estimates, specifying potential **annual savings**.
// - Be **clear and concise** in your explanations to ensure the user can easily understand what to do.

// ### Formatting Requirements:
// - Use **bold text** for **headings** and key sections.
// - Utilize **bullet points** for clarity and better structure.
// - Organize your response into clear sections with markdown formatting (e.g., **Recommendation**, **Impact**, etc.).
// - Ensure the response is visually easy to scan, with each section clearly marked.

// ### Response Format:
// For each recommendation, make sure to follow this structure:

// 1. **Recommendation**: {detailed solution}
// 2. **Category**: {category of the recommendation (e.g., Cost, Security, etc.)}
// 3. **Impact**: {impact level of the recommendation (e.g., High, Medium, Low)}
// 4. **Resource**: {resource being impacted value (e.g., INCDCXS00NMVM06, cloudstoreyaks, etc.)}
// 5. **Service**: {impacted Azure service (e.g., Virtual Machine, Storage, SQL Server etc.)}
// 6. **Description**: {brief but clear explanation of the problem and the recommended solution. Be specific.}
// 7. **Cost**: If applicable, provide a specific dollar amount or percentage of savings. If no cost savings data is available, mention: "Cost savings information not available."
// 8. **Annual Savings**: If applicable, provide the estimated annual savings. If no annual savings data is available, mention: "Annual savings information not available."
// 9. **Term**: If Applicable, {Term (e.g., P1Y, P3Y)}. If not applicable "N/A"
// 10. **Region**: If applicable, {Region (e.g., eastus, centralIndia)}. If not applicable "N/A"

// ### Example Response:
// - **Recommendation**: Move Virtual Machines to Reserved Instances
// - **Category**: Cost Optimization
// - **Impact**: High
// - **Resource**: INCDCXS00NMVM06
// - **Service**: Virtual Machine
// - **Description**: Enable Trusted Launch on your existing Generation 2 VMs to ensure they are protected by modern security features. This includes features such as Secure Boot, UEFI firmware validation, and Virtual Trusted Platform Module (vTPM).
// - **Cost**: Cost savings information not available.
// - **Annual Savings**: Annual savings information not available.
// - **Term**: N/A.
// - **Region**: N/A.
// ---
// Remember, if no specific cost or savings information is available, provide a general statement like "Cost savings information not available." This helps maintain clarity in the response without leaving gaps.
// `;
// };

// export const RecommendationAgent = async (
//   state: typeof CloudGraphState.State,
// ): Promise<Partial<typeof CloudGraphState.State>> => {
//   console.log('In recommendations agent');
//   console.time('RecommendationAgent:total');

//   try {
//     const messagesPayload = [new SystemMessage(''), ...state.messages];
//     console.log(messagesPayload);
//     // Extract current question from the last user message
//     const lastUserMessage = state.messages
//       .slice()
//       .reverse()
//       .find((msg) => msg.getType() === 'human');

//     if (!lastUserMessage) {
//       throw new Error('No user message found');
//     }

//     const currentQuestion = getMessageContent(lastUserMessage);

//     if (!currentQuestion) {
//       throw new Error('No valid question content found');
//     }

//     // Query ChromaDB with the current question
//     const { context, sourceCount, relevanceScores } =
//       await queryRecommendations(currentQuestion);

//     if (!context || context.trim() === '') {
//       console.timeEnd('RecommendationAgent:total');
//       return {
//         ...state,
//         messages: [
//           new AIMessage(
//             '**❌ No Relevant Recommendations Found**\n\nI couldn\'t find any relevant Azure Advisor recommendations for your question. This could mean:\n\n- The recommendations database might be empty\n- Your query might need to be more specific\n\n**💡 Suggestions:**\n- Try rephrasing your query with specific Azure service names\n- Ask about common areas like "cost optimization", "performance", or "security"\n\n**❓ Need Help?**\nFeel free to ask about specific Azure services or recommendation categories!',
//             {
//               agent: 'recommendation_agent',
//               details: {
//                 recommendations: [],
//                 input: { question: currentQuestion },
//                 sourceCount: 0,
//                 relevanceScores: [],
//               },
//             },
//           ),
//         ],
//         extra_info: {
//           ...state.extra_info,
//           active_agent: 'recommendation_agent',
//         },
//       };
//     }

//     // Build enhanced prompt with current question and context
//     const enhancedPrompt = buildEnhancedPrompt(currentQuestion, context);

//     // Generate response using the LLM
//     const result = await OllamaLLM.invoke(enhancedPrompt);
//     const responseContent =
//       result?.content?.toString() ?? 'No response generated.';

//     console.timeEnd('RecommendationAgent:total');

//     return {
//       ...state,
//       messages: [
//         new AIMessage(responseContent, {
//           agent: 'recommendation_agent',
//           details: {
//             recommendations: [],
//             input: { question: currentQuestion },
//             sourceCount,
//             relevanceScores,
//             conversationContext: false, // No conversation context used
//           },
//         }),
//       ],
//       extra_info: {
//         ...state.extra_info,
//         active_agent: 'recommendation_agent',
//       },
//     };
//   } catch (error) {
//     console.timeEnd('RecommendationAgent:total');
//     console.log(error, 'error');
//     return {
//       ...state,
//       messages: [
//         new AIMessage(
//           "**❌ Recommendation Agent Error**\n\nI'm experiencing technical difficulties with the recommendations system. This could be due to:\n\n- ChromaDB connection issues\n- Embedding model problems\n- Database query failures\n\n**🔧 Please try:**\n- Asking your question again in a few moments\n- Checking if the recommendations database is accessible\n- Contacting support if the issue persists\n\n**💡 Alternative:**\nYou can ask me general questions about Azure best practices while we resolve this issue.",
//           {
//             agent: 'recommendation_agent',
//             details: {
//               error: error instanceof Error ? error.message : 'Unknown error',
//             },
//           },
//         ),
//       ],
//       extra_info: {
//         ...state.extra_info,
//         active_agent: 'recommendation_agent',
//       },
//     };
//   }
// };

import { AIMessage, SystemMessage } from '@langchain/core/messages';
import { CloudGraphState } from 'src/workflows/cloud.workflow';
import OllamaLLM from 'src/utils/ollama.llm';
import { QdrantClient } from '@qdrant/js-client-rest';
import { OllamaEmbeddings } from '@langchain/ollama';

const qdrant = new QdrantClient({
  url: 'http://10.95.108.25:6333',
});

const embeddings = new OllamaEmbeddings({
  model: 'nomic-embed-text:latest',
  baseUrl: 'http://10.95.108.25:11434',
});

const getMessageContent = (message: any): string => {
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .map((item: any) => item.text || item.content || '')
      .join(' ')
      .trim();
  }
  return '';
};

const queryQdrantRecommendations = async (question: string) => {
  const queryVector = await embeddings.embedQuery(question);

  const results = await qdrant.search('azure-advisor-recommendations', {
    vector: queryVector,
    limit: 5,
    with_payload: true,
    with_vector: false,
  });

  console.log(results)
  return results
    .map((r) => {
      const payload = r.payload ?? {};
      const content = payload.content ?? '';
      const metadata = payload;
      return {
        content,
        metadata,
        score: r.score ?? null,
      };
    })
    .sort((a, b) => {
      const aDist = a.score ?? Infinity;
      const bDist = b.score ?? Infinity;
      return aDist - bDist;
    });
};

const formatMarkdownForLLM = (question: string, results: any[]): string => {
  let context = `## User Question:\n**${question}**\n\n`;
  context += `## Raw Recommendations:\n`;

  results.forEach((r, index) => {
    const md = r.metadata;
    context += `\n### 🔹 Recommendation ${index + 1}\n`;
    context += `- **Recommendation ID**: ${md.recommendationId ?? 'N/A'}\n`;
    context += `- **Category**: ${md.category ?? 'N/A'}\n`;
    context += `- **Impact**: ${md.impact ?? 'N/A'}\n`;
    context += `- **Resource**: ${md.impactedValue ?? 'N/A'}\n`;
    context += `- **Service**: ${md.impactedService ?? 'N/A'}\n`;
    context += `- **Region**: ${md.region ?? 'N/A'}\n`;
    context += `- **Term**: ${md.term ?? 'N/A'}\n`;
    context += `- **Cost Savings**: ${md.costSavings ?? 'Not available'}\n`;
    context += `- **Annual Savings**: ${md.annualSavings ?? 'Not available'}\n`;
    context += `- **Problem**: ${md.problem ?? 'Not specified'}\n`;
    context += `- **Solution**: ${md.solution ?? 'Not specified'}\n`;
  });

  context += `\n\n## Instructions:\n`;
  context += `You are an expert Azure Advisor assistant.\n`;
  context += `Your task is to format and clearly explain each recommendation.\n`;
  context += `If Problem and Solution are identical, rewrite the Problem as a description of the issue and make the Solution actionable.\n`;
  context += `Do not leave any fields blank. Always follow the format strictly.\n`;
  context += `\n### Template for Each Recommendation:\n`;
  context += `\n### 🔹 Recommendation {Number}`;
  context += `\n- **Recommendation**: {summary}`;
  context += `\n- **Category**: {category}`;
  context += `\n- **Impact**: {impact}`;
  context += `\n- **Resource**: {resource}`;
  context += `\n- **Service**: {service}`;
  context += `\n- **Region**: {region}`;
  context += `\n- **Term**: {term}`;
  context += `\n- **Cost Savings**: {amount}`;
  context += `\n- **Annual Savings**: {amount}`;
  context += `\n- **Problem**: {explanation}`;
  context += `\n- **Solution**: {what to do}`;

  return context;
};

export const RecommendationAgent = async (
  state: typeof CloudGraphState.State,
): Promise<Partial<typeof CloudGraphState.State>> => {
  console.time('RecommendationAgent');

  try {
    const lastUserMessage = state.messages
      .slice()
      .reverse()
      .find((msg) => msg.getType() === 'human');

    if (!lastUserMessage) {
      throw new Error('No user message found');
    }

    const userQuestion = getMessageContent(lastUserMessage);
    if (!userQuestion) {
      throw new Error('No question found in message');
    }

    const searchResults = await queryQdrantRecommendations(userQuestion);

    if (searchResults.length === 0) {
      return {
        ...state,
        messages: [
          new AIMessage(
            '❌ No relevant Azure Advisor recommendations found for your question.',
            {
              agent: 'recommendation_agent',
            },
          ),
        ],
        extra_info: {
          ...state.extra_info,
          active_agent: 'recommendation_agent',
        },
      };
    }

    const llmPrompt = formatMarkdownForLLM(userQuestion, searchResults);
    const llmResponse = await OllamaLLM.invoke(llmPrompt);

    return {
      ...state,
      messages: [
        new AIMessage(
          llmResponse?.content?.toString() ?? '⚠️ No response generated.',
          {
            agent: 'recommendation_agent',
            details: {
              recommendations: searchResults,
              input: { question: userQuestion },
            },
          },
        ),
      ],
      extra_info: {
        ...state.extra_info,
        active_agent: 'recommendation_agent',
      },
    };
  } catch (error) {
    console.error('💥 Error in RecommendationAgent:', error);
    return {
      ...state,
      messages: [
        new AIMessage(
          `❌ Internal error in recommendation agent: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
          { agent: 'recommendation_agent' },
        ),
      ],
      extra_info: {
        ...state.extra_info,
        active_agent: 'recommendation_agent',
      },
    };
  } finally {
    console.timeEnd('RecommendationAgent');
  }
};
