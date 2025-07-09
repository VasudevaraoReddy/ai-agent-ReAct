import { BaseMessage } from '@langchain/core/messages';
import {
  StateGraph,
  MessagesAnnotation,
  Command,
  Messages,
  Annotation,
} from '@langchain/langgraph';
import { ProvisionAgent } from 'src/agents/provision/provision.agent';
import { RecommendationAgent } from 'src/agents/recommendations/recommendations.agent';
import { GeneralAgent } from 'src/agents/general/general.agent';
import { SupervisorAgent } from 'src/agents/supervisor/supervisor.agent';
import { TerraformGeneratorAgent } from 'src/agents/terraform-generator/terraform-generator.agent';
import { FinopsAgent } from 'src/agents/finops/finops.agent';

type extra_info = {
  user_input: string;
  userId?: string;
  csp?: string;
  active_agent?: string;
  // user selected agent
  user_selected_active_agent?: string;

  // provision agent
  service_form_data: any;
  service_config_available?: boolean;
  service_config?: any;

  // terraform generator
  terraform_resource_type?: string;
  terraform_specifications?: string;
};
export const CloudGraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    default: () => [],
    reducer: (x, y) => x.concat(y),
  }),
  extra_info: Annotation<extra_info>({
    default: () => ({
      user_input: '',
      formData: {},
      userId: '',
      csp: '',
      active_agent: '',
      service_form_data: {},
      service_config_available: false,
      service_config: null,
      user_selected_active_agent: '',
    }),
    reducer: (x, y) => ({
      ...x,
      ...y,
    }),
  }),
});

export const CloudWorkFlow = new StateGraph(CloudGraphState)
  .addNode('supervisor', SupervisorAgent, {
    ends: [
      'provision_agent',
      'recommendation_agent',
      'general_agent',
      'terraform_generator_agent',
      'finops_agent'
    ],
  })
  .addNode('provision_agent', ProvisionAgent)
  .addNode('recommendation_agent', RecommendationAgent)
  .addNode('general_agent', GeneralAgent)
  .addNode('terraform_generator_agent', TerraformGeneratorAgent)
  .addNode('finops_agent', FinopsAgent)
  .addEdge('__start__', 'supervisor')
  .addEdge('provision_agent', '__end__')
  .addEdge('recommendation_agent', '__end__')
  .addEdge('general_agent', '__end__')
  .addEdge('terraform_generator_agent', '__end__')
  .addEdge('finops_agent', '__end__')
  .compile();
