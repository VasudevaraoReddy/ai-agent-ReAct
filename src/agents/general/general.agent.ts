import { CloudGraphState } from 'src/workflows/cloud.workflow';
import { AIMessage, SystemMessage } from '@langchain/core/messages';
import { GENERAL_CLOUD_SYSTEM_PROMPT } from './prompts.constants';
import OllamaLLM from 'src/utils/ollama.llm';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import {
  transferToProvisionAgent,
  transferToRecommendationsAgent,
  transferToTerraformGeneratorAgent,
  transferToFinopsAgent,
  CheckHandOffToolFromMessages,
} from 'src/utils/createHandoffTool';

export const GeneralAgent = async (
  state: typeof CloudGraphState.State,
): Promise<Partial<typeof CloudGraphState.State>> => {
  try {
    const messagesPayload = [
      new SystemMessage(GENERAL_CLOUD_SYSTEM_PROMPT),
      ...state.messages,
    ];
    const tools = [
      transferToProvisionAgent,
      transferToRecommendationsAgent,
      transferToTerraformGeneratorAgent,
      transferToFinopsAgent,
    ];
    const agent = createReactAgent({
      llm: OllamaLLM,
      tools: tools,
      prompt: GENERAL_CLOUD_SYSTEM_PROMPT,
    });
    const response = await agent.invoke({
      messages: messagesPayload,
    });
    // check if need to hand off to another agent
    const command = await CheckHandOffToolFromMessages(
      response.messages,
      'general_agent',
    );
    if (command) {
      return command;
    }
    const aiMessage = response.messages[
      response.messages.length - 1
    ] as AIMessage;
    let responseContent = '';
    try {
      const parsedResponse = JSON.parse(aiMessage?.content?.toString() ?? '{}');
      responseContent =
        parsedResponse?.response?.toString() ?? 'No response generated.';
    } catch (error) {
      responseContent =
        aiMessage?.content?.toString() ?? 'No response generated.';
    }
    return {
      ...state,
      messages: [
        new AIMessage(responseContent, {
          agent: 'general_agent',
          details: {},
        }),
      ],
      extra_info: {
        ...state.extra_info,
        active_agent: 'general_agent',
      },
    };
  } catch (error) {
    return {
      ...state,
      messages: [
        new AIMessage('Sorry i am facing some issues please try again later', {
          agent: 'general_agent',
          details: {},
        }),
      ],
    };
  }
};
