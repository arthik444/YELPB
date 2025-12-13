import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Mic, Image as ImageIcon, Camera, X, Loader2, ChevronDown, MessageCircle, Sparkles, MessageSquare } from 'lucide-react';
import { apiService } from '../services/api';
import { VoiceMode } from './VoiceMode';

interface Message {
  id: number;
  sender: 'user' | 'ai';
  text: string;
  hasAudio?: boolean;
  hasImage?: boolean;
  imageUrl?: string;
}

interface Activity {
  id: number;
  type: 'join' | 'preference' | 'ready' | 'like';
  user: string;
  userColor: string;
  message: string;
  timestamp: Date;
}

interface SessionUser {
  id: string;
  name: string;
  color: string;
  joinedAt: number;
}

interface UserVote {
  userId: string;
  userName: string;
  timestamp: number;
}

interface MultimodalChatProps {
  preferences?: {
    cuisine?: string;
    budget?: string;
    vibe?: string;
    distance?: string;
    dietary?: string;
  };
  activities?: Activity[];
  onlineUsers?: SessionUser[];
  userVotes?: {
    budget: Record<string, UserVote[]>;
    cuisine: Record<string, UserVote[]>;
    vibe: Record<string, UserVote[]>;
    dietary: Record<string, UserVote[]>;
    distance: Record<string, UserVote[]>;
  };
  sessionCode?: string;
  currentUserName?: string; // Name of the user currently chatting
  minimized?: boolean;
  fullScreenMode?: boolean; // Mobile full-screen mode
  onToggleMinimized?: () => void;
  onPreferencesDetected?: (prefs: {
    cuisine?: string;
    budget?: string;
    vibe?: string;
    dietary?: string;
  }) => void;
  // Expose chat handlers for external control
  onGetChatHandlers?: (handlers: {
    message: string;
    setMessage: (msg: string) => void;
    handleSendMessage: () => void;
    handleImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    startRecording: () => void;
    stopRecording: () => void;
    isRecording: boolean;
    isTyping: boolean;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
  }) => void;
}

