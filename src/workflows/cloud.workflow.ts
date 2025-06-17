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

type extra_info={
  user_input:string,
  formData:any,
  userId?:string,
  csp?:string,
  service_config_status?:boolean,
  active_agent?:string
}
export const CloudGraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    default: () => [],
    reducer: (x, y) => x.concat(y),
  }),
  extra_info: Annotation<extra_info>({
    default: () => ({
      user_input: '',
      formData:{},
      userId:'',
      csp:'',
      active_agent:'',
      service_config_status:false
    }),
    reducer: (x, y) => ({
      ...x,
      ...y,
    }),
  }),
});


export const CloudWorkFlow=new StateGraph(CloudGraphState)
.addNode("supervisor",SupervisorAgent,{
  ends:["provision_agent","recommendation_agent","general_agent"]
})
.addNode('provision_agent',ProvisionAgent)
.addNode('recommendation_agent',RecommendationAgent)
.addNode('general_agent',GeneralAgent)
.addEdge('__start__','supervisor')
.addEdge('provision_agent','__end__')
.addEdge('recommendation_agent','__end__')
.addEdge('general_agent','__end__')
.compile()
