'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

interface Profile {
  user_id: string;
  username?: string;
  avatar_url?: string;
}

interface Message {
  id: number;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

export default function MessagingPage() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUsername, setCurrentUsername] = useState<string>('Unknown');
  const [friends, setFriends] = useState<Profile[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // On mount, get current user session and profile, then fetch friends.
  useEffect(() => {
    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session) {
        const userId = sessionData.session.user.id;
        setCurrentUserId(userId);
        // Fetch current user's username.
        const { data: profileData } = await supabase
          .from('profiles')
          .select('username')
          .eq('user_id', userId)
          .maybeSingle();
        if (profileData) {
          setCurrentUsername(profileData.username || 'Unknown');
        }
        await fetchFriends(userId);
      } else {
        router.push('/signin');
      }
    };
    init();
  }, [router]);

  // Fetch friends: all profiles except current user.
  const fetchFriends = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, username, avatar_url')
      .neq('user_id', userId);
    if (error) {
      setError(error.message);
    } else {
      setFriends(data || []);
      // Auto-select the first friend if available.
      if (data && data.length > 0) {
        setSelectedFriend(data[0]);
        fetchMessages(data[0].user_id);
      }
    }
  };

  // Fetch messages between current user and selected friend.
  const fetchMessages = async (friendId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
      .order('created_at', { ascending: true });
    if (error) {
      setError(error.message);
    } else if (data) {
      const conversation = data.filter((m: Message) =>
        (m.sender_id === currentUserId && m.receiver_id === friendId) ||
        (m.sender_id === friendId && m.receiver_id === currentUserId)
      );
      setMessages(conversation);
    }
  };

  // Realtime subscription for new messages.
  useEffect(() => {
    if (!currentUserId || !selectedFriend) return;
    const channel = supabase
      .channel('messages-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const newMsg = payload.new as Message;
        if (
          (newMsg.sender_id === currentUserId && newMsg.receiver_id === selectedFriend.user_id) ||
          (newMsg.sender_id === selectedFriend.user_id && newMsg.receiver_id === currentUserId)
        ) {
          setMessages((prev) => [...prev, newMsg]);
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, selectedFriend]);

  // Auto-scroll chat box when messages update.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle friend selection via friend cards.
  const handleSelectFriend = (friend: Profile) => {
    setSelectedFriend(friend);
    fetchMessages(friend.user_id);
  };

  // Handle sending a message.
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage || !selectedFriend) return;
    // Reload conversation before sending.
    await fetchMessages(selectedFriend.user_id);
    const payload = {
      sender_id: currentUserId,
      receiver_id: selectedFriend.user_id,
      content: newMessage,
    };
    const { error } = await supabase.from('messages').insert([payload]);
    if (error) {
      setError(error.message);
    } else {
      // Instead of inserting the raw user id into the notification message,
      // use the sender's username to build a friendly message.
      const notificationPayload = {
        user_id: selectedFriend.user_id, // Recipient of the notification.
        sender_id: currentUserId,          // Sender's ID.
        message: `New message received from ${currentUsername}`,
        is_read: false,
      };
      const { error: notifError } = await supabase
        .from('notifications')
        .insert([notificationPayload]);
      if (notifError) {
        console.error("Notification insertion error:", notifError.message);
      }
      setToast("Message sent!");
      setNewMessage('');
      // Reload conversation after sending.
      await fetchMessages(selectedFriend.user_id);
    }
  };

  // Format time for display.
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  return (
    <div className="min-h-screen bg-base-200 text-base-content p-6">
      <div className="container mx-auto max-w-6xl">
        <h1 className="text-4xl font-extrabold text-center mb-8">Messaging</h1>
        {/* Friend Picker as a Horizontal List */}
        <div className="mb-4 overflow-x-auto">
          <div className="flex space-x-4 p-2">
            {friends.length > 0 ? (
              friends.map((friend) => (
                <div
                  key={friend.user_id}
                  className={`flex flex-col items-center cursor-pointer p-2 rounded-lg hover:bg-base-300 transition duration-200 ${
                    selectedFriend?.user_id === friend.user_id ? 'bg-base-300' : ''
                  }`}
                  onClick={() => handleSelectFriend(friend)}
                >
                  <div className="avatar">
                    <div className="w-16 h-16 rounded-full">
                      {friend.avatar_url ? (
                        <img src={friend.avatar_url} alt={friend.username} className="object-cover" />
                      ) : (
                        <div className="flex items-center justify-center bg-base-300 w-full h-full">
                          <span className="text-2xl font-bold">
                            {friend.username ? friend.username.charAt(0).toUpperCase() : '?'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 font-semibold">{friend.username || 'Unknown'}</p>
                </div>
              ))
            ) : (
              <p className="text-center">No friends available.</p>
            )}
          </div>
        </div>
        {/* Chat Box */}
        <div className="bg-base-100 shadow-xl rounded-xl p-4 flex flex-col h-[500px]">
          {selectedFriend ? (
            <>
              <div className="mb-4 border-b pb-2">
                <h2 className="text-2xl font-bold">
                  Chat with {selectedFriend.username || 'Unknown'}
                </h2>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-4 border rounded-lg bg-base-200">
                {messages.length === 0 ? (
                  <p className="text-center text-sm text-gray-500">No messages yet.</p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`chat ${msg.sender_id === currentUserId ? 'chat-end' : 'chat-start'}`}
                    >
                      {msg.sender_id !== currentUserId && (
                        <div className="chat-image avatar">
                          <div className="w-10 rounded-full">
                            {selectedFriend.avatar_url ? (
                              <img src={selectedFriend.avatar_url} alt={selectedFriend.username} />
                            ) : (
                              <div className="bg-base-300 flex items-center justify-center">
                                <span className="text-sm font-bold">
                                  {selectedFriend.username ? selectedFriend.username.charAt(0).toUpperCase() : '?'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="chat-bubble">{msg.content}</div>
                      <div className="text-xs text-gray-500">{formatTime(msg.created_at)}</div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={handleSendMessage} className="mt-4 flex gap-4">
                <input
                  type="text"
                  placeholder="Type your message..."
                  className="input input-bordered flex-1"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <button type="submit" className="btn btn-primary">
                  Send
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-lg text-gray-500">Select a friend to start chatting.</p>
            </div>
          )}
        </div>
      </div>
      {toast && (
        <div className="toast toast-center">
          <div className="alert alert-success shadow-lg">
            <span>{toast}</span>
          </div>
        </div>
      )}
    </div>
  );
}
