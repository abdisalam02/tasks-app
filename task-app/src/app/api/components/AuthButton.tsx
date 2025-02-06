'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import { useRouter } from 'next/navigation';
// Import Session from Supabase
import { Session } from '@supabase/supabase-js';

export default function AuthButton() {
  const [session, setSession] = useState<Session | null>(null);
  const router = useRouter();

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
    };
    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Sign out error:', error.message);
    else {
      setSession(null);
      router.push('/signin');
    }
  };

  return (
    <button onClick={session ? handleSignOut : () => router.push('/signin')}>
      {session ? 'Sign Out' : 'Sign In'}
    </button>
  );
}
