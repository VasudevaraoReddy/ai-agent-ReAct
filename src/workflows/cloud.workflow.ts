import { BaseMessage } from '@langchain/core/messages';
import { StateGraph, Annotation, END } from '@langchain/langgraph';
import { ProvisionAgent } from 'src/agents/provision/provision.agent';
import { RecommendationsAgent } from 'src/agents/recommendations/recommendations.agent';
import { GeneralAgent } from 'src/agents/general/general.agent';
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

// Validation agent to navigate to active agent
export const defaultAgent = async (
  state: typeof CloudGraphState.State,
): Promise<string> => {
  if (
    state.extra_info.active_agent ||
    state.extra_info.user_selected_active_agent
  ) {
    return (
      state.extra_info.active_agent ||
      (state.extra_info.user_selected_active_agent as string)
    );
  } else {
    return 'general_agent' as string;
  }
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
  .addNode('provision_agent', ProvisionAgent, {
    ends: [
      'recommendation_agent',
      'general_agent',
      'terraform_generator_agent',
      'finops_agent',
      END,
    ],
  })
  .addNode('recommendation_agent', RecommendationsAgent, {
    ends: [
      'provision_agent',
      'general_agent',
      'terraform_generator_agent',
      'finops_agent',
      END,
    ],
  })
  .addNode('general_agent', GeneralAgent, {
    ends: [
      'provision_agent',
      'recommendation_agent',
      'terraform_generator_agent',
      'finops_agent',
      END,
    ],
  })
  .addNode('terraform_generator_agent', TerraformGeneratorAgent, {
    ends: [
      'provision_agent',
      'recommendation_agent',
      'general_agent',
      'finops_agent',
      END,
    ],
  })
  .addNode('finops_agent', FinopsAgent, {
    ends: [
      'provision_agent',
      'recommendation_agent',
      'general_agent',
      'terraform_generator_agent',
      END,
    ],
  })
  .addConditionalEdges('__start__', defaultAgent, {
    general_agent: 'general_agent',
    provision_agent: 'provision_agent',
    recommendation_agent: 'recommendation_agent',
    terraform_generator_agent: 'terraform_generator_agent',
    finops_agent: 'finops_agent',
  })
  .compile();
