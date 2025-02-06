'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

const themes = [
  "light",
  "dark",
  "cupcake",
  "bumblebee",
  "emerald",
  "corporate",
  "synthwave",
  "retro",
  "cyberpunk",
  "valentine",
  "halloween",
  "garden",
  "forest",
  "aqua",
  "lofi",
  "pastel",
  "fantasy",
  "wireframe",
  "black",
  "luxury",
  "dracula",
  "cmyk",
  "autumn",
  "business",
  "acid",
  "lemonade",
  "night",
  "coffee",
  "winter",
  "dim",
  "nord",
  "sunset",
];

interface Profile {
  user_id: string;
  username?: string;
  avatar_url?: string;
  // Optionally, you may have score, completed_challenges, etc.
}

export default function UserProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // State for updating username
  const [newUsername, setNewUsername] = useState<string>('');
  const [usernameLoading, setUsernameLoading] = useState<boolean>(false);

  // State for updating profile picture
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);

  // Toast state for popup notifications.
  const [toast, setToast] = useState<string>('');

  // State for theme preference.
  const [selectedTheme, setSelectedTheme] = useState<string>("light");

  const router = useRouter();

  // Fetch profile data for current user.
  const fetchProfile = async () => {
    setLoadingProfile(true);
    setError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    if (!session) {
      setError("You must be logged in to view your profile.");
      setLoadingProfile(false);
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, username, avatar_url')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (error) {
      setError(error.message);
    } else if (!data) {
      setError("Profile not found. Please ensure your profile row exists.");
    } else {
      setProfile(data);
      setNewUsername(data.username || '');
    }
    setLoadingProfile(false);
  };

  useEffect(() => {
    fetchProfile();
    // Initialize theme from localStorage if available.
    const storedTheme = localStorage.getItem("selectedTheme");
    if (storedTheme && themes.includes(storedTheme)) {
      setSelectedTheme(storedTheme);
      document.documentElement.setAttribute("data-theme", storedTheme);
    } else {
      document.documentElement.setAttribute("data-theme", "light");
    }
  }, []);

  // Handler for file input change.
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  // Handler to update profile picture.
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = fileName;

    const { error: uploadError } = await supabase
      .storage
      .from('profile-pictures')
      .upload(filePath, file);
    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { data: { publicUrl }, error: urlError } = supabase
      .storage
      .from('profile-pictures')
      .getPublicUrl(filePath);
    if (urlError) {
      setError(urlError.message);
      setUploading(false);
      return;
    }
    if (publicUrl) {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      if (!session) {
        setError("You must be logged in to update your profile.");
      } else {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ avatar_url: publicUrl })
          .eq('user_id', session.user.id);
        if (updateError) {
          setError(updateError.message);
        } else {
          setToast('Profile picture updated!');
          fetchProfile();
        }
      }
    }
    setUploading(false);
  };

  // Handler to update username.
  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername) return;
    setUsernameLoading(true);
    setError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    if (!session) {
      setError("You must be logged in to update your profile.");
      setUsernameLoading(false);
      return;
    }
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ username: newUsername })
      .eq('user_id', session.user.id);
    if (updateError) {
      setError(updateError.message);
    } else {
      setToast('Username updated!');
      fetchProfile();
    }
    setUsernameLoading(false);
  };

  // Handler for theme selection.
  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const theme = e.target.value;
    setSelectedTheme(theme);
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("selectedTheme", theme);
  };

  // Automatically hide toast after 3 seconds.
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  return (
    <div className="min-h-screen bg-base-200 text-base-content p-8">
      <div className="container mx-auto max-w-3xl space-y-10">
        {/* Hero Profile Section */}
        <div className="relative rounded-xl overflow-hidden shadow-2xl">
          <div
            className="absolute inset-0 bg-cover bg-center filter brightness-50"
            style={{ backgroundImage: "url('https://source.unsplash.com/1600x900/?nature,water')" }}
          ></div>
          <div className="relative z-10 flex flex-col items-center p-8">
            <div className="avatar">
              <div className="w-36 rounded-full ring ring-primary ring-offset-4 cursor-pointer transform hover:scale-110 transition-transform duration-300">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Profile Picture"
                    className="object-cover"
                    onClick={() => window.open(profile.avatar_url, '_blank')}
                  />
                ) : (
                  <div className="flex items-center justify-center bg-gray-700 w-full h-full rounded-full">
                    <span className="text-5xl font-bold text-gray-300">
                      {profile?.username ? profile.username.charAt(0).toUpperCase() : '?'}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <h1 className="mt-6 text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
              {profile?.username || "No username set"}
            </h1>
          </div>
        </div>

        {/* Update Profile Picture */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-2xl text-primary">Update Profile Picture</h2>
            <form onSubmit={handleUpload} className="mt-4 flex flex-col items-center space-y-4">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="file-input file-input-bordered w-full max-w-xs"
              />
              <button type="submit" className="btn btn-primary w-full max-w-xs" disabled={uploading}>
                {uploading ? 'Uploading...' : 'Upload New Picture'}
              </button>
            </form>
          </div>
        </div>

        {/* Update Username */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-2xl">Change Username</h2>
            <form onSubmit={handleUpdateUsername} className="mt-4 space-y-4">
              <input
                type="text"
                placeholder="Enter new username"
                className="input input-bordered w-full"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
              />
              <button type="submit" className="btn btn-primary w-full" disabled={usernameLoading}>
                {usernameLoading ? 'Updating...' : 'Update Username'}
              </button>
            </form>
          </div>
        </div>

        {/* Theme Selector */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-2xl">Select Preferred Theme</h2>
            <div className="mt-4">
              <select 
                className="select select-bordered w-full"
                value={selectedTheme}
                onChange={handleThemeChange}
              >
                {themes.map((theme) => (
                  <option key={theme} value={theme}>
                    {theme.charAt(0).toUpperCase() + theme.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Popup */}
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
