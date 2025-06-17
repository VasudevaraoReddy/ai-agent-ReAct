import { AIMessage, BaseMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";

export const formatLangchainMessages = (messages: BaseMessage[]):FormattedLangchainMessage[] => {
  return messages.map((message) => {
    return {
      type: message.getType(),
      content: message.content as string,
      response_metadata: {
        ...message.additional_kwargs,
      } as any,
    };
  });
};

export const formatLangchainMessagesToBaseMessage = (messages: FormattedLangchainMessage[]):BaseMessage[] => {
  return messages &&  messages.map((message) => {
    switch (message.type) {
      case 'human':
        return new HumanMessage(message.content);
      case 'ai':
        return new AIMessage(message.content);
      default:
        return new HumanMessage(message.content);
    }
  }) || [];
};

const formatToolMessage = (messages: ToolMessage[]) => {
  return messages && messages.length > 0 && messages.map((message) => {
    return {
      type: message.getType(),
      content: JSON.parse(message?.content as string || '{}') ?? message.content,
      name: message.name,
    };
  });
};
