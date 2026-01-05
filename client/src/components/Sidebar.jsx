// Sidebar.jsx
import React, { useEffect, useState } from "react";
import "../styles/Sidebar.css";

export default function Sidebar({ active = "maps", user = {}, onNav, onUpgrade, onSettings, onSignOut }) {
    const [theme, setTheme] = useState("light");
    // Load saved theme on mount
    useEffect(() => {
        const saved = localStorage.getItem("theme");
        if (saved) setTheme(saved);
    }, []);

    // Apply theme to document root and remember preference
    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("theme", theme);
    }, [theme]);

    return (
        <aside className="sb" aria-label="Main navigation">
            {/* Logo */}
            <button className="sb__logo" onClick={() => onNav?.("maps")}>
                <span className="sb__logo-dot" />
                <span className="sb__logo-text">IdeaMapper</span>
            </button>

            {/* Nav */}
            <nav className="sb__nav">
                <button
                    className={`sb__item ${active === "maps" ? "is-active" : ""}`}
                    onClick={() => onNav?.("maps")}
                >
                    <span className="sb__icon">🗺️</span>
                    <span className="sb__label">My Maps</span>
                </button>

                <button
                    className="sb__item"
                    onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                >
                    <span className="sb__icon">{theme === "light" ? "🌙" : "☀️"}</span>
                    <span className="sb__label">
                        {theme === "light" ? "Dark Mode" : "Light Mode"}
                    </span>
                </button>

                <button
                    className={`sb__item ${active === "upgrade" ? "is-active" : ""}`}
                    onClick={onUpgrade}
                    >
                    <span className="sb__icon">💎</span>
                    <span className="sb__label">Upgrade Plan</span>
                    </button>

            </nav>

            {/* Footer / Profile */}
            <div className="sb__footer">
                <button className="sb__profile" onClick={onSettings}>
                    <img
                        src={user?.profilePicture || "/genericpp.png"}
                        alt=""
                        className="sb__avatar"
                    />
                    <div className="sb__profile-info">
                        <div className="sb__profile-name">{user?.username || "User"}</div>
                        <div className="sb__profile-email">{user?.email || ""}</div>
                    </div>
                </button>

                <button className="sb__signout" onClick={onSignOut}>
                    Sign out
                </button>
            </div>
        </aside>
    );
}
