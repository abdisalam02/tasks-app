'use client';

import { useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function CompleteProfilePage() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Get the current session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError('No active session.');
      return;
    }

    // Update the profiles table with the custom username
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ username: username })
      .eq('user_id', session.user.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    // After updating, redirect to the home page
    router.push('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 p-4">
      <div className="card max-w-md w-full bg-base-100 shadow-xl rounded-lg p-8">
        <h1 className="text-3xl font-bold text-center mb-6">Complete Your Profile</h1>
        {error && <p className="text-center text-red-500 mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">
              <span className="label-text">Username</span>
            </label>
            <input
              type="text"
              placeholder="Enter your desired username"
              className="input input-bordered w-full"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary w-full">
            Save Profile
          </button>
        </form>
      </div>
    </div>
  );
}
