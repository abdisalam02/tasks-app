'use client';

import { useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function useCheckProfileCompletion() {
  const router = useRouter();

  useEffect(() => {
    async function checkProfile() {
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Fetch the user's profile (only selecting user_id and username)
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('user_id, username')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error.message);
        return;
      }

      // If the profile exists and the username is missing or empty, redirect to complete-profile
      if (profile && (!profile.username || profile.username.trim() === '')) {
        router.push('/complete-profile');
      }
    }
    checkProfile();
  }, [router]);
}
