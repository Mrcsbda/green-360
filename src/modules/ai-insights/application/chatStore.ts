import { create } from 'zustand';
import type { EmailAutomationDraft, InsightAnswer } from '../domain/insights';

export interface ChatMessageEntry {
  id: number;
  pregunta: string;
  respuesta?: InsightAnswer;
  error?: string;
  createdAt: string;
}

interface ChatStore {
  messages: ChatMessageEntry[];
  draftInput: string;
  setDraftInput: (t: string) => void;
  /** Pre-carga una instrucción desde el Dashboard para ejecutar o editar en el Chat. */
  queuePrompt: (prompt: string) => void;
  addUserMessage: (id: number, pregunta: string) => void;
  resolveMessage: (id: number, respuesta: InsightAnswer) => void;
  failMessage: (id: number, error: string) => void;
  updateAutomation: (msgId: number, patch: Partial<EmailAutomationDraft>) => void;
  clearConversation: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  draftInput: '',

  setDraftInput: (draftInput) => set({ draftInput }),

  queuePrompt: (prompt) => set({ draftInput: prompt }),

  addUserMessage: (id, pregunta) =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id,
          pregunta,
          createdAt: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
        },
      ],
    })),

  resolveMessage: (id, respuesta) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, respuesta } : m)),
    })),

  failMessage: (id, error) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, error } : m)),
    })),

  updateAutomation: (msgId, patch) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === msgId && m.respuesta?.automation
          ? {
              ...m,
              respuesta: {
                ...m.respuesta,
                automation: { ...m.respuesta.automation, ...patch },
              },
            }
          : m,
      ),
    })),

  clearConversation: () => set({ messages: [], draftInput: '' }),
}));
