'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import { FaGamepad, FaBell, FaComments } from 'react-icons/fa'; // Replaced FaEnvelope with FaComments
import ThemeRandomizer from '../../api/components/ThemeRandomizer';

interface ProfileData {
  avatar_url?: string;
  username?: string;
}

export default function Navbar() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [notificationCount, setNotificationCount] = useState<number>(0);

  // Fetch session, profile, and unread notification count
  useEffect(() => {
    async function getSessionAndProfile() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);
      if (session) {
        const { data, error } = await supabase
          .from('profiles')
          .select('avatar_url, username')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (!error && data) {
          setProfile(data);
        }
        // Fetch unread notifications count
        const { count, error: countError } = await supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', session.user.id)
          .eq('is_read', false);
        if (!countError && typeof count === 'number') {
          setNotificationCount(count);
        }
      }
    }
    getSessionAndProfile();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        supabase
          .from('profiles')
          .select('avatar_url, username')
          .eq('user_id', session.user.id)
          .maybeSingle()
          .then(({ data, error }) => {
            if (!error && data) {
              setProfile(data);
            }
          });
      } else {
        setProfile(null);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/signin');
  };

  // Helper to close any open dropdown menu (for links that should close it)
  const closeDropdown = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setIsMenuOpen(false);
  };

  const avatarUrl = profile?.avatar_url || '/default-avatar.png';

  return (
    <nav className="navbar shadow-md bg-gradient-to-r from-indigo-700 to-purple-700 text-white z-50 relative">
      {/* Navbar Start: Mobile Menu */}
      <div className="navbar-start flex items-center">
        <div className="lg:hidden">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="btn btn-ghost"
            aria-label="Toggle Menu"
          >
            {isMenuOpen ? (
              // Close icon
              <svg
                className="fill-current"
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 512 512"
              >
                <polygon
                  points="400 145.49 366.51 112 256 222.51 145.49 112 112 145.49 222.51 256 112 366.51 145.49 400 256 289.49 366.51 400 400 366.51 289.49 256 400 145.49"
                />
              </svg>
            ) : (
              // Hamburger icon
              <svg
                className="fill-current"
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 512 512"
              >
                <path d="M64,384H448V341.33H64Zm0-106.67H448V234.67H64ZM64,128v42.67H448V128Z" />
              </svg>
            )}
          </button>
          {isMenuOpen && (
            <ul
              tabIndex={0}
              className="menu menu-compact absolute left-0 mt-3 p-2 shadow-lg bg-gradient-to-r from-indigo-500 to-purple-500 rounded-box w-52 text-white z-50"
            >
              {session && session.user ? (
                <>
                  <li onClick={closeDropdown}>
                    <Link href="/">Home</Link>
                  </li>
                  <li onClick={closeDropdown}>
                    <Link href="/users">Users</Link>
                  </li>
                  <li onClick={closeDropdown}>
                    <Link href="/mytasks">Tasks</Link>
                  </li>
                  <li onClick={closeDropdown}>
                    <Link href="/messages">Messages</Link>
                  </li>
                  {/* ThemeRandomizer item WITHOUT closeDropdown */}
                  <li>
                    <ThemeRandomizer />
                  </li>
                </>
              ) : (
                <li onClick={closeDropdown}>
                  <Link href="/signin">Sign In</Link>
                </li>
              )}
            </ul>
          )}
        </div>

        {/* Branding */}
        <Link
          href="/"
          className="btn btn-ghost normal-case flex items-center gap-2"
        >
          <FaGamepad className="text-4xl text-yellow-400 animate-bounce" />
          {/* Desktop branding */}
          <span className="hidden lg:inline font-bold tracking-wider text-2xl">
            I'm Bored App
          </span>
          {/* Mobile branding: reduced text size */}
          <span className="lg:hidden font-bold tracking-wider text-xl">
            Bored
          </span>
        </Link>
      </div>

      {/* Navbar Center: Desktop Menu */}
      {session && session.user && (
        <div className="navbar-center hidden lg:flex">
          <ul className="menu menu-horizontal p-0 space-x-4 text-lg">
            <li onClick={closeDropdown}>
              <Link href="/">Home</Link>
            </li>
            <li onClick={closeDropdown}>
              <Link href="/users">Users</Link>
            </li>
            <li onClick={closeDropdown}>
              <Link href="/mytasks">Tasks</Link>
            </li>
            <li onClick={closeDropdown}>
              <Link href="/messages">Messages</Link>
            </li>
            {/* ThemeRandomizer item WITHOUT closeDropdown */}
            <li>
              <ThemeRandomizer />
            </li>
          </ul>
        </div>
      )}

      {/* Navbar End: Profile & Notification Icons */}
      <div className="navbar-end flex items-center space-x-1 lg:space-x-2">
        {session && session.user ? (
          <>
            {/* Messaging icon/link */}
            <Link href="/messages" className="btn btn-ghost btn-circle">
              <FaComments className="h-6 w-6" />
            </Link>
            {/* Notifications icon with dot */}
            <Link href="/notifications" className="btn btn-ghost btn-circle relative">
              <FaBell className="h-6 w-6" />
              {notificationCount > 0 && (
                <span className="absolute top-0 right-0 inline-block w-3 h-3 bg-red-600 rounded-full"></span>
              )}
            </Link>
            {/* Profile Dropdown */}
            <div className="dropdown dropdown-end">
              <label tabIndex={0} className="btn btn-ghost btn-circle avatar">
                <div className="w-10 h-10 rounded-full">
                  <img src={avatarUrl} alt="Profile" className="object-cover" />
                </div>
              </label>
              <ul
                tabIndex={0}
                className="menu menu-compact dropdown-content mt-3 p-2 shadow-lg bg-gradient-to-r from-indigo-500 to-purple-500 rounded-box w-52 text-white z-50"
              >
                <li onClick={closeDropdown}>
                  <Link href="/profile">
                    <span className="justify-between">Profile</span>
                  </Link>
                </li>
                <li onClick={() => { closeDropdown(); handleLogout(); }} >
                  <button>Logout</button>
                </li>
              </ul>
            </div>
          </>
        ) : (
          <Link href="/signin" className="btn btn-primary">
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
}
