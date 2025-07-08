import {
  AIMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import OllamaLLM from 'src/utils/ollama.llm';
import { CloudGraphState } from 'src/workflows/cloud.workflow';
import { TERRAFORM_GENERATOR_PROMPT } from './prompts.constants';
import { getChatHistoryFromMessages } from 'src/utils/getPromtFromMessages';
import generateTerraformTool from './tools/generate-terraform.tool';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { z } from 'zod';

const terraformResponse = z.object({
  response: z.string().optional(),
  terraform_files: z
    .object({
      main_tf: z.string(),
      variables_tf: z.string(),
      outputs_tf: z.string(),
      terraform_tfvars_json: z.string(),
    })
    .optional(),
});

interface TerraformFiles {
  'main.tf': string;
  'variables.tf': string;
  'outputs.tf': string;
  'terraform.tfvars.json': string;
}

export const TerraformGeneratorAgent = async (
  state: typeof CloudGraphState.State,
): Promise<Partial<typeof CloudGraphState.State>> => {
  try {
    const csp = state.extra_info.csp ?? 'azure';
    const userid = state.extra_info.userId;
    const userInput = state.extra_info.user_input;
    const resourceType = state.extra_info.terraform_resource_type;
    const specifications = state.extra_info.terraform_specifications;

    // Format prompt with current state
    const formattedPrompt = TERRAFORM_GENERATOR_PROMPT.replace(
      /\{cloudProvider\}/g,
      csp.toLocaleUpperCase(),
    );

    const messagesPayload = [
      new SystemMessage(formattedPrompt),
      ...state.messages,
    ];

    const tools = [generateTerraformTool];
    const agent = createReactAgent({
      llm: OllamaLLM,
      tools: tools,
      prompt: formattedPrompt,
      responseFormat: terraformResponse,
    });

    const agentStart = Date.now();
    const response = await agent.invoke(
      {
        messages: getChatHistoryFromMessages(messagesPayload),
      },
      {
        configurable: {
          csp: csp,
          userid: userid,
          userInput: userInput,
          resourceType: resourceType,
          specifications: specifications,
        },
        recursionLimit: 15,
      },
    );
    const agentEnd = Date.now();
    console.log(`⏱️ Agent total time: ${agentEnd - agentStart}ms`);

    // Collect all tool messages
    const tools_response: ToolMessage[] = [];
    for (const message of response?.messages) {
      if (message.getType() === 'tool') {
        tools_response.push(message as ToolMessage);
      }
    }

    // Process tool responses to extract terraform files
    const terraformFiles = processToolResponses(tools_response);

    // Check if this is a handoff from provision agent (when service wasn't available)
    const isHandoffFromProvision = state.extra_info.terraform_resource_type && state.extra_info.terraform_specifications;

    // Extract response content
    const responseMessage = terraformFiles
      ? isHandoffFromProvision 
        ? `Since the requested service is not available in our service catalog, I've generated Terraform code for you instead. The service will be ready to deploy in 72 hours.`
        : 'Terraform code has been successfully generated and will be ready to deploy in 72 hours.'
      : 'Terraform code generation failed. Please try again.';

    // Create AI message with appropriate details
    const aiMessage = new AIMessage(responseMessage, {
      agent: 'terraform_generator_agent',
      details: {
        terraform_files: terraformFiles,
      },
    });

    // Return updated state
    return {
      messages: [aiMessage],
      extra_info: {
        ...state.extra_info,
        active_agent: 'terraform_generator_agent',
      },
    };
  } catch (error) {
    console.error('Error in TerraformGeneratorAgent:', error);
    return {
      messages: [
        new AIMessage(
          'I encountered an error while generating Terraform code. Please try again.',
        ),
      ],
    };
  }
};

// Process tool responses to extract terraform files
const processToolResponses = (
  messages: ToolMessage[],
): TerraformFiles | null => {
  let terraformFiles: TerraformFiles | null = null;

  for (const message of messages) {
    try {
      if (message.name === 'generate_terraform') {
        try {
          const content = JSON.parse(message.content as string);

          // Extract terraform files from the tool response
          if (
            content.main_tf &&
            content.variables_tf &&
            content.outputs_tf &&
            content.terraform_tfvars_json
          ) {
            terraformFiles = {
              'main.tf': content.main_tf,
              'variables.tf': content.variables_tf,
              'outputs.tf': content.outputs_tf,
              'terraform.tfvars.json': content.terraform_tfvars_json,
            };
          }
        } catch (error) {
          console.error('Inside Terraform agent process:', error);
          console.log('Agent', message.content);
        }
      }
    } catch (error) {
      console.error('Error processing tool message:', error);
    }
  }

  return terraformFiles;
};
