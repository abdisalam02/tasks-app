'use client';

import { useState, useEffect } from 'react';

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

export default function ThemeRandomizer() {
  const [currentTheme, setCurrentTheme] = useState<string>("light");

  useEffect(() => {
    // Check localStorage for an existing theme.
    const storedTheme = localStorage.getItem("selectedTheme");
    if (storedTheme && themes.includes(storedTheme)) {
      document.documentElement.setAttribute("data-theme", storedTheme);
      setCurrentTheme(storedTheme);
    } else {
      document.documentElement.setAttribute("data-theme", "light");
    }
  }, []);

  const randomizeTheme = () => {
    const randomTheme = themes[Math.floor(Math.random() * themes.length)];
    document.documentElement.setAttribute("data-theme", randomTheme);
    setCurrentTheme(randomTheme);
    localStorage.setItem("selectedTheme", randomTheme);
  };

  return (
    <button onClick={randomizeTheme} className="btn btn-secondary">
      Theme: {currentTheme}
    </button>
  );
}
