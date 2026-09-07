import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import Login from './Login';
import './App.css';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'chats'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedChats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChats(loadedChats);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!currentChatId) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, 'messages'),
      where('chatId', '==', currentChatId),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedMessages = snapshot.docs.map(doc => doc.data());
      setMessages(loadedMessages);
    });

    return () => unsubscribe();
  }, [currentChatId]);

  async function sendMessage(e) {
    e.preventDefault();
    if (!input.trim()) return;

    let chatId = currentChatId;
    if (!chatId) {
      const docRef = await addDoc(collection(db, 'chats'), {
        userId: user.uid,
        title: input.slice(0, 40),
        createdAt: serverTimestamp()
      });
      chatId = docRef.id;
      setCurrentChatId(chatId);
    }

    const userText = input;
    setInput('');
    setLoading(true);

    await addDoc(collection(db, 'messages'), {
      text: userText,
      sender: 'user',
      userId: user.uid,
      chatId: chatId,
      timestamp: serverTimestamp()
    });

    try {
      const response = await fetch('http://localhost:3000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText })
      });
      const data = await response.json();

      await addDoc(collection(db, 'messages'), {
        text: data.reply,
        sender: 'bot',
        userId: user.uid,
        chatId: chatId,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      await addDoc(collection(db, 'messages'), {
        text: 'Error: could not reach server.',
        sender: 'bot',
        userId: user.uid,
        chatId: chatId,
        timestamp: serverTimestamp()
      });
    }

    setLoading(false);
  }

  async function createNewChat() {
    const docRef = await addDoc(collection(db, 'chats'), {
      userId: user.uid,
      title: 'New Chat',
      createdAt: serverTimestamp()
    });
    setCurrentChatId(docRef.id);
  }

  function selectChat(chatId) {
    setCurrentChatId(chatId);
  }

  async function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  let chatId = currentChatId;
  if (!chatId) {
    const docRef = await addDoc(collection(db, 'chats'), {
      userId: user.uid,
      title: file.name,
      createdAt: serverTimestamp()
    });
    chatId = docRef.id;
    setCurrentChatId(chatId);
  }

  setUploading(true);
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('http://localhost:3000/upload', {
      method: 'POST',
      body: formData
    });
    const data = await response.json();
    if (data.success) {
      await addDoc(collection(db, 'messages'), {
        text: `Document updated (${data.chunks} chunks). You can now ask questions about it.`,
        sender: 'bot',
        userId: user.uid,
        chatId: chatId,
        timestamp: serverTimestamp()
      });
    } else {
      await addDoc(collection(db, 'messages'), {
        text: `Upload failed: ${data.error}`,
        sender: 'bot',
        userId: user.uid,
        chatId: chatId,
        timestamp: serverTimestamp()
      });
    }
  } catch (err) {
    await addDoc(collection(db, 'messages'), {
      text: 'Upload error: could not reach server.',
      sender: 'bot',
      userId: user.uid,
      chatId: chatId,
      timestamp: serverTimestamp()
    });
  }
  setUploading(false);
}

  if (authLoading) return <div className="loading-screen">Loading...</div>;
  if (!user) return <Login />;

  return (
    <div className="app-shell">
      <div className="sidebar">
        <button className="new-chat-button" onClick={createNewChat}>+ New Chat</button>
        <div className="chat-list">
          {chats.map(chat => (
            <div
              key={chat.id}
              className={chat.id === currentChatId ? 'chat-item active' : 'chat-item'}
              onClick={() => selectChat(chat.id)}
            >
              {chat.title}
            </div>
          ))}
        </div>
        <button className="logout-button" onClick={() => signOut(auth)}>Log Out</button>
      </div>

      <div className="chat-container">
        <header className="chat-header">
          <div className="header-text">
            <h1>Paper Q&A Bot</h1>
            <p className="header-subtitle">Ask questions about your uploaded document</p>
          </div>
          <label htmlFor="file-upload" className="upload-button">
            {uploading ? 'Uploading...' : '📄 Upload'}
          </label>
          <input
            id="file-upload"
            type="file"
            accept=".txt"
            onChange={handleFileUpload}
            disabled={uploading}
            style={{ display: 'none' }}
          />
        </header>

        <div className="messages">
          {messages.length === 0 && (
            <div className="empty-state">Start typing to begin a new chat.</div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={msg.sender === 'user' ? 'message-row user-row' : 'message-row bot-row'}>
              <div className={msg.sender === 'user' ? 'avatar avatar-user' : 'avatar avatar-bot'}>
                {msg.sender === 'user' ? '🧑' : '🤖'}
              </div>
              <div className={msg.sender === 'user' ? 'message user' : 'message bot'}>
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="message-row bot-row">
              <div className="avatar avatar-bot">🤖</div>
              <div className="message bot typing">Thinking...</div>
            </div>
          )}
        </div>

        <form onSubmit={sendMessage} className="input-form">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask something about the document..."
          />
          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  );
}

export default App;