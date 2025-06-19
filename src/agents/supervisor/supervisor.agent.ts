import OllamaLLM from 'src/utils/ollama.llm';
import { CloudGraphState } from 'src/workflows/cloud.workflow';
import transferToProvisionAgent from './tools/transfer_to_provision_agent.tool';
import transferToGeneralAgent from './tools/transfer_to_general_agent.tool';
import transferToRecommendationsAgent from './tools/transfer_to_recommendations_agent.tool';
import { AIMessage, SystemMessage } from '@langchain/core/messages';
import { Command } from '@langchain/langgraph';
import {
  getChatHistoryFromMessages,
} from 'src/utils/getPromtFromMessages';
import { SUPERVISOR_SYSTEM_PROMPT } from './prompts.constants';
import { createReactAgent } from '@langchain/langgraph/prebuilt';


export const SupervisorAgent = async (
  state: typeof CloudGraphState.State,
): Promise<any> => {
  try {
    if(state.extra_info.user_selected_active_agent===""){
    const tools = [
      transferToRecommendationsAgent,
      transferToProvisionAgent,
      transferToGeneralAgent,
    ];
    const messagesPayload = [
      new SystemMessage(SUPERVISOR_SYSTEM_PROMPT),
      ...state.messages,
    ];
    const lastPerformedAgent=state.extra_info.active_agent as string
    const formattedPrompt=SUPERVISOR_SYSTEM_PROMPT.replace("{previous_active_agent}",lastPerformedAgent)
    const agent = createReactAgent({
      llm: OllamaLLM,
      tools,
      prompt: formattedPrompt,
    });
    const response = await agent.invoke({
      messages: getChatHistoryFromMessages(messagesPayload),
    });
    for (const message of response?.messages) {
      if (message.getType() === 'tool') {
        const toolResponse = message?.lc_kwargs?.name as string;
        return await handOffToAgent(toolResponse, state);
      }
    }
    return new Command({
      goto: 'general_agent',
    });
  }else{
    return new Command({
      goto:state.extra_info.user_selected_active_agent
    })
  }
  } catch (error) {
    console.log(error, 'error');
    return {
      ...state,
      messages: [
        new AIMessage('Sorry i am facing some issues please try again later'),
      ],
    };
  }
};

const handOffToAgent = async (
  toolAction: string,
  state: typeof CloudGraphState.State,
) => {
  const goToAgent =
    toolAction === 'transfer_to_recommendations_agent'
      ? 'recommendation_agent'
      : toolAction === 'transfer_to_provision_agent'
        ? 'provision_agent'
        : 'general_agent';
  return new Command({
    goto: goToAgent,
  });
};
