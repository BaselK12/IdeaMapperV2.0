import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import "../styles/MapCard.css";

export default function MapCard({
  map,
  ownerName,
  onOpen,
  onRename,
  onEditDescription,
  onDuplicate,
  onDelete,
  onLeave,
  isAdmin = false,
}) {
  const [openMenu, setOpenMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  // NEW: modal states
  const [showRename, setShowRename] = useState(false);
  const [showEditDesc, setShowEditDesc] = useState(false);
  const [tempValue, setTempValue] = useState("");

  const dotsBtnRef = useRef(null);
  const menuRef = useRef(null);
  const inputRef = useRef(null); // autofocus in modal

  const title = map?.name || "Untitled";
  const desc = map?.description || "";
  const updated = map?.last_edited ? new Date(map.last_edited).toLocaleDateString() : null;

  // Position menu near dots
  const computeMenuPos = useCallback(() => {
    const btn = dotsBtnRef.current;
    const menu = menuRef.current;
    if (!btn || !menu) return;

    const r = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 10;
    const w = menu.offsetWidth || 280;
    const h = menu.offsetHeight || 260;

    let left = r.right - w;
    let top = r.bottom + 8;

    if (left + w > vw - pad) left = vw - w - pad;
    if (left < pad) left = pad;
    if (top + h > vh - pad) top = r.top - h - 8;
    if (top < pad) top = pad;

    setMenuPos({ top, left });
  }, []);

  const openMenuNearDots = useCallback(() => {
    setOpenMenu((v) => !v);
  }, []);

  useEffect(() => {
    if (!openMenu) return;
    requestAnimationFrame(() => computeMenuPos());
    const onWin = () => computeMenuPos();
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [openMenu, computeMenuPos]);

  // Close menu on outside / Esc
  useEffect(() => {
    if (!openMenu) return;
    const onDoc = (e) => {
      if (e.key === "Escape") { setOpenMenu(false); return; }
      const target = e.target;
      const inMenu = menuRef.current && menuRef.current.contains(target);
      const inBtn = dotsBtnRef.current && dotsBtnRef.current.contains(target);
      if (!inMenu && !inBtn) setOpenMenu(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onDoc);
    };
  }, [openMenu]);

  // Autofocus input when modals open
  useEffect(() => {
    if (showRename || showEditDesc) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [showRename, showEditDesc]);

  // Modal handlers
  const openRenameModal = () => {
    if (!isAdmin) return;
    setOpenMenu(false);
    setTempValue(map?.name || "");
    setShowRename(true);
  };

  const openEditDescModal = () => {
    if (!isAdmin) return;
    setOpenMenu(false);
    setTempValue(map?.description || "");
    setShowEditDesc(true);
  };

  const closeModals = () => {
    setShowRename(false);
    setShowEditDesc(false);
  };

  const saveRename = () => {
    onRename?.({ ...map, name: tempValue.trim() });
    closeModals();
  };

  const saveEditDesc = () => {
    onEditDescription?.({ ...map, description: tempValue.trim() });
    closeModals();
  };

  const handleModalKey = (e) => {
    if (e.key === "Escape") closeModals();
    if (e.key === "Enter" && showRename) saveRename();
    // For description (textarea), only Ctrl/Cmd+Enter saves, Enter adds newline
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && showEditDesc) saveEditDesc();
  };

  return (
    <article className="mc" aria-label={`${title} card`}>
      {/* THUMB */}
      <div className="mc__thumb-layer" aria-hidden="true">
        <button
          className="mc__thumb"
          onClick={() => onOpen?.(map.id)}
          aria-label={`Open ${title}`}
          type="button"
        >
          <div className="mc__grid"></div>

          <div className="mc__center">
            <div className="mc__center-orb">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <div className="mc__center-text">Enter Map</div>
            <div className="mc__center-pulse"></div>
          </div>

          <div className="mc__shine"></div>
        </button>

        {/* animated dots */}
        <div className="mc__dots-wrapper">
          <button
            ref={dotsBtnRef}
            className="mc__dots-enhanced"
            aria-label="Menu"
            type="button"
            onClick={(e) => { e.stopPropagation(); openMenuNearDots(); }}
            data-active={openMenu}
          >
            <div className="mc__dots-container">
              <span className="mc__dot"></span>
              <span className="mc__dot"></span>
              <span className="mc__dot"></span>
            </div>
            <div className="mc__dots-ring"></div>
          </button>
        </div>
      </div>

      {/* BODY */}
      <div className="mc__body">
        <header className="mc__head">
          <div className="mc__title" title={title}>{title}</div>
          <div className="mc__status" aria-hidden="true"></div>
        </header>

        <div className="mc__subtitle">Interactive Map</div>

        <div className="mc__desc">
          {desc ? (
            <>
              <span className="mc__desc-bullet">»</span>
              <span className="mc__desc-text" title={desc}>{desc}</span>
            </>
          ) : (
            <span className="mc__desc-empty">
              No description provided. Add a description to guide users.
            </span>
          )}
        </div>

        <footer className="mc__foot">
          <div className="mc__owner" title={ownerName || ""}>
            <span className="mc__owner-avatar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
                <path d="M4 20a8 8 0 0 1 16 0" />
              </svg>
            </span>
            <span className="mc__owner-name">{ownerName}</span>
          </div>

          {updated && (
            <div className="mc__updated">
              <span className="mc__clock" aria-hidden="true">⏱</span>
              <span className="mc__updated-text">Modified {updated}</span>
            </div>
          )}
        </footer>
      </div>

      {/* MENU via portal */}
      {openMenu && createPortal(
        <div
          ref={menuRef}
          className="mc__menu"
          role="menu"
          style={{ top: `${menuPos.top}px`, left: `${menuPos.left}px` }}
        >
          <div className="mc__menu-h">
            <div className="mc__menu-tt">MAP ACTIONS</div>
            <div className="mc__menu-sub">Manage your spatial data</div>
          </div>

          <div className="mc__menu-items">
            <button
              role="menuitem"
              onClick={openRenameModal}
              disabled={!isAdmin}
              aria-disabled={!isAdmin}
              title={!isAdmin ? "Only admins can rename maps." : undefined}
            >
              <span className="mc__mi-ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </span>
              <span className="mc__mi-text">
                <b>Rename Map</b>
                <i>Update map title</i>
              </span>
              <span className="mc__mi-arrow">→</span>
            </button>

            <button
              role="menuitem"
              onClick={openEditDescModal}
              disabled={!isAdmin}
              aria-disabled={!isAdmin}
              title={!isAdmin ? "Only admins can edit descriptions." : undefined}
            >
              <span className="mc__mi-ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
              </span>
              <span className="mc__mi-text">
                <b>Edit Description</b>
                <i>Modify map details</i>
              </span>
              <span className="mc__mi-arrow">→</span>
            </button>

            <button role="menuitem" onClick={() => { setOpenMenu(false); onDuplicate?.(map); }}>
              <span className="mc__mi-ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              </span>
              <span className="mc__mi-text">
                <b>Duplicate</b>
                <i>Create a copy</i>
              </span>
              <span className="mc__mi-arrow">→</span>
            </button>

            <div className="mc__menu-div"></div>

            {isAdmin ? (
              <button
                className="is-danger"
                role="menuitem"
                onClick={() => {
                  setOpenMenu(false);
                  onDelete?.(map);
                }}
              >
                <span className="mc__mi-ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </span>
                <span className="mc__mi-text">
                  <b>Delete Map</b>
                  <i>Remove permanently</i>
                </span>
                <span className="mc__mi-arrow">⌫</span>
              </button>
            ) : (
              <button
                className="is-danger"
                role="menuitem"
                onClick={() => {
                  setOpenMenu(false);
                  onLeave?.(map);
                }}
              >
                <span className="mc__mi-ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                </span>
                <span className="mc__mi-text">
                  <b>Leave Map</b>
                  <i>Remove yourself from this map</i>
                </span>
                <span className="mc__mi-arrow">↩</span>
              </button>
            )}
          </div>

          <div className="mc__menu-f">ID: {map?.id?.slice(0, 8) || "N/A"}</div>
        </div>,
        document.body
      )}

      {/* SEPARATE POPUPS via portal */}
      {(showRename || showEditDesc) && createPortal(
        <div
          className="mc__overlay"
          onMouseDown={(e) => {
            // close if click on overlay
            if (e.target === e.currentTarget) closeModals();
          }}
          onKeyDown={handleModalKey}
          tabIndex={-1}
        >
          <div className="mc__popup" role="dialog" aria-modal="true">
            <h3>{showRename ? "Rename Map" : "Edit Description"}</h3>

            {showRename ? (
              <input
                ref={inputRef}
                className="mc__input"
                type="text"
                placeholder="Enter new map name..."
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
              />
            ) : (
              <textarea
                ref={inputRef}
                className="mc__textarea"
                rows={4}
                placeholder="Write a short description..."
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
              />
            )}

            <div className="mc__popup-buttons">
              <button
                className="mc__btn-cancel"
                type="button"
                onClick={closeModals}
              >
                Cancel
              </button>
              <button
                className="mc__btn-save"
                type="button"
                onClick={showRename ? saveRename : saveEditDesc}
                title={showEditDesc ? "Ctrl/Cmd + Enter to save" : "Enter to save"}
              >
                Save
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </article>
  );
}
