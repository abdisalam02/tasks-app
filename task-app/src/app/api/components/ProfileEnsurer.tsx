'use client';

import useEnsureProfile from '../../hooks/useEnsureProfile';

export default function ProfileEnsurer() {
  // This component simply calls the hook.
  useEnsureProfile();
  return null;
}
