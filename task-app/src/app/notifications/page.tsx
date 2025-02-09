'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface ProfileData {
  username?: string;
  avatar_url?: string;
}

interface Notification {
  id: number;
  user_id: string;
  sender_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
  assignment_id?: number;
  sender?: ProfileData;
}

// Helper to format relative time.
const formatRelativeTime = (timestamp: string): string => {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 10) return 'Just now';
  if (diffSeconds < 60) return `${diffSeconds} sec${diffSeconds !== 1 ? 's' : ''} ago`;
  if (diffMinutes < 60) return `${diffMinutes} min${diffMinutes !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hr${diffHours !== 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
};

// Consolidate message notifications so that duplicate "new message received" from the same sender are aggregated.
const consolidateNotifications = (notifs: Notification[]): Notification[] => {
  const aggregated: { [key: string]: Notification } = {};
  const others: Notification[] = [];
  for (const n of notifs) {
    const lowerMsg = n.message.toLowerCase();
    if (lowerMsg.includes("new message received")) {
      const key = `sender-${n.sender_id}`;
      // Keep only the latest notification for this sender.
      if (!aggregated[key] || new Date(n.created_at) > new Date(aggregated[key].created_at)) {
        aggregated[key] = n;
      }
    } else {
      others.push(n);
    }
  }
  // Return others combined with the aggregated message notifications,
  // sorted by created_at (newest first).
  return [...others, ...Object.values(aggregated)].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
};

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [toast, setToast] = useState<string>('');

  // We'll use a ref to track the last notification time per conversation.
  // The key is either "assignment-<id>" or "sender-<id>".
  const lastNotificationTimesRef = useRef<{ [key: string]: number }>({});

  // Fetch notifications for the current user.
  const fetchNotifications = async (userId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('*, sender:profiles!fk_sender(username, avatar_url)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) {
      setError(error.message);
    } else if (data) {
      // Filter out any notification with exactly "you have been assigned a new task!" 
      // and consolidate message notifications.
      const filtered = data.filter(
        (n: Notification) => n.message.toLowerCase() !== 'you have been assigned a new task!'
      );
      setNotifications(consolidateNotifications(filtered));
    }
    setLoading(false);
  };

  const markNotificationsAsRead = async (userId: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) {
      console.error('Error marking notifications as read:', error.message);
    }
  };

  // Delete a notification and navigate if necessary.
  const handleReviewNotification = async (notif: Notification) => {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notif.id);
    if (error) {
      console.error('Error deleting notification:', error.message);
      setToast(`Error deleting notification: ${error.message}`);
    } else {
      setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
      if (notif.assignment_id) {
        router.push(`/reviewSubmissions?assignment_id=${notif.assignment_id}`);
      }
    }
  };

  const handleDeleteNotification = async (notificationId: number) => {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);
    if (error) {
      setError(error.message);
    } else {
      setToast('Notification deleted.');
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    }
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const userId = session.user.id;
        setCurrentUserId(userId);
        await fetchNotifications(userId);
        await markNotificationsAsRead(userId);
      } else {
        setError('You must be logged in to view notifications.');
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase
      .channel('notifications-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const newNotif = payload.new as Notification;
          if (newNotif.user_id === currentUserId) {
            // Skip duplicate notification message.
            if (newNotif.message.toLowerCase() === 'you have been assigned a new task!') {
              return;
            }
            const key = newNotif.assignment_id
              ? `assignment-${newNotif.assignment_id}`
              : `sender-${newNotif.sender_id}`;
            const nowMs = Date.now();
            if (
              lastNotificationTimesRef.current[key] &&
              nowMs - lastNotificationTimesRef.current[key] < 600000
            ) {
              // For message notifications, update the existing one.
              setNotifications((prev) => {
                const index = prev.findIndex((n) => {
                  const existingKey = n.assignment_id
                    ? `assignment-${n.assignment_id}`
                    : `sender-${n.sender_id}`;
                  return existingKey === key;
                });
                if (index !== -1) {
                  const updatedNotif = {
                    ...prev[index],
                    created_at: newNotif.created_at,
                    message: newNotif.message,
                  };
                  const newArr = [...prev];
                  newArr[index] = updatedNotif;
                  return newArr;
                }
                return prev;
              });
              return;
            }
            lastNotificationTimesRef.current[key] = nowMs;
            // For new message notifications, we add it then consolidate.
            setNotifications((prev) =>
              consolidateNotifications([newNotif, ...prev])
            );
            setToast('You have a new notification!');
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  return (
    <div className="min-h-screen bg-base-200 text-base-content p-6">
      <div className="container mx-auto max-w-4xl space-y-10">
        <h1 className="text-4xl font-extrabold text-center">Notifications</h1>
        {loading ? (
          <p className="text-center">Loading notifications...</p>
        ) : error ? (
          <p className="text-center text-error">{error}</p>
        ) : notifications.length === 0 ? (
          <p className="text-center">No notifications at this time.</p>
        ) : (
          <div className="space-y-4">
            {notifications.map((n) => {
              const lowerMsg = n.message.toLowerCase();
              let reviewMessage = n.message;
              // For generated tasks, shorten the message.
              if (lowerMsg.includes('generated task')) {
                reviewMessage = `New generated task assigned by ${n.sender?.username || 'Unknown'}.`;
              } else if (lowerMsg.includes('new message received')) {
                reviewMessage = `New message from ${n.sender?.username || 'Unknown'}.`;
              } else if (n.assignment_id && n.sender && n.sender.username) {
                reviewMessage = `You have a task to review from ${n.sender.username}.`;
              }
              return (
                <div
                  key={n.id}
                  className="card bg-base-100 shadow-lg p-4 rounded-lg flex flex-col sm:flex-row items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    {n.sender && n.sender.avatar_url ? (
                      <img
                        src={n.sender.avatar_url}
                        alt={n.sender.username || 'Sender'}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-base-300 flex items-center justify-center">
                        <span className="text-lg font-bold">
                          {n.sender && n.sender.username
                            ? n.sender.username.charAt(0).toUpperCase()
                            : '?'}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="font-bold">
                        {n.sender && n.sender.username ? n.sender.username : 'Unknown'}
                      </p>
                      <p className="text-sm text-gray-500">{formatRelativeTime(n.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-2 sm:mt-0">
                    <p className="text-lg">{reviewMessage}</p>
                    {n.assignment_id ? (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleReviewNotification(n)}
                      >
                        Review
                      </button>
                    ) : (
                      // For notifications without an assignment_id:
                      lowerMsg.includes('new message received') ? (
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => router.push('/messages')}
                        >
                          View Messages
                        </button>
                      ) : (lowerMsg.includes('challenge') || lowerMsg.includes('generated task')) && (
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => router.push('/mytasks')}
                        >
                          View My Tasks
                        </button>
                      )
                    )}
                    <button
                      className="btn btn-sm btn-error"
                      onClick={() => handleDeleteNotification(n.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
