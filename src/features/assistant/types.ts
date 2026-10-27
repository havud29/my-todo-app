// Something Claude changed in the app while answering
export interface AssistantAction {
  kind: 'task' | 'event' | 'note' | 'transaction' | 'budget' | 'milestone'
  verb: 'added' | 'updated' | 'deleted'
  title: string
}

export interface AssistantReply {
  reply: string
  actions: AssistantAction[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  actions?: AssistantAction[]
  error?: boolean
}
