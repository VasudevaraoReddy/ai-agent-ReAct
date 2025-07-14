import {
  AIMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { CloudGraphState } from 'src/workflows/cloud.workflow';
import OllamaLLM from 'src/utils/ollama.llm';
import { RECOMMENDATIONS_AGENT_PROMPT } from './prompt.constants';
import { getChatHistoryFromMessages } from 'src/utils/getPromtFromMessages';
import recommendationsTool from './tools/recommendations.tool';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { z } from 'zod';

const recommendationsResponse = z.object({
  response: z.string().optional(),
});

export const RecommendationAgent = async (
  state: typeof CloudGraphState.State,
): Promise<Partial<typeof CloudGraphState.State>> => {
  console.log("In recommendations agent");
  console.time('RecommendationAgent:total');

  try {
    const messagesPayload = [
      new SystemMessage(RECOMMENDATIONS_AGENT_PROMPT),
      ...state.messages,
    ];

    const tools = [recommendationsTool];

    const agent = createReactAgent({
      llm: OllamaLLM,
      tools: tools,
      prompt: RECOMMENDATIONS_AGENT_PROMPT,
      responseFormat: recommendationsResponse,
    });

    const response = await agent.invoke(
      {
        messages: getChatHistoryFromMessages(messagesPayload),
      },
      {
        configurable: {
          csp: state.extra_info.csp,
        },
      },
    );

    const tools_response: ToolMessage[] = [];

    for (const message of response?.messages || []) {
      if (message.getType() === 'tool') {
        tools_response.push(message as ToolMessage);
      }
    }

    const formattedToolMessage = await formatToolMessage(tools_response);

    let responseMessage = '';

    if (
      !formattedToolMessage.finalResponse ||
      formattedToolMessage.finalResponse.trim() === ''
    ) {
      responseMessage =
        response?.structuredResponse?.response ??
        (response?.messages?.[response?.messages.length - 1]?.content as string) ??
        'Sorry, no valid recommendation response could be generated.';
    } else {
      responseMessage = formattedToolMessage.finalResponse;
    }

    console.timeEnd('RecommendationAgent:total');

    return {
      ...state,
      messages: [
        new AIMessage(responseMessage, {
          agent: 'recommendation_agent',
          details: {
            recommendations: formattedToolMessage.recommendations,
            input: formattedToolMessage.input,
          },
        }),
      ],
      extra_info: {
        ...state.extra_info,
        active_agent: 'recommendation_agent',
      },
    };
  } catch (error) {
    console.timeEnd('RecommendationAgent:total');
    console.log(error, 'error');
    return {
      ...state,
      messages: [
        new AIMessage(
          'Sorry, I am facing some issues in the recommendations agent. Please try again later.',
        ),
      ],
    };
  }
};

const formatToolMessage = async (messages: ToolMessage[]) => {
  const formattedMessages = {
    finalResponse: '',
    recommendations: [],
    input: {},
  };

  for await (const message of messages) {
    console.log(message, 'message');

    try {
      const content = JSON.parse(message?.content as string);
      formattedMessages.finalResponse = content?.response ?? '';
      formattedMessages.recommendations = content?.recommendations ?? [];
      formattedMessages.input = content?.input ?? {};
    } catch (err) {
      // Not JSON: fallback to raw message
      console.warn('Invalid JSON in tool message:', message?.content);
      formattedMessages.finalResponse = "Sorry i am facing some issues in recommendations agent please try again with a different query"
    }
  }

  return formattedMessages;
};
