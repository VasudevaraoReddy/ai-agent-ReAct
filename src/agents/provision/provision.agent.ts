import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import OllamaLLM from 'src/utils/ollama.llm';
import { CloudGraphState } from 'src/workflows/cloud.workflow';
import { PROVISION_AGENT_PROMPT } from './promts.constants';
import { getChatHistoryFromMessages } from 'src/utils/getPromtFromMessages';
import serviceConfigTool from './tools/service-config.tool';
import deployTool from './tools/deploy.tool';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { Command } from '@langchain/langgraph';

export const ProvisionAgent = async (
  state: typeof CloudGraphState.State,
): Promise<Partial<typeof CloudGraphState.State> | Command> => {
  try {
    const formData = state.extra_info.service_form_data;
    const userId = state.extra_info.userId;
    const csp = state.extra_info.csp ?? 'azure';

    // Determine if form data is provided
    const formDataProvided =
      formData && Object.keys(formData).length > 0 ? 'True' : 'False';

    // Format prompt with current state
    const formattedPrompt = PROVISION_AGENT_PROMPT.replace(
      /\{formData\}/g,
      formDataProvided,
    ).replace(/\{cloudProvider\}/g, csp.toLocaleUpperCase());

    const messagesPayload = [
      new SystemMessage(formattedPrompt),
      ...state.messages,
    ];

    const tools = [serviceConfigTool, deployTool];
    const agent = createReactAgent({
      llm: OllamaLLM,
      tools: tools,
      prompt: formattedPrompt,
    });

    const response = await agent.invoke(
      {
        messages: getChatHistoryFromMessages(messagesPayload),
      },
      {
        configurable: {
          userId: userId,
          csp: csp,
          service_form_data: formData,
          service_config_available: state.extra_info.service_config_available,
          service_config: state.extra_info.service_config,
        },
        recursionLimit: 15,
      },
    );

    // Collect all tool messages
    const tools_response: ToolMessage[] = [];
    for (const message of response?.messages) {
      if (message.getType() === 'tool') {
        tools_response.push(message as ToolMessage);
      }
    }
    // Process service config and deploy tool responses
    const toolResults = processToolResponses(tools_response);

    let responseMessage = '';

    if(toolResults.responseFromTool === "" || toolResults.responseFromTool === null || toolResults.responseFromTool === undefined){
      responseMessage =
      response?.structuredResponse?.response ??
      (response?.messages[response?.messages.length - 1]?.content as string);
    }else{
      responseMessage = toolResults.responseFromTool;
    }

    // Check if we need to redirect to terraform generator
    if (toolResults.useTerraformGenerator) {
      // Store resource information in the extra_info for the terraform generator to use
      state.extra_info.user_input = `Generate Terraform code for ${toolResults.resourceType} on ${csp.toUpperCase()}`;
      state.extra_info.terraform_resource_type = toolResults.resourceType;
      state.extra_info.terraform_specifications = toolResults.specifications;

      // Add a human message to context to carry over to terraform generator
      const humanMessage = new HumanMessage(
        `Generate Terraform code for ${toolResults.resourceType} on ${csp.toUpperCase()}`,
      );
      state.messages.push(humanMessage);

      // Redirect to terraform generator
      return new Command({
        goto: 'terraform_generator_agent',
      });
    }

    const isServiceConfigFetched = toolResults.serviceConfigFetched;
    const isDeployToolCalled = toolResults.deployToolCalled;
    const deploySuccess = toolResults.deploySuccess;

    // Create AI message with appropriate details
    const aiMessage = new AIMessage(responseMessage, {
      agent: 'provision_agent',
      details: {
        serviceConfig: toolResults.serviceConfig,
        found: toolResults.found,
        isDeployed: isDeployToolCalled && deploySuccess,
        devOpsResponse: toolResults?.devOpsResponse,
        serviceDeploymentId: toolResults?.serviceDeploymentId,
      },
    });

    // Return updated state
    return {
      messages: [aiMessage],
      extra_info: {
        ...state.extra_info,
        active_agent: 'provision_agent',
        // Only clear formData if deployment was successful
        service_form_data: isDeployToolCalled && deploySuccess ? {} : formData,
        // Update service_config_status based on whether we found a service config
        // Clear serviceConfig if deployment was successful
        service_config_available: deploySuccess
          ? false
          : isServiceConfigFetched,
        service_config: deploySuccess ? null : toolResults.serviceConfig,
      },
    };
  } catch (error) {
    console.error('Error in ProvisionAgent:', error);
    return {
      messages: [
        new AIMessage(
          'I encountered an error while processing your request. Please try again.',
        ),
      ],
    };
  }
};

// Improved tool response processing to handle both service config and deploy tools
const processToolResponses = (messages: ToolMessage[]) => {
  const results = {
    serviceConfig: null,
    found: false,
    serviceConfigFetched: false,
    deployToolCalled: false,
    deploySuccess: false,
    devOpsResponse: null,
    serviceDeploymentId: null,
    useTerraformGenerator: false,
    resourceType: '',
    specifications: '',
    responseFromTool: '',
  };

  for (const message of messages) {
    try {
      const content = JSON.parse((message?.content as string) || '{}');
      results.responseFromTool = content?.response;

      // Process service configuration tool response
      if (message.name === 'get_service_config') {
        results.serviceConfigFetched = true;
        results.serviceConfig = content?.serviceConfig ?? null;
        results.found = content?.found ?? false;

        // Check if terraform generator should be used
        results.useTerraformGenerator =
          content?.use_terraform_generator === true;
        if (results.useTerraformGenerator) {
          results.resourceType = content?.resource_type || '';
          results.specifications = content?.specifications || '';
        }
      }

      // Process deployment tool response
      if (message.name === 'deploy_service') {
        results.deployToolCalled = true;
        results.deploySuccess = content?.status === true;
        results.serviceConfig = content?.serviceConfig ?? null;
        results.found = content?.found ?? false;
        results.serviceConfigFetched = content?.serviceConfig ?? false;
        results.devOpsResponse = content?.devOpsResponse;
        results.serviceDeploymentId = content?.serviceDeploymentId;
      }
    } catch (error) {
      console.error('Error processing tool message:', error);
    }
  }

  return results;
};
