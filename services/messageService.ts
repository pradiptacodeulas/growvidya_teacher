import { apiFetch } from './apiClient';

export interface Contact {
  id: number;
  name: string;
  role: string;
  picture: string | null;
  email: string | null;
  phone: string | null;
  code?: string | null;
  class_name?: string | null;
  section_name?: string | null;
  designation?: string | null;
  last_message?: string | null;
  last_message_time?: string | null;
  last_message_seen?: number | null;
  last_message_is_outgoing?: boolean;
  unread_count?: number;
  unread?: number;
  is_online?: boolean;
}

export interface ChatMessage {
  id: number | string;
  school_id?: number;
  sender: number;
  sender_role: string;
  reciver: number;
  receiver_role: string;
  type?: number;
  message: string;
  file?: string | null;
  file_type?: string | null;
  time?: string;
  created_at?: string;
  seen?: number;
  status?: number;
  sending?: boolean;
}

export const messageService = {
  /**
   * Get list of permitted contacts for the teacher
   */
  async getContacts(): Promise<{ success: boolean; data: Contact[]; message?: string }> {
    const res = await apiFetch('/messages/contacts', { method: 'GET' });
    return {
      success: res.success,
      data: Array.isArray(res.data) ? res.data : [],
      message: res.message,
    };
  },

  /**
   * Get total unread message count for badge
   */
  async getUnreadCount(): Promise<number> {
    try {
      const res = await apiFetch('/messages/unread-count', { method: 'GET' });
      if (res.success && res.data) {
        return Number(res.data.unreadCount || res.data.count || 0);
      }
      return 0;
    } catch {
      return 0;
    }
  },

  /**
   * Get conversation history with a specific contact
   */
  async getConversation(
    contactRole: string,
    contactId: number | string,
    limit = 50,
    offset = 0
  ): Promise<{
    success: boolean;
    messages: ChatMessage[];
    total: number;
    hasMore: boolean;
    contact?: { id: number; role: string; is_online: boolean };
  }> {
    const role = String(contactRole).toLowerCase();
    const id = Number(contactId);
    const res = await apiFetch(
      `/messages/conversation/${role}/${id}?limit=${limit}&offset=${offset}`,
      { method: 'GET' }
    );

    if (res.success && res.data) {
      return {
        success: true,
        messages: Array.isArray(res.data.messages) ? res.data.messages : [],
        total: Number(res.data.total || 0),
        hasMore: Boolean(res.data.hasMore),
        contact: res.data.contact,
      };
    }

    return {
      success: false,
      messages: [],
      total: 0,
      hasMore: false,
    };
  },

  /**
   * Send a message via REST fallback
   */
  async sendMessage(payload: {
    receiverId: number | string;
    receiverRole: string;
    message?: string;
    file?: string | null;
    fileType?: string | null;
  }): Promise<{ success: boolean; data?: ChatMessage; error?: string }> {
    const res = await apiFetch('/messages/send', {
      method: 'POST',
      body: JSON.stringify({
        receiverId: Number(payload.receiverId),
        receiverRole: String(payload.receiverRole).toLowerCase(),
        message: payload.message || '',
        file: payload.file || null,
        fileType: payload.fileType || null,
      }),
    });

    return {
      success: res.success,
      data: res.data,
      error: res.error || res.message,
    };
  },

  /**
   * Mark messages as read from a sender
   */
  async markAsRead(senderId: number | string, senderRole: string): Promise<boolean> {
    try {
      const res = await apiFetch('/messages/read', {
        method: 'POST',
        body: JSON.stringify({
          senderId: Number(senderId),
          senderRole: String(senderRole).toLowerCase(),
        }),
      });
      return res.success;
    } catch {
      return false;
    }
  },

  /**
   * Upload chat attachment
   */
  async uploadAttachment(formData: FormData): Promise<{
    success: boolean;
    fileUrl?: string;
    filePath?: string;
    fileName?: string;
    fileType?: string;
    data?: any;
    error?: string;
  }> {
    try {
      const res = await apiFetch('/messages/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.success && res.data) {
        const filePath = res.data.file_path || res.data.path || res.data.file || res.data.url;
        const fileUrl = res.data.url || filePath;
        return {
          success: true,
          filePath,
          fileUrl,
          fileName: res.data.file_name,
          fileType: res.data.mimetype,
          data: res.data,
        };
      }
      return { success: false, error: res.message || 'Failed to upload attachment' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Upload error' };
    }
  },

  /**
   * Delete a message
   */
  async deleteMessage(messageId: number | string): Promise<boolean> {
    try {
      const res = await apiFetch(`/messages/${messageId}`, {
        method: 'DELETE',
      });
      return res.success;
    } catch {
      return false;
    }
  },
};

export default messageService;
