import { useState } from "react";
import { Message } from "../types";

export const useChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);

  return {
    messages,
    setMessages,
  };
};

