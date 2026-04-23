import { MessageCircle } from "lucide-react";

export function FloatingChatButton() {
  return (
    <a className="floating-chat-button" href="https://wa.me/27797075710" target="_blank" rel="noreferrer" aria-label="Chat now on WhatsApp">
      <MessageCircle size={22} />
      Chat now
    </a>
  );
}
