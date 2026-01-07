// Sidebar.jsx
import React from "react";
import "../styles/Sidebar.css";

const DEFAULT_AVATAR_URL = "/genericpp.png";

export default function Sidebar({
    active = "maps",
    user = {},
    onNav,
    onUpgrade,
    onSettings,
    onSignOut,
    theme = "light",
    onToggleTheme,
    isOpen = false,
    onClose,
}) {
    const avatarSrc = user?.profilePicture?.trim()
        ? user.profilePicture
        : DEFAULT_AVATAR_URL;
    const handleAvatarError = (e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = DEFAULT_AVATAR_URL;
    };

    return (
        <aside
            id="mobile-sidebar"
            className={`sb ${isOpen ? "sb--open" : ""}`}
            aria-label="Main navigation"
        >
            {/* Logo */}
            <button className="sb__logo" onClick={() => onNav?.("maps")}>
                <span className="sb__logo-dot" />
                <span className="sb__logo-text">IdeaMapper</span>
            </button>
            <button
                type="button"
                className="sb__close"
                aria-label="Close menu"
                onClick={onClose}
            >
                &times;
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
                    onClick={() => onToggleTheme?.()}
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
                        src={avatarSrc}
                        alt=""
                        className="sb__avatar"
                        onError={handleAvatarError}
                    />
                    <div className="sb__profile-info">
                        <div className="sb__profile-name">{user?.username || "User"}</div>
                        <div className="sb__profile-email">{user?.email || ""}</div>
                    </div>
                </button>

            </div>
        </aside>
    );
}
