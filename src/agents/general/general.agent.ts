import { CloudGraphState } from 'src/workflows/cloud.workflow';
import { AIMessage, SystemMessage } from '@langchain/core/messages';
import { GENERAL_CLOUD_SYSTEM_PROMPT } from './prompts.constants';
import OllamaLLM from 'src/utils/ollama.llm';

export const GeneralAgent = async (
  state: typeof CloudGraphState.State,
): Promise<Partial<typeof CloudGraphState.State>> => {
  try {
    const messagesPayload = [
      new SystemMessage(GENERAL_CLOUD_SYSTEM_PROMPT),
      ...state.messages,
    ];
    const response = await OllamaLLM.withConfig({ format: 'json' }).invoke(
      messagesPayload,
    );
    const parsedResponse = JSON.parse(response?.content?.toString() ?? '{}');
    const content = parsedResponse?.response?.toString() ?? response?.content?.toString();
    const aiMessage = new AIMessage(content,{
      agent:"general_agent",
      details: parsedResponse?.details ?? {}
    })
    return {
      ...state,
      messages: [aiMessage],
      extra_info:{
        ...state.extra_info,
        active_agent:"general_agent"
      }
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
