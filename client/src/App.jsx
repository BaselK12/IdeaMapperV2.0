// App.jsx (Supabase version with ResetPassword route)
import React, { useState, useEffect, useLayoutEffect } from "react";
import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import LoginPage from "./components/LoginPage";
import Dashboard from "./components/Dashboard";
import MapEditor from "./components/MapEditor";
import ResetPassword from "./components/ResetPassword"; // ✅ Added import
import { supabase } from "./supabaseClient";
import io from "socket.io-client";

// Setup Socket.IO client
const socket = io("http://localhost:5000");

const App = () => {
  const [session, setSession] = useState(null);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("theme") || "light";
    } catch {
      return "light";
    }
  });

  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("theme", theme);
    } catch { }
  }, [theme]);

  // Supabase auth listener
  useEffect(() => {
    let mounted = true;

    // Get initial session
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
    });

    // Subscribe to auth changes (login, logout, password recovery, etc.)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
    });

    // Setup socket listeners
    socket.on("connect", () => {
      console.log("Socket connected with ID:", socket.id);
    });
    socket.on("mapUpdate", (data) => {
      console.log("Map update received via socket:", data);
    });

    return () => {
      mounted = false;
      socket.off("connect");
      socket.off("mapUpdate");
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // If user not logged in, show login page
  if (!session) {
    return <LoginPage onLogin={() => { /* session listener above will handle rerender */ }} />;
  }

  // If logged in, load the router
  return (
    <BrowserRouter>
      <Routes>
        {/* Dashboard Route */}
        <Route
          path="/"
          element={
            <Dashboard
              theme={theme}
              onToggleTheme={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            />
          }
        />

        {/* Password Reset Route */}
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Map Editor Route */}
        <Route path="/map/:mapId" element={<MapEditorWithParams />} />
      </Routes>
    </BrowserRouter>
  );
};

// Map Editor with URL params
const MapEditorWithParams = () => {
  const { mapId } = useParams();
  return <MapEditor mapId={mapId} />;
};

// Optional: silence ResizeObserver loop error spam
const resizeObserverLoopErr = /ResizeObserver loop limit exceeded/;
const originalConsoleError = console.error;
console.error = (message, ...args) => {
  if (resizeObserverLoopErr.test(message)) return;
  originalConsoleError(message, ...args);
};

export default App;
