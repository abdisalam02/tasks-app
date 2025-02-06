'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Session, AuthChangeEvent, Subscription } from '@supabase/supabase-js';

export default function SignInPage() {
  const [session, setSession] = useState<Session | null>(null);
  const router = useRouter();

  // State to toggle between OAuth and Email/Password sign in
  const [isEmailForm, setIsEmailForm] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    async function getSession() {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      // Do not automatically redirect if session exists
    }
    getSession();

    const { data } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        setSession(session);
        // Only redirect if a user signs in, not when a session is restored during logout.
        if (event === 'SIGNED_IN' && session) {
          router.push('/');
        }
      }
    );
    const subscription = data as unknown as { subscription: Subscription };
    return () => subscription.subscription.unsubscribe();
  }, [router]);

  // Handler for OAuth sign in.
  const handleOAuthSignIn = async (provider: string) => {
    const { error } = await supabase.auth.signInWithOAuth({ provider });
    if (error) console.error(`Error signing in with ${provider}:`, error.message);
  };

  // Handler for Email/Password sign in.
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-4">
      <div className="card w-full max-w-md shadow-2xl bg-base-100 p-8 rounded-lg transform hover:scale-105 transition-all duration-300">
        <h1 className="text-4xl font-extrabold text-center mb-6 text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
          Welcome Back!
        </h1>
        <p className="text-center text-lg mb-8 text-gray-700">
          Sign in to get started with I'm Bored
        </p>
        {isEmailForm ? (
          <form onSubmit={handleEmailSignIn} className="flex flex-col space-y-4">
            <input
              type="email"
              placeholder="Email"
              className="input input-bordered w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              className="input input-bordered w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <p className="text-center text-red-500">{error}</p>}
            <button type="submit" className="btn btn-primary">
              {loading ? 'Signing In...' : 'Sign in with Email'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setIsEmailForm(false)}
            >
              Use OAuth Instead
            </button>
          </form>
        ) : (
          <div className="flex flex-col space-y-4">
            <button
              className="btn btn-outline btn-primary flex items-center justify-center hover:bg-primary hover:text-white transition-colors duration-200"
              onClick={() => handleOAuthSignIn('github')}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="mr-2"
                width="24"
                height="24"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.38 7.86 10.88.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.87-1.54-3.87-1.54-.53-1.34-1.29-1.7-1.29-1.7-1.06-.73.08-.72.08-.72 1.17.08 1.79 1.2 1.79 1.2 1.04 1.78 2.73 1.27 3.4.97.11-.75.41-1.27.74-1.56-2.55-.29-5.23-1.27-5.23-5.64 0-1.25.45-2.27 1.2-3.07-.12-.3-.52-1.52.12-3.17 0 0 .98-.31 3.2 1.18a11.2 11.2 0 0 1 2.92-.39c.99 0 1.98.13 2.92.39 2.22-1.5 3.2-1.18 3.2-1.18.64 1.65.24 2.87.12 3.17.75.8 1.2 1.82 1.2 3.07 0 4.38-2.68 5.34-5.23 5.63.42.37.8 1.11.8 2.24 0 1.62-.02 2.93-.02 3.33 0 .31.21.68.8.56C20.71 21.38 24 17.08 24 12 24 5.73 18.27.5 12 .5z" />
              </svg>
              Sign in with GitHub
            </button>
            <button
              className="btn btn-outline btn-secondary flex items-center justify-center hover:bg-secondary hover:text-white transition-colors duration-200"
              onClick={() => handleOAuthSignIn('google')}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="mr-2"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M21.35 11.1h-9.18v2.83h5.33c-.23 1.22-.94 2.25-2.02 2.94v2.45h3.26c1.91-1.76 3-4.36 3-7.22 0-.65-.06-1.27-.17-1.87z" fill="#4285F4" />
                <path d="M12.17 22c2.73 0 5.03-.91 6.71-2.47l-3.26-2.45c-.91.61-2.06.97-3.45.97-2.66 0-4.92-1.8-5.73-4.22H3.14v2.66A9.87 9.87 0 0 0 12.17 22z" fill="#34A853" />
                <path d="M6.44 13.34a5.9 5.9 0 0 1 0-3.66V7.02H3.14a9.87 9.87 0 0 0 0 9.96l3.3-2.64z" fill="#FBBC05" />
                <path d="M12.17 6.58c1.48 0 2.81.51 3.86 1.5l2.9-2.9C17.18 3.45 14.87 2.5 12.17 2.5a9.87 9.87 0 0 0-9.03 5.52l3.3 2.64c.81-2.42 3.07-4.22 5.73-4.22z" fill="#EA4335" />
              </svg>
              Sign in with Google
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setIsEmailForm(true)}
            >
              Sign in with Email
            </button>
          </div>
        )}
        <div className="mt-4 text-center">
          <p className="text-sm">
            Don't have an account?{' '}
            <a href="/signup" className="link link-primary">
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
