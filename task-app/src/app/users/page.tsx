'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { FaChevronDown, FaChevronUp, FaTrophy, FaCrown } from 'react-icons/fa';

interface UserData {
  user_id: string;
  score: number;
  last_active: string;
  username?: string;
  email?: string;
  avatar_url?: string;
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData?.session;
        if (session) {
          setCurrentUserId(session.user.id);
        }
        const res = await fetch('/api/users');
        const data = await res.json();
        if (res.ok) {
          setUsers(data);
        } else {
          setError(data.error || 'Error fetching users');
        }
      } catch (err: any) {
        setError('Error fetching users');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, []);

  // Leaderboard sorted by score descending.
  const leaderboard = [...users].sort((a, b) => b.score - a.score);

  // Active players: filter out the logged-in user.
  const activePlayers = currentUserId ? users.filter(user => user.user_id !== currentUserId) : users;

  const handleUserClick = (user: UserData) => {
    router.push(`/users/${user.user_id}`);
  };

  return (
    <div className="min-h-screen bg-base-200 p-6 text-base-content">
      <div className="container mx-auto max-w-4xl">
        {/* Toggleable Leaderboard Section */}
        <section className="mb-10">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FaTrophy className="text-yellow-400" />
              Leaderboard
            </h1>
            <button
              className="text-base-content hover:text-white transition-colors duration-300"
              onClick={() => setShowLeaderboard(prev => !prev)}
            >
              {showLeaderboard ? (
                <FaChevronUp className="h-6 w-6 animate-bounce" />
              ) : (
                <FaChevronDown className="h-6 w-6 animate-bounce" />
              )}
            </button>
          </div>
          {loading ? (
            <p className="text-center">Loading leaderboard...</p>
          ) : error ? (
            <p className="text-center text-error">{error}</p>
          ) : showLeaderboard ? (
            <div className="overflow-x-auto mt-4">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Player</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.slice(0, 10).map((user, index) => (
                    <tr
                      key={user.user_id}
                      className="hover:bg-base-300 cursor-pointer"
                      onClick={() => handleUserClick(user)}
                    >
                      <td className="font-bold">{index + 1}</td>
                      <td className="flex items-center space-x-2">
                        <div className="relative">
                          {user.avatar_url ? (
                            <img
                              src={user.avatar_url}
                              alt="Avatar"
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-base-300 flex items-center justify-center">
                              <span className="text-sm font-bold">
                                {user.username ? user.username.charAt(0).toUpperCase() : '?'}
                              </span>
                            </div>
                          )}
                          {index === 0 && (
                            <FaCrown className="absolute -top-2 -right-2 text-yellow-400 h-5 w-5" />
                          )}
                        </div>
                        <span>{user.username || user.email || 'Unknown'}</span>
                      </td>
                      <td className="font-bold">{user.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            leaderboard[0] && (
              <div
                className="mt-4 p-4 rounded-lg bg-gradient-to-r from-yellow-500 to-orange-500 cursor-pointer flex items-center gap-4 hover:scale-105 transition transform"
                onClick={() => setShowLeaderboard(true)}
              >
                <div className="relative">
                  {leaderboard[0].avatar_url ? (
                    <img
                      src={leaderboard[0].avatar_url}
                      alt="Top Player Avatar"
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-base-300 flex items-center justify-center">
                      <span className="text-lg font-bold">
                        {leaderboard[0].username ? leaderboard[0].username.charAt(0).toUpperCase() : '?'}
                      </span>
                    </div>
                  )}
                  <FaCrown className="absolute -top-2 -right-2 text-yellow-400 h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">
                    {leaderboard[0].username || leaderboard[0].email || 'Unknown'}
                  </p>
                  <p>Score: {leaderboard[0].score}</p>
                </div>
                <FaChevronDown className="h-6 w-6" />
              </div>
            )
          )}
        </section>

        {/* Active Players Section */}
        <section>
          <header className="mb-10 text-center">
            <h1 className="text-4xl font-bold">Active Players</h1>
            <p className="mt-2 text-gray-400">
              Select a player to view details and challenge them!
            </p>
          </header>
          {loading ? (
            <p className="text-center">Loading players...</p>
          ) : error ? (
            <p className="text-center text-error">{error}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {users
                .filter(user => user.user_id !== currentUserId)
                .map((user) => (
                  <div
                    key={user.user_id}
                    className="card bg-base-100 shadow-xl p-4 rounded-lg cursor-pointer hover:scale-105 transition duration-300 border border-base-300"
                    onClick={() => handleUserClick(user)}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="avatar">
                        <div className="w-16 h-16 rounded-full overflow-hidden">
                          {user.avatar_url ? (
                            <img
                              src={user.avatar_url}
                              alt="Avatar"
                              className="object-cover w-full h-full"
                            />
                          ) : (
                            <div className="flex items-center justify-center bg-base-300 w-full h-full">
                              <span className="text-2xl font-bold">
                                {user.username ? user.username.charAt(0).toUpperCase() : user.email ? user.email.charAt(0).toUpperCase() : '?'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold">
                          {user.username || user.email || 'Unknown'}
                        </h2>
                        <p className="text-gray-400">Score: {user.score}</p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
