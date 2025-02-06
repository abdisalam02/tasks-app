// app/hooks/useEnsureProfile.ts
'use client';

import { useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export default function useEnsureProfile() {
  useEffect(() => {
    async function ensureProfile() {
      // Get the current session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('Error getting session:', sessionError.message);
        return;
      }
      const session = sessionData?.session;
      if (!session) return;

      // Check if a profile for this user already exists
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching profile:', fetchError.message);
        return;
      }

      // If no profile exists, create one
      if (!existingProfile) {
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            user_id: session.user.id,
            score: 0,
            last_active: new Date().toISOString(),
            name: session.user.email, // using email as a fallback for name
            avatar_url: null,
          });
        if (insertError) {
          console.error('Error inserting profile:', insertError.message);
        }
      }
    }

    ensureProfile();
  }, []);
}
