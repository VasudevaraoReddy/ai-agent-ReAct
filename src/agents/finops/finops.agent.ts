import { CloudGraphState } from 'src/workflows/cloud.workflow';
import { AIMessage, SystemMessage } from '@langchain/core/messages';
import axios from 'axios';
import {
  transferToProvisionAgent,
  transferToTerraformGeneratorAgent,
  transferToRecommendationsAgent,
  transferToGeneralAgent,
  CheckHandOffToolFromMessages,
} from 'src/utils/createHandoffTool';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { getChatHistoryFromMessages } from 'src/utils/getPromtFromMessages';
import OllamaLLM from 'src/utils/ollama.llm';
import { FINOPS_AGENT_PROMPT } from './finops.constants';

export const FinopsAgent = async (
  state: typeof CloudGraphState.State,
): Promise<Partial<typeof CloudGraphState.State>> => {
  try {
    const messagesPayload = [
      new SystemMessage(FINOPS_AGENT_PROMPT),
      ...state.messages,
    ];

    const response = await axios.post('http://localhost:3002/chat', {
      session_id: state.extra_info.userId,
      message: state.extra_info.user_input,
    });

    const aiMessage = new AIMessage(response?.data?.response, {
      agent: 'finops_agent',
      details: response?.data,
    });

    // Check if need to hand off to another agent
    const tools = [
      transferToProvisionAgent,
      transferToTerraformGeneratorAgent,
      transferToRecommendationsAgent,
      transferToGeneralAgent,
    ];
    const agent = createReactAgent({
      llm: OllamaLLM,
      tools,
      prompt: FINOPS_AGENT_PROMPT,
    });

    const agentResponse = await agent.invoke({
      messages: getChatHistoryFromMessages(messagesPayload),
    });

    // Check if need to hand off to another agent
    const command = await CheckHandOffToolFromMessages(
      agentResponse.messages,
      'finops_agent',
    );
    if (command) {
      return command;
    }

    return {
      ...state,
      messages: [aiMessage],
      extra_info: {
        ...state.extra_info,
        active_agent: 'finops_agent',
      },
    };
  } catch (error) {
    return {
      ...state,
      messages: [
        new AIMessage('Sorry i am facing some issues please try again later'),
      ],
    };
  }
};
