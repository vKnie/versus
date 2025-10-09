'use client';

import { useRef, useEffect } from 'react';
import Avatar from '@/components/Avatar';
import { Send, MessageSquare } from 'lucide-react';
import { Message } from '@/types';

interface ChatSectionProps {
  messages: Message[];
  newMessage: string;
  setNewMessage: (value: string) => void;
  onSendMessage: (e: React.FormEvent) => void;
  sending: boolean;
  canSendMessage: boolean;
  cooldownTime: number;
  currentUsername?: string;
}

export default function ChatSection({
  messages,
  newMessage,
  setNewMessage,
  onSendMessage,
  sending,
  canSendMessage,
  cooldownTime,
  currentUsername,
}: ChatSectionProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll vers le bas quand de nouveaux messages arrivent
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/60 rounded-xl shadow-xl flex flex-col h-[400px] lg:col-span-2">
      {/* En-tête du chat */}
      <div className="p-4 border-b border-zinc-800/60">
        <h3 className="font-semibold text-zinc-200 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-400" />
          Chat en direct
        </h3>
      </div>

      {/* Zone des messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-zinc-500 text-sm">Aucun message...</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`flex gap-2 ${
              message.username === currentUsername ? 'justify-end' : 'justify-start'
            }`}>
              {message.username !== currentUsername && (
                <Avatar src={message.profile_picture_url} name={message.username} size="sm" />
              )}
              <div className="max-w-[80%]">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`font-medium text-xs ${
                    message.username === currentUsername
                      ? 'text-blue-400'
                      : 'text-emerald-400'
                  }`}>
                    {message.username}
                  </span>
                  <span className="text-zinc-500 text-xs">
                    {new Date(message.created_at).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                <div className={`px-3 py-2 rounded-lg text-sm break-words ${
                  message.username === currentUsername
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-800 text-zinc-200'
                }`}>
                  {message.message}
                </div>
              </div>
              {message.username === currentUsername && (
                <Avatar src={message.profile_picture_url} name={message.username} size="sm" />
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Zone de saisie */}
      <div className="p-4 border-t border-zinc-800/60">
        <form onSubmit={onSendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={!canSendMessage ? `Attendez ${cooldownTime}s...` : "Tapez votre message..."}
            className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-600 focus:border-zinc-600 text-sm transition-all"
            style={{ outline: 'none' }}
            maxLength={500}
            disabled={sending || !canSendMessage}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending || !canSendMessage}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors text-sm cursor-pointer flex items-center gap-2"
          >
            {!canSendMessage ? `${cooldownTime}s` : sending ? 'Envoi...' : (
              <>
                <Send className="w-4 h-4" />
                Envoyer
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
