import { AIMessage, SystemMessage } from '@langchain/core/messages';
import { CloudGraphState } from 'src/workflows/cloud.workflow';
import OllamaLLM from 'src/utils/ollama.llm';
import recommendationsTool from './tools/recommendations.tool';
import { RECOMMENDATIONS_AGENT_PROMPT } from './prompt.constants';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { getChatHistoryFromMessages } from 'src/utils/getPromtFromMessages';

// Helper function to safely extract string content from messages
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

export const RecommendationsAgent = async (
  state: typeof CloudGraphState.State,
): Promise<Partial<typeof CloudGraphState.State>> => {
  console.log('In recommendations agent');
  console.time('RecommendationsAgent:total');

  try {
    // Setup tools and agent
    const tools = [recommendationsTool];
    
    const messagesPayload = [
      new SystemMessage(RECOMMENDATIONS_AGENT_PROMPT),
      ...state.messages,
    ];
    
    const agent = createReactAgent({
      llm: OllamaLLM,
      tools,
      prompt: RECOMMENDATIONS_AGENT_PROMPT,
    });

    // Invoke agent with the messages
    const response = await agent.invoke({
      messages: getChatHistoryFromMessages(messagesPayload),
    });

    // Get the final AI message from the response
    const aiMessage = response.messages
      .filter(msg => msg.getType() === 'ai')
      .pop();
      
    const aiMessageContent = aiMessage ? getMessageContent(aiMessage) : 'No response generated.';
    
    // Return the final response
    return {
      ...state,
      messages: [
        new AIMessage(aiMessageContent, {
          agent: 'recommendation_agent'
        }),
      ],
      extra_info: {
        ...state.extra_info,
        active_agent: 'recommendation_agent',
      },
    };
  } catch (error) {
    console.timeEnd('RecommendationsAgent:total');
    console.error('Error in RecommendationsAgent:', error);
    return {
      ...state,
      messages: [
        new AIMessage(
          "**❌ Recommendation Agent Error**\n\nI'm experiencing technical difficulties with the recommendations system. This could be due to:\n\n- Database connection issues\n- Query processing issues\n- Invalid data format\n\n**Please try:**\n- Asking your question again in a few moments\n- Contacting support if the issue persists",
          {
            agent: 'recommendation_agent',
            details: {
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          },
        ),
      ],
      extra_info: {
        ...state.extra_info,
        active_agent: 'recommendation_agent',
      },
    };
  }
};