export function MultimodalChat({
  preferences,
  activities = [],
  onlineUsers = [],
  userVotes,
  sessionCode,
  currentUserName,
  minimized = false,
  fullScreenMode = false,
  onToggleMinimized,
  onPreferencesDetected,
  onGetChatHandlers
}: MultimodalChatProps) {
  const getWelcomeMessage = () => {
    if (onlineUsers.length > 1) {
      return `Hey! I can see ${onlineUsers.length} people in the session. Tell me what you're all craving and I'll help find the perfect spot everyone will love! 🍽️`;
    }
    return 'Hi there! I\'m here to help you find amazing restaurants. What are you in the mood for today? 😊';
  };

  // Generate storage key based on session
  const storageKey = `chat_messages_${sessionCode || 'default'}`;

  // Load messages from localStorage or use default
  const getInitialMessages = (): Message[] => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load chat messages from localStorage:', e);
    }
    return [{
      id: 1,
      sender: 'ai',
      text: getWelcomeMessage()
    }];
  };

  const [messages, setMessages] = useState<Message[]>(getInitialMessages);
  const [message, setMessage] = useState('');

  // Persist isTyping state so thinking animation survives tab switches
  const typingStorageKey = `chat_typing_${sessionCode || 'default'}`;
  const [isTyping, setIsTyping] = useState(() => {
    try {
      return localStorage.getItem(typingStorageKey) === 'true';
    } catch { return false; }
  });

  const [isRecording, setIsRecording] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [voiceModeOpen, setVoiceModeOpen] = useState(false);

  // Keep a ref to always have latest messages for direct localStorage saves
  const messagesRef = useRef<Message[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Save isTyping to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(typingStorageKey, isTyping ? 'true' : 'false');
    } catch { }
  }, [isTyping, typingStorageKey]);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch (e) {
      console.warn('Failed to save chat messages to localStorage:', e);
    }
  }, [messages, storageKey]);

  // Helper to add message AND save directly to localStorage (for in-flight responses)
  const addMessageAndSave = (newMessage: Message) => {
    const updatedMessages = [...messagesRef.current, newMessage];
    messagesRef.current = updatedMessages;
    setMessages(updatedMessages);
    // Also save directly to localStorage in case component unmounts
    try {
      localStorage.setItem(storageKey, JSON.stringify(updatedMessages));
    } catch (e) {
      console.warn('Failed to save message to localStorage:', e);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageIdRef = useRef(Date.now()); // Counter for unique message IDs

  // Generate unique message ID
  const getNextMsgId = () => {
    messageIdRef.current += 1;
    return messageIdRef.current;
  };

  // Build session context from activities and votes
  const buildSessionContext = (): string => {
    let context = '';

    // IMPORTANT: Identify the current user chatting - this is a PRIVATE chat
    const myName = currentUserName || localStorage.getItem('userName') || 'User';
    context += `=== CRITICAL INSTRUCTIONS ===\n`;
    context += `You are having a PRIVATE 1-on-1 conversation with: ${myName}\n`;
    context += `- Address ONLY ${myName} directly (use "you" or their name)\n`;
    context += `- Do NOT address other users by name or ask them questions\n`;
    context += `- You can MENTION what others voted for as context, but talk TO ${myName} only\n`;
    context += `- Example: "Gana voted for $$" is OK, but "Gana, what do you think?" is NOT OK\n`;
    context += `=== END INSTRUCTIONS ===\n\n`;

    // Add user info
    const otherUsers = onlineUsers.filter(u => u.name.toLowerCase() !== myName.toLowerCase());
    if (otherUsers.length > 0) {
      context += `Session: ${sessionCode || 'Unknown'}\n`;
      context += `Other users in session: ${otherUsers.map(u => u.name).join(', ')}\n\n`;
    }

    // Add recent activity (last 5)
    if (activities.length > 0) {
      context += 'Recent activity:\n';
      const recentActivities = activities.slice(-5);
      recentActivities.forEach(act => {
        context += `- ${act.user} ${act.message}\n`;
      });
      context += '\n';
    }

    // Add voting consensus/disagreement
    if (userVotes) {
      const getTopVote = (category: keyof typeof userVotes) => {
        const votes = userVotes[category];
        if (!votes || Object.keys(votes).length === 0) return null;

        const sorted = Object.entries(votes).sort((a, b) => b[1].length - a[1].length);
        return { option: sorted[0][0], count: sorted[0][1].length, voters: sorted[0][1].map(v => v.userName) };
      };

      const budgetVote = getTopVote('budget');
      const cuisineVote = getTopVote('cuisine');
      const vibeVote = getTopVote('vibe');

      if (budgetVote || cuisineVote || vibeVote) {
        context += 'Current voting:\n';
        if (budgetVote) {
          context += `- Budget: ${budgetVote.option} (${budgetVote.count} vote${budgetVote.count > 1 ? 's' : ''} from ${budgetVote.voters.join(', ')})\n`;
        }
        if (cuisineVote) {
          context += `- Cuisine: ${cuisineVote.option} (${cuisineVote.count} vote${cuisineVote.count > 1 ? 's' : ''} from ${cuisineVote.voters.join(', ')})\n`;
        }
        if (vibeVote) {
          context += `- Vibe: ${vibeVote.option} (${vibeVote.count} vote${vibeVote.count > 1 ? 's' : ''} from ${vibeVote.voters.join(', ')})\n`;
        }
        context += '\n';
      }
    }

    return context;
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Note: Activity feed reactions removed from chat as they duplicate the Activity Feed at the top

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        resolve(base64.split(',')[1]); // Remove data:image/jpeg;base64, prefix
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Start audio recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await sendAudioMessage(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  // Stop audio recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Send audio message - using unified backend endpoint
  const sendAudioMessage = async (audioBlob: Blob) => {
    try {
      // Add user message indicator
      setMessages(prev => [...prev, {
        id: getNextMsgId(),
        sender: 'user',
        text: '🎤 Voice message',
        hasAudio: true
      }]);

      setIsTyping(true);

      // Convert audio to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Audio = (reader.result as string).split(',')[1];

        // Use unified backend endpoint - returns everything we need in one call
        const result = await apiService.processVoiceUnified(
          base64Audio,
          'audio/webm',
          buildSessionContext(),
          preferences || {}
        );

        // Don't set isTyping to false yet - wait until message is added

        if (result.success && result.transcription) {
          // Show what we heard
          setMessages(prev => [...prev, {
            id: getNextMsgId(),
            sender: 'ai',
            text: `🎤 "${result.transcription}"`
          }]);

          // Apply detected preferences directly (already mapped by backend)
          if (Object.keys(result.detected_preferences).length > 0 && onPreferencesDetected) {
            onPreferencesDetected(result.detected_preferences);
          }

          // Add AI response - use addMessageAndSave to persist during unmount
          setIsTyping(false);
          addMessageAndSave({
            id: getNextMsgId(),
            sender: 'ai',
            text: result.ai_response
          });
        } else {
          setIsTyping(false);
          setMessages(prev => [...prev, {
            id: getNextMsgId(),
            sender: 'ai',
            text: result.error || 'Sorry, I had trouble understanding that. Please try again.'
          }]);
        }
      };
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error('Error sending audio:', error);
      setIsTyping(false);
      addMessageAndSave({
        id: getNextMsgId(),
        sender: 'ai',
        text: 'Sorry, I had trouble processing your voice message. Please try again or type your message.'
      });
    }
  };

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Send image message - using unified backend endpoint
  const sendImageMessage = async () => {
    if (!selectedImage) return;

    try {
      // Capture the message text and clear input
      const userText = message.trim();
      setMessage('');

      // Add user message with image indicator and optional text
      const userMsgId = getNextMsgId();
      const capturedImagePreview = imagePreview; // Capture before clearing

      // Clear image preview immediately so user sees it's been sent
      setSelectedImage(null);
      setImagePreview(null);

      setMessages(prev => [...prev, {
        id: userMsgId,
        sender: 'user',
        text: userText || '',
        hasImage: true,
        imageUrl: capturedImagePreview || undefined
      }]);

      setIsTyping(true);

      // Convert image to base64
      const base64Image = await fileToBase64(selectedImage);

      // Use unified backend endpoint - returns preferences and response message
      const result = await apiService.processImageUnified(
        base64Image,
        selectedImage.type,
        userText
      );

      // Don't set isTyping to false yet - wait until message is added

      if (result.success) {
        console.log('Unified image result:', result);

        // Apply detected preferences directly (already mapped by backend)
        if (Object.keys(result.detected_preferences).length > 0 && onPreferencesDetected) {
          onPreferencesDetected(result.detected_preferences);
        }

        // Add AI response (already formatted by backend) - use addMessageAndSave
        setIsTyping(false);
        addMessageAndSave({
          id: getNextMsgId(),
          sender: 'ai',
          text: result.response_message
        });
      } else {
        // Fallback error message
        setIsTyping(false);
        setMessages(prev => [...prev, {
          id: getNextMsgId(),
          sender: 'ai',
          text: result.error || 'I see your photo! Try describing what you want in text for better preference detection.'
        }]);
      }

      // Image already cleared above when message was sent
    } catch (error) {
      console.error('Error sending image:', error);
      setIsTyping(false);
      addMessageAndSave({
        id: getNextMsgId(),
        sender: 'ai',
        text: 'Sorry, I had trouble analyzing that image. Please try again.'
      });
    }
  };

  // Enhanced casual message detection
  const isCasualMessage = (text: string): boolean => {
    const casual = text.toLowerCase().trim();
    const casualPatterns = [
      /^hi$/i, /^hi\!*$/i, /^hello$/i, /^hello\!*$/i, /^hey$/i, /^hey\!*$/i,
      /^sup$/i, /^yo$/i, /^what'?s up$/i, /^wassup$/i,
      /^thanks$/i, /^thank you$/i, /^thx$/i,
      /^ok$/i, /^okay$/i, /^sure$/i, /^alright$/i,
      /^cool$/i, /^nice$/i, /^great$/i, /^awesome$/i, /^perfect$/i,
      /^bye$/i, /^goodbye$/i, /^see you$/i, /^cya$/i,
      /^help$/i, /^help me$/i, /^what can you do$/i,
    ];

    // Check for food/restaurant-related keywords that indicate intent
    const foodKeywords = [
      'food', 'restaurant', 'eat', 'cuisine', 'meal', 'dinner', 'lunch', 'breakfast',
      'cheap', 'expensive', 'budget', 'price', 'cost', 'affordable',
      'romantic', 'casual', 'vibe', 'atmosphere', 'ambiance',
      'spicy', 'sweet', 'savory', 'hot', 'mild', 'flavor',
      'italian', 'mexican', 'japanese', 'chinese', 'french', 'thai', 'indian', 'korean',
      'pizza', 'pasta', 'sushi', 'tacos', 'burgers', 'ramen', 'curry',
      'vegetarian', 'vegan', 'gluten-free', 'halal', 'kosher',
      'nearby', 'close', 'local', 'around', 'near me',
      'want', 'need', 'looking for', 'craving', 'hungry', 'starving'
    ];

    const hasFood = foodKeywords.some(kw => casual.includes(kw));

    // Only consider it casual if it matches a pattern AND has no food keywords
    return casualPatterns.some(pattern => pattern.test(casual)) && !hasFood;
  };

  // Generate intelligent response based on context (fallback only)
  const getSmartResponse = (userMessage: string, detectedPrefs: any): string => {
    const msgLower = userMessage.toLowerCase();
    const currentPrefs = { ...preferences, ...detectedPrefs };

    // Analyze what the user is asking about
    const isAskingForHelp = msgLower.includes('what') || msgLower.includes('which') || msgLower.includes('best') || msgLower.includes('recommend');
    const isUnsure = msgLower.includes("don't know") || msgLower.includes("not sure") || msgLower.includes("don't mind");
    const mentionsTime = msgLower.includes('night') || msgLower.includes('evening') || msgLower.includes('lunch') || msgLower.includes('breakfast');
    const mentionsPrice = msgLower.match(/\$\d+|\d+\s*dollars?/);

    // Context-aware responses
    if (isAskingForHelp) {
      const responses = [
        "Based on what you've told me, how about we narrow down some options? What's your budget looking like?",
        "Let me help you decide! Are you thinking casual or something more upscale?",
        "I'd love to suggest something! What kind of atmosphere are you in the mood for?"
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    }

    if (isUnsure) {
      return "No worries! Let's start simple - are you thinking more casual dining or something fancier? That'll help narrow it down.";
    }

    if (mentionsTime) {
      return "Nighttime dining! Are you looking for something romantic, or more of a casual hangout spot?";
    }

    // Check for flavor/spice mentions
    if (msgLower.includes('spicy') || msgLower.includes('hot')) {
      return "Love spicy food! Thai, Indian, and Mexican cuisine are great for heat. What's your budget range?";
    }

    // Generic but varied responses
    const genericResponses = [
      "Tell me more about what you're in the mood for - any specific type of food catching your interest?",
      "What's the vibe you're going for? Something casual, or a bit more special?",
      "Help me understand your preferences better - thinking cheap eats or willing to splurge a bit?"
    ];

    return genericResponses[Math.floor(Math.random() * genericResponses.length)];
  };

  // Send text message
  const handleSendMessage = async () => {
    if (!message.trim() && !selectedImage) return;

    if (selectedImage) {
      await sendImageMessage();
      setMessage('');
      return;
    }

    const userMessage = message.trim();
    setMessages(prev => [...prev, { id: getNextMsgId(), sender: 'user', text: userMessage }]);
    setMessage('');

    setIsTyping(true);

    try {
      // Build full context for AI
      const sessionContext = buildSessionContext();
      const currentPrefs = preferences || {};

      // Use pure Gemini chat for conversational AI (no Yelp search)
      const result = await apiService.geminiChat(
        userMessage,
        sessionContext,
        currentPrefs
      );

      // Don't set isTyping to false yet - wait until message is added

      console.log('AI conversation response:', result);

      // Get the AI's conversational response
      let aiMessage = result.message || '';

      // Extract preferences in the background
      if (onPreferencesDetected) {
        try {
          const prefResult = await apiService.analyzePreferences(userMessage);
          console.log('Preference extraction:', prefResult);

          let detectedPrefs: any = {};

          if (prefResult.success && prefResult.result) {
            const analysis = JSON.parse(prefResult.result);

            // Map cuisine preferences
            if (Array.isArray(analysis.cuisine_preferences) && analysis.cuisine_preferences.length > 0) {
              const cuisineMap: Record<string, string> = {
                'italian': 'Italian',
                'japanese': 'Japanese',
                'mexican': 'Mexican',
                'french': 'French',
                'thai': 'Thai',
                'indian': 'Indian',
                'korean': 'Korean',
                'spanish': 'Spanish',
                'chinese': 'Chinese',
                'sushi': 'Japanese',
                'ramen': 'Japanese',
                'pasta': 'Italian',
                'pizza': 'Italian',
                'tacos': 'Mexican',
                'curry': 'Indian'
              };

              const firstCuisine = String(analysis.cuisine_preferences[0]).toLowerCase();
              detectedPrefs.cuisine = cuisineMap[firstCuisine] || analysis.cuisine_preferences[0];
            }

            // Map price range
            if (analysis.price_range && typeof analysis.price_range === 'string') {
              const priceMap: Record<string, string> = {
                'budget': '$',
                'cheap': '$',
                'inexpensive': '$',
                'moderate': '$$',
                'mid-range': '$$',
                'expensive': '$$$',
                'upscale': '$$$',
                'luxury': '$$$$',
                'fine dining': '$$$$'
              };

              const priceKey = analysis.price_range.toLowerCase();
              detectedPrefs.budget = priceMap[priceKey] || '$$';
            }

            // Map ambiance/vibe
            if (analysis.ambiance_preferences && typeof analysis.ambiance_preferences === 'string') {
              const vibeMap: Record<string, string> = {
                'casual': 'Casual',
                'fine dining': 'Fine Dining',
                'trendy': 'Trendy',
                'cozy': 'Cozy',
                'lively': 'Lively',
                'romantic': 'Romantic',
                'family-friendly': 'Family-Friendly',
                'family friendly': 'Family-Friendly'
              };

              const vibeKey = analysis.ambiance_preferences.toLowerCase();
              detectedPrefs.vibe = vibeMap[vibeKey] || analysis.ambiance_preferences;
            }

            // Map dietary requirements
            if (Array.isArray(analysis.dietary_requirements) && analysis.dietary_requirements.length > 0) {
              const dietaryMap: Record<string, string> = {
                'vegetarian': 'Vegetarian',
                'vegan': 'Vegan',
                'gluten-free': 'Gluten-Free',
                'gluten free': 'Gluten-Free',
                'halal': 'Halal',
                'kosher': 'Kosher'
              };

              const firstDietary = String(analysis.dietary_requirements[0]).toLowerCase();
              detectedPrefs.dietary = dietaryMap[firstDietary] || analysis.dietary_requirements[0];
            }

            console.log('Detected preferences:', detectedPrefs);

            // Trigger callback to update preferences silently in background
            if (Object.keys(detectedPrefs).length > 0) {
              onPreferencesDetected(detectedPrefs);
            }
          }
        } catch (error) {
          console.error('Error extracting preferences:', error);
        }
      }

      // Fallback if chat didn't return a response
      if (!aiMessage) {
        aiMessage = "I'm here to help! What kind of restaurant are you looking for?";
      }

      // Stop typing and add message together to avoid lag
      setIsTyping(false);
      addMessageAndSave({
        id: getNextMsgId(),
        sender: 'ai',
        text: aiMessage
      });
    } catch (error: any) {
      console.error('Error sending message:', error);
      setIsTyping(false);

      const errorMsg = error?.message || 'Unknown error';
      const isBackendDown = errorMsg.includes('Network error') || errorMsg.includes('connect');

      addMessageAndSave({
        id: getNextMsgId(),
        sender: 'ai',
        text: isBackendDown
          ? '⚠️ Backend server not running. Please start the Python backend: cd backend && python main.py'
          : `Sorry, I encountered an error: ${errorMsg}. Please try again.`
      });
    }
  };

  // Expose handlers to parent component (placed after all functions are defined)
  useEffect(() => {
    if (onGetChatHandlers) {
      onGetChatHandlers({
        message,
        setMessage,
        handleSendMessage,
        handleImageSelect,
        startRecording,
        stopRecording,
        isRecording,
        isTyping,
        fileInputRef
      });
    }
  }, [message, isRecording, isTyping]);

  // Full-screen mobile mode
  if (fullScreenMode) {
    return (
      <div className="flex flex-col flex-1 w-full bg-gray-100" style={{ position: 'relative', minHeight: 0 }}>
        {/* Messages Area - scrollable with padding for search bar */}
        <div
          className="px-4 py-6 bg-gray-100 [&::-webkit-scrollbar]:hidden"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            paddingBottom: '140px', // Space for search bar (60px) + nav bar (60px) + margin (20px)
            overflowY: 'auto', // Enable vertical scrolling
            overflowX: 'hidden', // Prevent horizontal scrolling
            WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
            overscrollBehavior: 'contain', // Prevent pull-to-refresh on mobile
            scrollbarWidth: 'none', // Hide scrollbar in Firefox
            msOverflowStyle: 'none' // Hide scrollbar in IE/Edge
          }}
        >
          {messages.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-20 h-20 rounded-full mb-6 flex items-center justify-center" style={{ backgroundColor: '#F05A28' }}>
                <MessageSquare className="h-10 w-10" style={{ color: '#ffffff' }} />
              </div>
              <h3 className="text-2xl font-bold mb-3" style={{ color: '#1C1917' }}>Chat with AI Assistant</h3>
              <p className="text-base mb-6" style={{ color: '#6b7280' }}>
                Ask about restaurants, get recommendations, or just chat!
              </p>
              <div className="space-y-3 w-full max-w-sm">
                <button
                  onClick={() => {
                    setMessage("What Italian restaurants are nearby?");
                  }}
                  className="w-full text-left px-5 py-4 rounded-2xl shadow-md transition-all"
                  style={{ backgroundColor: '#ffffff', border: '2px solid #d1d5db', color: '#1C1917' }}
                >
                  <p className="text-base font-medium">💭 "What Italian restaurants are nearby?"</p>
                </button>
                <button
                  onClick={() => {
                    setMessage("Find me a romantic dinner spot");
                  }}
                  className="w-full text-left px-5 py-4 rounded-2xl shadow-md transition-all"
                  style={{ backgroundColor: '#ffffff', border: '2px solid #d1d5db', color: '#1C1917' }}
                >
                  <p className="text-base font-medium">🕯️ "Find me a romantic dinner spot"</p>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              <AnimatePresence mode="popLayout">
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className="max-w-[80%] rounded-2xl px-5 py-4 shadow-lg"
                      style={{
                        backgroundColor: msg.sender === 'ai' ? '#ffffff' : '#1C1917',
                        color: msg.sender === 'ai' ? '#1C1917' : '#ffffff',
                        border: msg.sender === 'ai' ? '2px solid #d1d5db' : 'none'
                      }}
                    >
                      {msg.imageUrl && (
                        <img
                          src={msg.imageUrl}
                          alt="Uploaded"
                          className="w-32 h-32 rounded-lg object-cover mb-2"
                        />
                      )}
                      <p className="text-base leading-relaxed">{msg.text}</p>
                    </div>
                  </motion.div>
                ))}
                {isTyping && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                    <div className="rounded-2xl border-2 px-5 py-4 shadow-lg" style={{ backgroundColor: '#ffffff', borderColor: '#d1d5db' }}>
                      <div className="flex gap-2">
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: '#6b7280' }}
                            animate={{ y: [0, -8, 0] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.2 }}
                          />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Image Preview - positioned near bottom, above search bar */}
        {imagePreview && (
          <div
            className="flex-shrink-0 px-4 py-3"
            style={{
              position: 'absolute',
              bottom: '140px', // Above search bar and nav
              left: 0,
              right: 0,
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              borderTop: '1px solid #e5e7eb',
              borderBottom: '1px solid #e5e7eb',
              backdropFilter: 'blur(8px)'
            }}
          >
            <div className="relative inline-block">
              <button
                onClick={() => {
                  setSelectedImage(null);
                  setImagePreview(null);
                }}
                className="absolute -right-2 -top-2 z-10 rounded-full p-1.5 shadow-lg"
                style={{ backgroundColor: '#ef4444', color: '#ffffff' }}
              >
                <X className="h-4 w-4" />
              </button>
              <img src={imagePreview} alt="Preview" className="h-20 w-20 rounded-xl object-cover shadow-lg border-2" style={{ borderColor: '#d1d5db' }} />
            </div>
          </div>
        )}

        {/* Hide scrollbar CSS */}
        <style>{`
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
        `}</style>
      </div>
    );
  }

  //Original floating bubble mode
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{
        scale: 1,
        borderRadius: minimized ? '9999px' : '16px'
      }}
      transition={{
        scale: { type: 'spring', damping: 25, stiffness: 400 },
        opacity: { duration: 0.25 },
        borderRadius: { duration: 0.4, ease: [0.4, 0, 0.2, 1] }
      }}
      style={{
        position: 'fixed',
        bottom: '100px',
        right: '24px',
        zIndex: 9999,
        width: minimized ? '64px' : '400px',
        height: minimized ? '64px' : '500px',
        transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), height 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
      className="flex flex-col overflow-hidden border border-white/10 bg-zinc-950/95 backdrop-blur-xl shadow-2xl"
    >
      {/* Header */}
      <button
        onClick={onToggleMinimized}
        className={`flex items-center justify-center transition-all ${minimized
          ? 'w-full h-full rounded-full bg-gradient-to-br from-[#F97316] to-[#fb923c] hover:scale-110 shadow-lg shadow-orange-500/50'
          : 'w-full border-b border-white/5 bg-gradient-to-r from-orange-500/10 to-transparent px-4 py-2.5 hover:from-orange-500/15'
          }`}
      >
        {minimized ? (
          <div className="relative">
            {isTyping ? (
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              >
                <Sparkles className="h-7 w-7 text-white" />
              </motion.div>
            ) : (
              <MessageCircle className="h-7 w-7 text-white" />
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: isTyping ? [0, 360] : 0 }}
              transition={{ duration: 3, repeat: isTyping ? Infinity : 0, ease: 'linear' }}
            >
              <span className="text-sm">🧠</span>
            </motion.div>
            <div className="flex-1 text-left">
              <h3 className="text-sm text-white" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
                Private Strategist
              </h3>
              <p className="text-xs text-gray-500">Gemini AI • Multimodal</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-0.5">
                <div className="h-1 w-1 animate-pulse rounded-full bg-green-400" />
                <span className="text-xs text-green-400">Active</span>
              </div>
              <motion.div
                animate={{ rotate: minimized ? 0 : 180 }}
                transition={{ duration: 0.3 }}
              >
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </motion.div>
            </div>
          </div>
        )}
      </button>

      {/* Chat Messages */}
      <AnimatePresence>
        {!minimized && (
          <>
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex-1 space-y-2 overflow-y-auto p-3"
            >
              <AnimatePresence mode="popLayout">
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.sender === 'ai'
                        ? 'border border-green-500/20 bg-gradient-to-br from-zinc-900 to-zinc-800/50 text-gray-100 shadow-lg shadow-green-500/10'
                        : 'bg-gradient-to-r from-[#F97316] to-[#fb923c] text-white shadow-lg shadow-orange-500/20'
                        }`}
                      style={{
                        fontFamily: msg.sender === 'ai' ? 'Montserrat, sans-serif' : 'inherit',
                        fontSize: '0.85rem',
                        fontWeight: msg.sender === 'ai' ? 500 : 400
                      }}
                    >
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
                {isTyping && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-xl bg-zinc-900 px-3 py-2">
                      <div className="flex gap-1">
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            className="h-1.5 w-1.5 rounded-full bg-green-400"
                            animate={{ y: [0, -4, 0] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                          />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </motion.div>

            {/* Image Preview */}
            {imagePreview && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="border-t border-white/5 p-2"
              >
                <div className="relative inline-block">
                  <img src={imagePreview} alt="Preview" className="h-20 w-20 rounded-lg object-cover" />
                  <button
                    onClick={() => {
                      setSelectedImage(null);
                      setImagePreview(null);
                    }}
                    className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Input Area */}
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-white/5 bg-black/40 p-3"
            >
              <div className="flex gap-2">
                {/* Hidden file input for gallery upload */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                  accept="image/*"
                  className="hidden"
                  style={{ display: 'none' }}
                />

                {/* Hidden file input for camera capture */}
                <input
                  type="file"
                  id="cameraInput"
                  onChange={handleImageSelect}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  style={{ display: 'none' }}
                />

                {/* Text Input */}
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !isTyping && handleSendMessage()}
                  placeholder={
                    preferences?.cuisine && preferences?.budget && preferences?.vibe
                      ? "Add more details or lock preferences..."
                      : preferences?.cuisine
                        ? "Add budget or vibe..."
                        : "Try: 'Italian food under $20'"
                  }
                  disabled={isRecording}
                  className="flex-1 rounded-lg bg-zinc-900/80 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none transition-all focus:bg-zinc-900 focus:ring-2 focus:ring-orange-500/50 disabled:opacity-50"
                />

                {/* Camera Capture Button */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => document.getElementById('cameraInput')?.click()}
                  className="rounded-lg bg-zinc-900/80 p-2 transition-all hover:bg-zinc-800"
                  title="Take photo"
                >
                  <Camera className="h-4 w-4 text-gray-400" />
                </motion.button>

                {/* Image Upload Button */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg bg-zinc-900/80 p-2 transition-all hover:bg-zinc-800"
                  title="Upload image"
                >
                  <ImageIcon className="h-4 w-4 text-gray-400" />
                </motion.button>

                {/* Voice Recording Button */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setVoiceModeOpen(true)}
                  className="rounded-lg p-2 transition-all bg-zinc-900/80 hover:bg-zinc-800"
                  title="Voice mode"
                >
                  <Mic className="h-4 w-4 text-gray-400" />
                </motion.button>

                {/* Send Button */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSendMessage}
                  disabled={(!message.trim() && !selectedImage) || isRecording || isTyping}
                  className="rounded-lg bg-gradient-to-r from-[#F97316] to-[#fb923c] p-2 shadow-lg shadow-orange-500/30 transition-all disabled:opacity-40"
                  title="Send message"
                >
                  <Send className="h-4 w-4 text-white" />
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Voice Mode - Fullscreen conversation */}
      <VoiceMode
        isOpen={voiceModeOpen}
        onClose={() => setVoiceModeOpen(false)}
        onTranscription={(text) => {
          // Add user message to chat
          setMessages(prev => [...prev, {
            id: getNextMsgId(),
            sender: 'user',
            text: `🎤 ${text}`,
            hasAudio: true
          }]);
        }}
        onAIResponse={(text) => {
          // Add AI response to chat
          setMessages(prev => [...prev, {
            id: getNextMsgId(),
            sender: 'ai',
            text: `🔊 ${text}`
          }]);
        }}
        onPreferencesDetected={onPreferencesDetected}
      />
    </motion.div>
  );
}
