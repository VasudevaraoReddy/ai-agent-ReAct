import * as fs from 'fs';
import * as path from 'path';

const CONVERSATIONS_DIR = path.join(process.cwd(), 'temp_conversations');

// Ensure conversations directory exists
if (!fs.existsSync(CONVERSATIONS_DIR)) {
  fs.mkdirSync(CONVERSATIONS_DIR, { recursive: true });
}

interface Conversation {
  messages: FormattedLangchainMessage[];
  extra_info: any;
}

interface UserConversations {
  [conversationId: string]: Conversation;
}

export const getConversationHistory = (userId: string, conversationId: string): Conversation => {
  const userFile = path.join(CONVERSATIONS_DIR, `${userId}.json`);

  if (!fs.existsSync(userFile)) {
    return {
      messages: [],
      extra_info: {}
    };
  }

  try {
    const data = fs.readFileSync(userFile, 'utf-8');
    const userConversations: UserConversations = JSON.parse(data||'{}');
    return userConversations[conversationId];
  } catch (error) {
    console.error('Error reading conversation history:', error);
    return {
      messages: [],
      extra_info: {}
    };
  }
};

export const saveConversationHistory = (
  userId: string,
  conversationId: string,
  messages: FormattedLangchainMessage[],
  extra_info: any
): void => {
  const userFile = path.join(CONVERSATIONS_DIR, `${userId}.json`);
  let userConversations: UserConversations = {};

  // Read existing conversations if file exists
  if (fs.existsSync(userFile)) {
    try {
      const data = fs.readFileSync(userFile, 'utf-8');
      userConversations = JSON.parse(data||'{}');
    } catch (error) {
      console.error('Error reading existing conversations:', error);
    }
  }

  // Update or create the conversation
  userConversations[conversationId] = {
    messages,
    extra_info
  };

  try {
    fs.writeFileSync(userFile, JSON.stringify(userConversations, null, 2));
  } catch (error) {
    console.error('Error saving conversation history:', error);
  }
}; 