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

// Helper to format timestamps into a relative time string.
function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const msgTime = new Date(timestamp);
  const diff = Math.floor((now.getTime() - msgTime.getTime()) / 1000); // difference in seconds

  if (diff < 60) return 'Just now';
  if (diff < 3600) {
    const mins = Math.floor(diff / 60);
    return `${mins} min${mins === 1 ? '' : 's'} ago`;
  }
  if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  const days = Math.floor(diff / 86400);
  return `${days} day${days === 1 ? '' : 's'} ago`;
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
      // Insert a notification for the receiver.
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

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  return (
    <div className="min-h-screen bg-base-200 text-base-content p-4 sm:p-6">
      <div className="container mx-auto max-w-6xl">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-center mb-6">Messaging</h1>

        {/* Friend Picker: Horizontal Scrollable List */}
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
                    <div className="w-14 h-14 rounded-full">
                      {friend.avatar_url ? (
                        <img src={friend.avatar_url} alt={friend.username} className="object-cover" />
                      ) : (
                        <div className="flex items-center justify-center bg-base-300 w-full h-full">
                          <span className="text-xl font-bold">
                            {friend.username ? friend.username.charAt(0).toUpperCase() : '?'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-sm font-semibold">{friend.username || 'Unknown'}</p>
                </div>
              ))
            ) : (
              <p className="text-center text-sm text-gray-500">No friends available.</p>
            )}
          </div>
        </div>

        {/* Chat Box */}
        <div className="bg-base-100 shadow-xl rounded-xl p-4 flex flex-col h-[60vh] md:h-[500px]">
          {selectedFriend ? (
            <>
              <div className="mb-4 border-b pb-2">
                <h2 className="text-xl sm:text-2xl font-bold">
                  Chat with {selectedFriend.username || 'Unknown'}
                </h2>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-4">
                {messages.length === 0 ? (
                  <p className="text-center text-sm text-gray-500">No messages yet.</p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`chat ${
                        msg.sender_id === currentUserId ? 'chat-end' : 'chat-start'
                      }`}
                    >
                      {msg.sender_id !== currentUserId && (
                        <div className="chat-image avatar">
                          <div className="w-10 rounded-full">
                            {selectedFriend.avatar_url ? (
                              <img
                                src={selectedFriend.avatar_url}
                                alt={selectedFriend.username}
                                className="object-cover"
                              />
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
                      <div className="chat-bubble max-w-xs sm:max-w-md break-words">
                        {msg.content}
                        <div className="text-xs mt-1 text-right text-gray-500">
                          {formatRelativeTime(msg.created_at)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={handleSendMessage} className="mt-4 flex gap-2">
                <input
                  type="text"
                  placeholder="Type your message..."
                  className="input input-bordered flex-1"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <button type="submit" className="btn btn-primary whitespace-nowrap">
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
