import React, { useState, useEffect, useRef } from 'react';
import useChat from '../../hooks/useChat';
import { io as createSocket } from 'socket.io-client';
import './Chat.css'

export default function Chat({ cityId }) {
  const { sessionId, messages, startSession, sendMessage, endSession, pushMessage } = useChat({ cityId });
  const [input, setInput] = useState('');
  const [isBotTyping, setIsBotTyping] = useState(false);
  const messagesRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, isBotTyping]);

  const initSocket = (resolvedSessionId) => {
    try {
      const backendUrl = import.meta.env.VITE_APP_API_URL || 'http://localhost:5000';
      if (!socketRef.current) {
        socketRef.current = createSocket(backendUrl);
        socketRef.current.on('connect', () => {
          socketRef.current.emit('join', resolvedSessionId);
        });
        socketRef.current.on('message', (msg) => {
          pushMessage(msg);
        });
      } else {
        socketRef.current.emit('join', resolvedSessionId);
      }
    } catch (err) {
      console.warn('Socket.io client not connected:', err.message || err);
    }
  };

  const handleStart = async () => {
    try {
      const session = await startSession();
      initSocket(session.sessionId);
    } catch (err) {
      console.error(err);
      alert('Failed to start chat session');
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    try {
      if (!sessionId) {
        await handleStart();
        await new Promise((r) => setTimeout(r, 150));
      }
      setIsBotTyping(true);
      await sendMessage({ message: input.trim(), sender: 'user' });
      setInput('');
    } catch (err) {
      console.error(err);
      alert('Failed to send message');
    } finally {
      setIsBotTyping(false);
    }
  };

  return (
    <div className="chat-widget">
      <div className="chat-actions">
        <button className="chat-btn chat-btn--start" onClick={handleStart}>
          {sessionId ? 'Pause' : 'Start Chat'}
        </button>
        {sessionId && (
          <button className="chat-btn chat-btn--end" onClick={endSession}>End</button>
        )}
      </div>

      <div ref={messagesRef} className="chat-messages">
        {messages.length === 0 && !isBotTyping && (
          <div className="chat-empty">No messages yet. Start the conversation.</div>
        )}

        {messages.map((m) => (
          <div
            key={m._id}
            className={`chat-message-row chat-message-row--${m.sender === 'bot' ? 'bot' : 'user'}`}
          >
            {m.sender === 'bot' && <div className="chat-avatar">🤖</div>}
            <div className="chat-bubble-wrap">
              <div className={`chat-bubble chat-bubble--${m.sender === 'bot' ? 'bot' : 'user'}`}>
                {m.content}
              </div>
              <div className="chat-timestamp">
                {new Date(m.createdAt).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {isBotTyping && (
          <div className="chat-message-row chat-message-row--bot">
            <div className="chat-avatar">🤖</div>
            <div className="chat-bubble-wrap">
              <div className="chat-bubble chat-bubble--bot chat-bubble--typing">
                <span className="chat-dot" />
                <span className="chat-dot" />
                <span className="chat-dot" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="chat-input-row">
        <input
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={isBotTyping}
          placeholder={isBotTyping ? 'Waiting for reply...' : 'Type a message...'}
        />
        <button className="chat-btn chat-btn--send" onClick={handleSend} disabled={isBotTyping}>
          ➤
        </button>
      </div>
    </div>
  );
}
