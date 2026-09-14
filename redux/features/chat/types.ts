export interface ChatState {
  unreadCount: number;
  activeChatKey: string | null; // e.g. "parent_5" or "admin_1"
  lastReceivedMessage: any | null;
  isLoading: boolean;
  error: string | null;
}
