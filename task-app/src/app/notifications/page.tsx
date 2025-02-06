'use client';

import { useEffect, useState } from 'react';
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

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [toast, setToast] = useState<string>('');

  // Fetch notifications for the currently logged-in user.
  const fetchNotifications = async (userId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('*, sender:profiles!fk_sender(username, avatar_url)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      setNotifications(data || []);
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

  // Delete a notification and then navigate to the review page.
  const handleReviewNotification = async (notif: Notification) => {
    // Delete the notification row.
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notif.id);
    if (error) {
      console.error('Error deleting notification:', error.message);
      setToast(`Error deleting notification: ${error.message}`);
    } else {
      // Remove the notification from local state.
      setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
      // Navigate to the review submissions page if assignment_id is present.
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        const newNotif = payload.new as Notification;
        if (newNotif.user_id === currentUserId) {
          setNotifications((prev) => [newNotif, ...prev]);
          setToast('You have a new notification!');
        }
      })
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
              const reviewMessage =
                n.assignment_id && n.sender && n.sender.username
                  ? `You have a task to review from ${n.sender.username}.`
                  : n.message;
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
                    {n.assignment_id && (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleReviewNotification(n)}
                      >
                        Review
                      </button>
                    )}
                    <button className="btn btn-sm btn-error" onClick={() => handleDeleteNotification(n.id)}>
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
