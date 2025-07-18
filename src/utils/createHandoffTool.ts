import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  Command,
  getCurrentTaskInput,
  MessagesAnnotation,
} from '@langchain/langgraph';
import { BaseMessage, ToolMessage } from '@langchain/core/messages';

/**
 * Creates a handoff tool for transferring control between agents
 */
interface CreateHandoffToolParams {
  agentName: string;
  description?: string;
}

export const createHandoffTool = ({
  agentName,
  description,
}: CreateHandoffToolParams) => {
  const toolName = `transfer_to_${agentName}`;
  const toolDescription = description || `Ask agent '${agentName}' for help`;

  const handoffTool = tool(
    async (_, config) => {
      const toolMessage = new ToolMessage({
        content: `Successfully transferred to ${agentName}`,
        name: toolName,
        tool_call_id: config.toolCall.id,
      });
      return {
        goto: agentName,
        toolMessage: toolMessage,
      };
    },
    {
      name: toolName,
      schema: z.object({}),
      description: toolDescription,
    },
  );

  return handoffTool;
};

export const transferToRecommendationsAgent = createHandoffTool({
  agentName: 'recommendation_agent',
  description:
    'Transfer user to recommendations agent when they need specific Azure service recommendations, best practices, or optimization suggestions for their Azure resources.',
});

export const transferToProvisionAgent = createHandoffTool({
  agentName: 'provision_agent',
  description:
    'Transfer user to provision agent when they want to deploy, create, provision, or set up cloud resources or infrastructure services.',
});

export const transferToFinopsAgent = createHandoffTool({
  agentName: 'finops_agent',
  description:
    'Transfer user to finops agent when they ask about cloud cost optimization, budgeting, cost analysis, resource right-sizing, or financial aspects of cloud management.',
});

export const transferToGeneralAgent = createHandoffTool({
  agentName: 'general_agent',
  description:
    'Transfer user to general agent when they have general cloud computing questions about concepts, providers, technologies, or best practices.',
});

export const transferToTerraformGeneratorAgent = createHandoffTool({
  agentName: 'terraform_generator_agent',
  description:
    'Transfer user to terraform generator agent when they want to generate Terraform code for infrastructure as code deployments or want to create IaC templates.',
});

const handOffToAgent = async (toolMessage: ToolMessage) => {
  const toolContent = toolMessage.content;
  const parsedToolContent = JSON.parse(toolContent.toString());
  const goToAgent = parsedToolContent.goto;
  const state = getCurrentTaskInput() as (typeof MessagesAnnotation)['State'];
  return new Command({
    goto: goToAgent,
    update: { messages: state.messages.concat(toolMessage) },
  });
};

// method to find tool call with name containing transfer_to_ and transfering else just pass
export const CheckHandOffToolFromMessages = async (
  messages: BaseMessage[],
  from: string,
): Promise<any> => {
  const toolMessage = messages.find(
    (message) =>
      message.getType() === 'tool' &&
      message.name?.includes('transfer_to_') &&
      !message.name?.includes(from as string),
  );
  console.log('ToolMessage:', toolMessage);
  if (toolMessage) {
    return await handOffToAgent(toolMessage as ToolMessage);
  }
  return null;
};
