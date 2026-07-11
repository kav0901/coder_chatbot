import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, provider } from './firebase';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

console.log("🚨 REACT THINKS THE URL IS:", API_BASE_URL);

function App() {
  const [user, setUser] = useState(null);

  // Chat State
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [image, setImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const [conversations, setConversations] = useState([]);
  const [activeConvoId, setActiveConvoId] = useState(null);

  // Edit State
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        fetchConversations(currentUser.uid);
      } else {
        setUser(null);
        setConversations([]);
        setMessages([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Auto-Scroll Hook
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchConversations = async (userId) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/conversations/${userId}`);
      if (res.data.length > 0) {
        setConversations(res.data);
        loadMessages(res.data[0].conversation_id);
      } else {
        handleNewChat(userId);
      }
    } catch (error) {
      console.error("Failed to load conversations", error);
    }
  };

  const handleNewChat = async (customUserId = null) => {
    const targetUserId = customUserId || user.uid;
    const formData = new FormData();
    formData.append('user_id', targetUserId);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/conversations`, formData);
      setConversations((prev) => [res.data, ...prev]);
      setActiveConvoId(res.data.conversation_id);
      setMessages([]);
    } catch (error) {
      console.error("Failed to create chat", error);
    }
  };

  const loadMessages = async (convoId) => {
    setActiveConvoId(convoId);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/messages/${convoId}`);
      setMessages(res.data);
    } catch (error) {
      console.error("Failed to load messages", error);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!input.trim() && !image) || !activeConvoId) return;

    setIsLoading(true);
    const userMessage = { sender: 'user', content: input, image: image ? URL.createObjectURL(image) : null };
    setMessages((prev) => [...prev, userMessage]);

    const formData = new FormData();
    formData.append('user_id', user.uid);
    formData.append('conversation_id', activeConvoId);
    formData.append('message', input);
    if (image) formData.append('image', image);

    // Clear inputs immediately for better UX
    setInput('');
    setImage(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/chat`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // console.log("🚨 RAW DATA FROM PYTHON:", response.data.response);
      setMessages((prev) => [...prev, { sender: 'ai', content: response.data.response }]);
    } catch (error) {
      setMessages((prev) => [...prev, { sender: 'ai', content: "❌ Error connecting to server." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteChat = async (e, convoId) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this chat?")) return;

    try {
      await axios.delete(`${API_BASE_URL}/api/conversations/${convoId}`);
      const updatedConvos = conversations.filter(c => c.conversation_id !== convoId);
      setConversations(updatedConvos);

      if (activeConvoId === convoId) {
        if (updatedConvos.length > 0) {
          loadMessages(updatedConvos[0].conversation_id);
        } else {
          setActiveConvoId(null);
          setMessages([]);
        }
      }
    } catch (error) {
      console.error("Failed to delete chat", error);
    }
  };

  const handleRenameClick = (e, convo) => {
    e.stopPropagation();
    setEditingId(convo.conversation_id);
    setEditTitle(convo.title);
  };

  const handleRenameSubmit = async (e, convoId) => {
    e.preventDefault();
    if (!editTitle.trim()) return;

    try {
      const formData = new FormData();
      formData.append('title', editTitle);
      await axios.put(`${API_BASE_URL}/api/conversations/${convoId}`, formData);
      setConversations(conversations.map(c =>
        c.conversation_id === convoId ? { ...c, title: editTitle } : c
      ));
      setEditingId(null);
    } catch (error) {
      console.error("Failed to rename chat", error);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in with Google", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  if (!user) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h2>Welcome to AI Coder</h2>
          <p>Securely sign in to access your workspace.</p>
          <button onClick={handleLogin} className="google-btn">
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="user-badge">👤 {user.displayName || 'Developer'}</div>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </div>
        <button className="new-chat-btn" onClick={() => handleNewChat()}>+ New Chat</button>

        <div className="conversation-list">
          {conversations.map((convo) => (
            <div
              key={convo.conversation_id}
              className={`convo-item ${activeConvoId === convo.conversation_id ? 'active' : ''}`}
              onClick={() => loadMessages(convo.conversation_id)}
            >
              {editingId === convo.conversation_id ? (
                <form onSubmit={(e) => handleRenameSubmit(e, convo.conversation_id)} className="rename-form">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => handleRenameSubmit(e, convo.conversation_id)}
                  />
                </form>
              ) : (
                <>
                  <span className="convo-title">💬 {convo.title}</span>
                  <div className="convo-actions">
                    <button className="icon-btn" onClick={(e) => handleRenameClick(e, convo)}>✏️</button>
                    <button className="icon-btn" onClick={(e) => handleDeleteChat(e, convo.conversation_id)}>🗑️</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </aside>

      <main className="main-chat">
        <header>
          <h1>AI Coding Assistant</h1>
        </header>
        
        <div className="chat-window">
          {messages.length === 0 ? (
            <div className="empty-state">Start a new conversation...</div>
          ) : (
            messages.map((msg, index) => (
              <div key={index} className={`message-bubble ${msg.sender}`}>
                {msg.image && <img src={msg.image} alt="uploaded" className="image-preview" />}
                
                {/* Markdown Renderer */}
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  children={msg.content}
                  components={{
                    p({ node, children, ...props }) {
                      return <div style={{ marginBottom: '10px' }} {...props}>{children}</div>;
                    },
                    code({ node, inline, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || "");
                      const codeString = String(children).replace(/\n$/, "");
                      const isBlock = !inline || codeString.includes('\n');

                      if (isBlock) {
                        return (
                          <SyntaxHighlighter
                            {...props}
                            children={codeString}
                            style={vscDarkPlus}
                            language={match ? match[1] : "python"}
                            PreTag="div"
                            wrapLongLines={true}
                            customStyle={{
                              margin: "10px 0",
                              borderRadius: "6px",
                              padding: "12px",
                            }}
                            codeTagProps={{
                              style: {
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                                display: "block"
                              }
                            }}
                          />
                        );
                      }

                      return (
                        <code className="inline-code" {...props}>
                          {children}
                        </code>
                      );
                    }
                  }}
                />
              </div>
            ))
          )}
          
          {isLoading && <div className="loading">AI is typing...</div>}
          
          {/* THE MISSING PIECE: The Auto-Scroll Anchor */}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} className="input-area">
          <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files[0])} className="file-input" />
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a coding question..." className="text-input" />
          <button type="submit" disabled={isLoading || !activeConvoId} className="send-btn">Send</button>
        </form>
      </main>
    </div>
  );
}

export default App;