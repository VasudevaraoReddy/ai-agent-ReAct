import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import OllamaLLM from 'src/utils/ollama.llm';
import { CloudGraphState } from 'src/workflows/cloud.workflow';
import { PROVISION_AGENT_PROMPT } from './promts.constants';
import {
  getChatHistoryFromMessages,
} from 'src/utils/getPromtFromMessages';
import serviceConfigTool from './tools/service-config.tool';
import deployTool from './tools/deploy.tool';
import { createReactAgent } from '@langchain/langgraph/prebuilt';

export const ProvisionAgent = async (
  state: typeof CloudGraphState.State,
): Promise<Partial<typeof CloudGraphState.State>> => {
  try {
    const service_config_status = state.extra_info.service_config_status?"True":"False";
    console.log('service_config_status', service_config_status);
    const formData = state.extra_info.formData;
    const userId = state.extra_info.userId;
    const csp = state.extra_info.csp;
    const formDataProvided = formData && Object.keys(formData).length > 0 ? 'True' : 'False';
    const formmatedPrompt = PROVISION_AGENT_PROMPT.replace(
      '{service_config_status}',
      service_config_status,
    ).replace('{formData}', formDataProvided);
    const messagesPayload = [
      new SystemMessage(formmatedPrompt),
      ...state.messages,
    ];
    const tools = [serviceConfigTool, deployTool];
    const agent = createReactAgent({
      llm: OllamaLLM,
      tools: tools,
      prompt: PROVISION_AGENT_PROMPT,
    });
    const response = await agent.invoke(
      {
        messages: getChatHistoryFromMessages(messagesPayload),
      },
      {
        configurable: {
          formData: formData,
          userId: userId,
          csp: csp,
        },
      },
    );
    const responseMessage = response?.messages[response?.messages.length - 1]
      ?.content as string;
    const tools_response: ToolMessage[] = [];
    for (const message of response?.messages) {
      if (message.getType() === 'tool') {
        tools_response.push(message as ToolMessage);
      }
    }
    const isDeployToolCalled = tools_response.some(tool => tool.name === 'deploy_service');
    const formattedToolResponse = await formatToolMessage(tools_response);
    const aiMessage = new AIMessage(responseMessage, {
      agent: 'provision_agent',
      details: {
        serviceConfig: formattedToolResponse.serviceConfig,
        found: formattedToolResponse.found,
        isDeployed: isDeployToolCalled,
      },
    });
    return {
      messages: [aiMessage],
      extra_info: {
        ...state.extra_info,
        active_agent: 'provision_agent',
        // clear formData based on deploy tool
        formData: isDeployToolCalled ? {} : formData,
      },
    };
  } catch (error) {
    return {
      messages: [
        new AIMessage(
          'I encountered an error while processing your request. Please try again.',
        ),
      ],
    };
  }
};

const formatToolMessage = async (messages: ToolMessage[]) => {
  const formattedMessages = {
    serviceConfig: null,
    found: false,
  };
  for await (const message of messages) {
    const content =
      JSON.parse((message?.content as string) || '{}') ?? message.content;
    formattedMessages.serviceConfig = content?.serviceConfig ?? null;
    formattedMessages.found = content?.found ?? false;
  }
  return formattedMessages;
};
