import {  HumanMessage } from '@langchain/core/messages';
import { Injectable } from '@nestjs/common';
import { CloudWorkFlow, CloudGraphState } from 'src/workflows/cloud.workflow';
import { formatLangchainMessages, formatLangchainMessagesToBaseMessage } from 'src/utils/formatLangchainMessages';
import { getConversationHistory, saveConversationHistory, listAllConversations } from './utils/conversationStorage';

@Injectable()
export class AppService {

  async runWorkflow(data:{
    user_input: string,
    conversation_id: string,
    formData:any,
    userId:string,
    csp:string
  }) {
    // Get previous conversation history from file
    const userConversation = getConversationHistory(data.userId, data.conversation_id);
    const userConversationMessages = userConversation?.messages || [];
    const formattedLangchainMessagesToBaseMessages = formatLangchainMessagesToBaseMessage(userConversationMessages);
    const workflowPayload:typeof CloudGraphState.State = {
      messages: [...formattedLangchainMessagesToBaseMessages, new HumanMessage(data?.user_input)],
      extra_info: {
        user_input: data?.user_input,
        userId: data?.userId,
        csp: data?.csp,
        service_form_data:data?.formData || {}, 
        service_config_available:userConversation?.extra_info?.service_config_available,
        service_config:userConversation?.extra_info?.serviceConfig
      },
    };
    const response = await CloudWorkFlow.invoke(workflowPayload);
    
    const formattedResponse = formatLangchainMessages(response.messages);
    // Save the updated conversation history to file with extra_info
    // just add last message only 
    const lastMessage = formattedResponse[formattedResponse.length-1];
    const userMessage= {
      type: 'human',
      content: data?.user_input,
      response_metadata: {}
    }
    const updatedMessages = [...userConversationMessages,userMessage,lastMessage];
    saveConversationHistory(
      data.userId,
      data.conversation_id,
      updatedMessages,
      response.extra_info
    );

    return {
      messages: updatedMessages,
      extra_info: response.extra_info
    };
  }

  async getConversation(userId: string, conversationId: string) {
    const userConversation = getConversationHistory(userId, conversationId);
    return {
      messages: userConversation?.messages,
      extra_info: userConversation?.extra_info
    };
  } 

  async listAllConversations() {
    return listAllConversations();
  }
}
