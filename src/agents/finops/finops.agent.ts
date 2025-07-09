import { CloudGraphState } from 'src/workflows/cloud.workflow';
import { AIMessage, SystemMessage } from '@langchain/core/messages';
import axios from 'axios';

export const FinopsAgent = async (
  state: typeof CloudGraphState.State,
): Promise<Partial<typeof CloudGraphState.State>> => {
  try {
    const response = await axios.post('http://localhost:3002/chat', {
      session_id: state.extra_info.userId,
      message: state.extra_info.user_input,
    });
    const aiMessage = new AIMessage(response?.data?.response, {
      agent: 'finops_agent',
      details: response?.data,
    });

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
