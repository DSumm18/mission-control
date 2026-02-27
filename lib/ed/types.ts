/** Ed Chat types */

export interface EdConversation {
  id: string;
  title: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EdMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  actions_taken: EdActionResult[];
  metadata: Record<string, unknown>;
  model_used: string | null;
  tokens_used: number | null;
  duration_ms: number | null;
  created_at: string;
}

export interface EdAction {
  type: string;
  params: Record<string, unknown>;
}

export interface EdActionResult {
  type: string;
  ok: boolean;
  id?: string;
  job_id?: string;
  task_id?: string;
  error?: string;
}

/** SSE stream chunk sent to the client */
export type EdStreamChunk =
  | { type: 'text'; content: string }
  | { type: 'action'; action: EdActionResult }
  | { type: 'done'; message_id: string; duration_ms: number }
  | { type: 'error'; error: string };

export interface EdChatRequest {
  conversation_id: string;
  message: string;
  images?: EdImageAttachment[];
}

export interface EdImageAttachment {
  base64: string;
  mimeType: string;
  name?: string;
}
