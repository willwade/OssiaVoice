import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";

// Firebase Configuration (Placeholder - User needs to update this)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

function App() {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [llm, setLlm] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Initialize Gemini with the user's token or a proxy if needed
        // For client-side only demos without a backend proxy for billing, 
        // we might still need an API key. 
        // However, the prompt asked to "Allow sign in with Google so users can be billed directly for gemini usage".
        // Direct billing via Google Sign-In for Gemini API typically requires a backend to handle the OAuth2 flow and API calls on behalf of the user, 
        // or passing the access token if the API supports it directly (which Vertex AI might, but standard Gemini API usually uses API keys).
        
        // Since this is a "Frontend Only" request, we will assume the user might provide their own API key 
        // OR we use the Google Auth to get an access token if we were using Vertex AI client-side (less common without proxy).
        // For simplicity and adhering to "Frontend Only", we will simulate the "billed directly" part 
        // by asking the user to input their Gemini API Key if they want, OR if the intention 
        // was to use Firebase Vertex AI extensions.
        
        // Given the constraints, I'll initialize the LLM with a placeholder or prompt the user for an API Key. 
        // "Sign in with Google" is implemented.
      }
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in with Google", error);
    }
  };

  const handleSignOut = () => {
    signOut(auth);
  };

  const initLLM = (apiKey) => {
      const model = new ChatGoogleGenerativeAI({
        apiKey: apiKey,
        modelName: "gemini-pro",
        maxOutputTokens: 2048,
      });
      setLlm(model);
  };

  const handleSend = async () => {
    if (!input.trim() || !llm) return;
    
    const newMessages = [...messages, { role: 'user', content: input }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
        const langchainMessages = newMessages.map(msg => {
            if (msg.role === 'user') return new HumanMessage(msg.content);
            if (msg.role === 'assistant') return new AIMessage(msg.content);
            return new SystemMessage(msg.content);
        });

      const response = await llm.invoke(langchainMessages);
      
      setMessages([...newMessages, { role: 'assistant', content: response.content }]);
    } catch (error) {
      console.error("Error calling Gemini:", error);
      setMessages([...newMessages, { role: 'assistant', content: "Error processing request." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4">
      <header className="w-full max-w-4xl flex justify-between items-center mb-8 p-4 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-gray-800">Ossia Voice (Gemini)</h1>
        <div>
          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-gray-600">Hello, {user.displayName}</span>
              <button onClick={handleSignOut} className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition">Sign Out</button>
            </div>
          ) : (
            <button onClick={handleGoogleSignIn} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition">Sign In with Google</button>
          )}
        </div>
      </header>

      <main className="w-full max-w-4xl bg-white rounded-lg shadow-md flex-1 flex flex-col overflow-hidden h-[600px]">
        {!llm ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <h2 className="text-xl font-semibold mb-4">Setup Gemini API</h2>
                <p className="text-gray-600 mb-6">Please enter your Gemini API Key to start.</p>
                <input 
                    type="password" 
                    placeholder="Enter Gemini API Key" 
                    className="w-full max-w-md p-3 border border-gray-300 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') initLLM(e.target.value);
                    }}
                />
                 <p className="text-sm text-gray-500">Press Enter to save.</p>
            </div>
        ) : (
            <>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}>
                        {msg.content}
                    </div>
                    </div>
                ))}
                {loading && <div className="text-center text-gray-500">Thinking...</div>}
                </div>
                
                <div className="p-4 border-t border-gray-200 flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Type your message..."
                    className="flex-1 p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loading}
                />
                <button 
                    onClick={handleSend} 
                    disabled={loading}
                    className="px-6 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 transition disabled:opacity-50"
                >
                    Send
                </button>
                </div>
            </>
        )}
      </main>
    </div>
  );
}

export default App;
