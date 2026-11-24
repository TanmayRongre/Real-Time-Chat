export interface User {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  isOnline: boolean;
  lastSeen: string;
  createdAt: string;
  conversationId?: string | null;
  lastMessage?: {
    id?: string;
    content: string;
    createdAt: string;
    sender: string;
  } | null;
  unreadCount?: number;
}

export interface Message {
  id: string;
  conversationId: string;
  sender: string;
  receiver: string;
  content: string;
  status: "sent" | "delivered" | "read";
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  participants: string[];
  lastMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  success?: boolean;
  token?: string;
  user?: User;
  message?: string;
  error?: string;
  isExistingUser?: boolean;
}
