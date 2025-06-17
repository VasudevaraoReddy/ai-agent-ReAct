import { ChatPromptTemplate } from '@langchain/core/prompts';
import { BaseMessage } from '@langchain/core/messages';


// export const getPromptFromMessages = (messages: BaseMessage[]) => {
//   return ChatPromptTemplate.fromMessages([
//     ['system', messages[0].content],
//     ['placeholder', '{chat_history}'],
//     ['user', messages[messages.length - 1].content],
//     ['placeholder',"{agent_scratchpad}"]
//   ]);

// };

export const getChatHistoryFromMessages = (messages: BaseMessage[]) => {
  const chatHistory: any[] = [];
  messages.forEach((message) => {
    if (message.getType() === 'human') {
      chatHistory.push({
        role: 'user',
        content: message.content,
      });
    } else if (message.getType() === 'ai') {
      chatHistory.push({
        role: 'assistant',
        content: message.content,
      });
    }
  });
  return chatHistory;
};
