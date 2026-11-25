// Chat API types — threaded conversation schema

/** Conversation from Chat API */
export interface Conversation {
  conversationId: string;
  title: string;
  pinned: boolean;
  user: string;
  endpoint: string;
  model?: string;
  agentId?: string;
  createdAt: string;
  updatedAt: string;
}

/** Paginated conversation list response */
export interface ConversationListResponse {
  conversations: Conversation[];
  pageNumber: number;
  pageSize: number;
  pages: number;
}

/** File attachment metadata for display */
export interface MessageAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  previewUrl?: string; // local blob URL or /api/files/{id}
}

/** Chat message from Chat API */
export interface TMessage {
  messageId: string;
  parentMessageId: string;
  conversationId: string;
  sender: string;
  text: string;
  isCreatedByUser: boolean;
  error: boolean;
  unfinished?: boolean;
  endpoint?: string;
  model?: string;
  stepsJson?: string;
  content?: TContentPart[];
  attachments?: MessageAttachment[];
  feedback?: string;
  feedbackNote?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Content parts for multi-modal messages */
export interface TContentPart {
  type: string;
  text?: string;
  tool_call_id?: string;
  [key: string]: unknown;
}

/** Messages list response */
export interface MessageListResponse {
  messages: TMessage[];
  nextCursor?: string | null;
}

/** Payload for sending a message via SSE */
export interface SendMessagePayload {
  text: string;
  conversationId: string | null;
  parentMessageId: string | null;
  endpoint: string;
  agentId?: string;
  model?: string;
  isContinued?: boolean;
}

/** Agent from portal-service */
export interface Agent {
  id: string;
  name: string;
  description: string | null;
  systemPrompt: string | null;
  modelId: string | null;
  creatorId: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

/** SSE event data types */
export interface SSEMessageEvent {
  /** Partial text chunk */
  text?: string;
  /** Entire message so far */
  message?: TMessage;
  /** Final message when streaming completes */
  final?: boolean;
  /** Sync event for reconnection */
  sync?: boolean;
  /** Error event */
  error?: string;
  /** Stream ID for reconnection */
  streamId?: string;
  /** Conversation ID from server */
  conversationId?: string;
  /** Message ID from server */
  messageId?: string;
  /** Response message ID */
  responseMessageId?: string;
  /** User message saved by server */
  userMessage?: TMessage;
  /** Initial event with metadata */
  initial?: boolean;
}

/** Delete conversation request body */
export interface DeleteConversationPayload {
  arg: {
    conversationId: string;
    source?: string;
  };
}

/** Update conversation title request body */
export interface UpdateConversationPayload {
  arg: {
    conversationId: string;
    title: string;
  };
}
