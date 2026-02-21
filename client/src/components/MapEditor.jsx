// MapEditor.jsx
import React, { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ReactFlow, {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  MiniMap,
  Background,
  BackgroundVariant,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";
import { supabase } from "../supabaseClient";
import {
  canEdit as canEditPermission,
  canView as canViewPermission,
  isAdmin as isAdminPermission,
  normalizeRole,
} from "../permissions";
import "../styles/MapEditor.css";

const DEFAULT_AVATAR_URL = "/genericpp.png";
const handleAvatarError = (e) => {
  e.currentTarget.onerror = null;
  e.currentTarget.src = DEFAULT_AVATAR_URL;
};

// --- String helpers: single source for node name ---
const getNodeTitle = (node) =>
  (node && node.data && typeof node.data.title === "string" ? node.data.title : "") || "";

const setNodeTitle = (node, nextTitle) => ({
  ...node,
  data: { ...node.data, title: String(nextTitle ?? ""), isEditing: false },
});

const extractBorderColor = (node) => {
  const style = node?.style || {};
  if (style.borderColor) return style.borderColor;
  if (typeof style.border === "string") {
    const parts = style.border.split(" ");
    return parts[parts.length - 1];
  }
  return "";
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const hexToRgb = (hex) => {
  if (!hex) return null;
  const clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return { r, g, b };
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return { r, g, b };
  }
  return null;
};

const rgbToHex = (r, g, b) =>
  `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

const rgbToHsl = (r, g, b) => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / delta + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / delta + 2;
        break;
      default:
        h = (rn - gn) / delta + 4;
        break;
    }
    h *= 60;
  }

  return { h, s, l };
};

const hslToRgb = (h, s, l) => {
  const hue = ((h % 360) + 360) % 360;
  const hn = hue / 360;

  if (s === 0) {
    const value = Math.round(l * 255);
    return { r: value, g: value, b: value };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hueToRgb = (t) => {
    let temp = t;
    if (temp < 0) temp += 1;
    if (temp > 1) temp -= 1;
    if (temp < 1 / 6) return p + (q - p) * 6 * temp;
    if (temp < 1 / 2) return q;
    if (temp < 2 / 3) return p + (q - p) * (2 / 3 - temp) * 6;
    return p;
  };

  return {
    r: Math.round(hueToRgb(hn + 1 / 3) * 255),
    g: Math.round(hueToRgb(hn) * 255),
    b: Math.round(hueToRgb(hn - 1 / 3) * 255),
  };
};

const deriveAccentColor = (hex) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#23c6f7";
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const nextS = clamp(s, 0.35, 0.75);
  const nextL = clamp(l, 0.35, 0.6);
  const { r, g, b } = hslToRgb(h, nextS, nextL);
  return rgbToHex(r, g, b);
};

const normalizeHex = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const candidate = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(candidate)) return null;
  return candidate.toUpperCase();
};

const copyToClipboard = async (text) => {
  if (!text) return;
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {}
  }
  try {
    const temp = document.createElement("textarea");
    temp.value = text;
    temp.setAttribute("readonly", "");
    temp.style.position = "absolute";
    temp.style.left = "-9999px";
    document.body.appendChild(temp);
    temp.select();
    document.execCommand("copy");
    document.body.removeChild(temp);
  } catch {}
};

const BLOCK_SNIPPET_LIMIT = 90;

const makeBlockId = (prefix = "block") => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
};

const normalizeBlockText = (value) => (typeof value === "string" ? value.trim() : "");

const collapseWhitespace = (value) => value.replace(/\s+/g, " ").trim();

const normalizeTagValue = (value) => collapseWhitespace(String(value ?? "")).trim();

const splitTagInput = (value) =>
  String(value || "")
    .split(",")
    .map((part) => normalizeTagValue(part))
    .filter(Boolean);

const dedupeTags = (tags) => {
  const seen = new Set();
  return (tags || []).filter((tag) => {
    const key = String(tag || "").toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getNodeTags = (node) => (Array.isArray(node?.data?.tags) ? node.data.tags : []);

const getNodeType = (node) => {
  const value = node?.data?.nodeType;
  return NODE_TYPE_OPTIONS.includes(value) ? value : NODE_TYPE_DEFAULT;
};

const MEDIA_BUCKET = process.env.REACT_APP_MEDIA_BUCKET || "node-media";
const HAS_SUPABASE_STORAGE = Boolean(
  process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_ANON_KEY
);
const LOCAL_MEDIA_UPLOAD_MAX_BYTES = 3 * 1024 * 1024; // 3MB cap for dev-only localStorage fallback
const IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);
const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const VIDEO_EXTS = new Set(["mp4", "webm", "mov"]);

const getFileExtension = (value) => {
  if (!value || typeof value !== "string") return "";
  const clean = value.split("?")[0].split("#")[0];
  const parts = clean.split(".");
  if (parts.length < 2) return "";
  return parts.pop().toLowerCase();
};

const isAllowedMediaFile = (file, kind) => {
  if (!file) return false;
  const ext = getFileExtension(file.name);
  if (kind === "image") {
    return IMAGE_MIME_TYPES.has(file.type) || IMAGE_EXTS.has(ext);
  }
  if (kind === "video") {
    return VIDEO_MIME_TYPES.has(file.type) || VIDEO_EXTS.has(ext);
  }
  return false;
};

const getMediaValidationError = (file, kind) => {
  if (!file) return "Choose a file to upload.";
  if (!isAllowedMediaFile(file, kind)) {
    return kind === "image"
      ? "Images must be PNG, JPG, JPEG, WEBP, or GIF."
      : "Videos must be MP4, WebM, or MOV.";
  }
  return "";
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });

const isDirectVideoUrl = (url) => {
  const clean = normalizeBlockText(url);
  if (!clean) return false;
  if (clean.startsWith("blob:") || clean.startsWith("data:video")) return true;
  const ext = getFileExtension(clean);
  return ext === "mp4" || ext === "webm" || ext === "mov";
};

const getVideoEmbedUrl = (url) => {
  const clean = normalizeBlockText(url);
  if (!clean) return "";
  const ytMatch = clean.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/
  );
  if (ytMatch?.[1]) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = clean.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch?.[1]) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return "";
};

const buildLegacyBlocks = (note, link, createdAt) => {
  const blocks = [];
  const noteText = normalizeBlockText(note);
  const linkText = normalizeBlockText(link);
  const stamp = createdAt || new Date().toISOString();

  if (noteText) {
    blocks.push({ id: makeBlockId("text"), type: "text", text: noteText, createdAt: stamp });
  }
  if (linkText) {
    blocks.push({ id: makeBlockId("link"), type: "link", url: linkText, label: "", createdAt: stamp });
  }
  return blocks;
};

const migrateNodeData = (nodesList, notes, data) => {
  const nextData = { ...(data || {}) };
  let changed = false;

  (nodesList || []).forEach((node) => {
    if (!node?.id) return;
    const entry = nextData[node.id] || {};
    const existingBlocks = Array.isArray(entry.blocks) ? entry.blocks : [];

    if (!Array.isArray(entry.blocks) && entry.blocks !== undefined) {
      nextData[node.id] = { ...entry, blocks: [] };
      changed = true;
      return;
    }

    if (existingBlocks.length > 0) return;

    const note = notes?.[node.id];
    const link = entry.link;
    const legacyBlocks = buildLegacyBlocks(note, link, node.creationTimestamp);
    if (legacyBlocks.length) {
      nextData[node.id] = { ...entry, blocks: legacyBlocks };
      changed = true;
    }
  });

  return { nodeData: nextData, changed };
};

const getSnippetFromBlocks = (blocks) => {
  if (!Array.isArray(blocks)) return "";
  for (const block of blocks) {
    if (block?.type !== "text") continue;
    const text = normalizeBlockText(block.text);
    if (!text) continue;
    const clean = collapseWhitespace(text);
    if (clean.length <= BLOCK_SNIPPET_LIMIT) return clean;
    return `${clean.slice(0, BLOCK_SNIPPET_LIMIT).trimEnd()}...`;
  }
  return "";
};

const getBlockTypePresence = (blocks) => {
  if (!Array.isArray(blocks)) {
    return { hasText: false, hasImage: false, hasVideo: false, hasLink: false };
  }
  let hasText = false;
  let hasImage = false;
  let hasVideo = false;
  let hasLink = false;

  blocks.forEach((block) => {
    if (!block) return;
    if (block.type === "text" && normalizeBlockText(block.text)) hasText = true;
    if (block.type === "image" && normalizeBlockText(block.url)) hasImage = true;
    if (block.type === "video" && normalizeBlockText(block.url)) hasVideo = true;
    if (block.type === "link" && normalizeBlockText(block.url)) hasLink = true;
  });

  return { hasText, hasImage, hasVideo, hasLink };
};

const pickPrimaryTextFromBlocks = (blocks) => {
  if (!Array.isArray(blocks)) return "";
  for (const block of blocks) {
    if (block?.type !== "text") continue;
    const text = normalizeBlockText(block.text);
    if (text) return text;
  }
  return "";
};

const pickPrimaryLinkFromBlocks = (blocks) => {
  if (!Array.isArray(blocks)) return "";
  for (const block of blocks) {
    if (block?.type !== "link") continue;
    const url = normalizeBlockText(block.url);
    if (url) return url;
  }
  return "";
};

const ColorControl = ({ id, label, value, onChange, onCopy, pickerTitle, disabled = false }) => {
  const [hexValue, setHexValue] = useState(value);

  useEffect(() => {
    setHexValue(value);
  }, [value]);

  const handleHexChange = (event) => {
    const next = event.target.value;
    setHexValue(next);
    const normalized = normalizeHex(next);
    if (normalized) {
      onChange(normalized);
    }
  };

  const handleHexBlur = () => {
    const normalized = normalizeHex(hexValue);
    if (normalized) {
      setHexValue(normalized);
    } else {
      setHexValue(value);
    }
  };

  return (
    <div className="me-field">
      <label className="me-label" htmlFor={id}>
        {label}
      </label>
      <div className="colorControl">
        <input
          id={id}
          type="color"
          className="me-color colorControlPicker"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          title={pickerTitle}
          aria-label={`${label} picker`}
          disabled={disabled}
        />
        <input
          type="text"
          className="colorHexInput"
          value={hexValue}
          onChange={handleHexChange}
          onBlur={handleHexBlur}
          spellCheck={false}
          aria-label={`${label} hex value`}
          disabled={disabled}
        />
        <button type="button" className="colorCopyButton" onClick={() => onCopy(value)} disabled={disabled}>
          Copy
        </button>
      </div>
    </div>
  );
};

// --- Small helper UI for context menu ---
const ContextMenu = ({ onAddNode, onRename, onClose, position }) => {
  if (!position) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        zIndex: 1000,
        padding: "8px",
      }}
      className="context-menu glass"
    >
      <button
        onClick={() => {
          onAddNode();
          onClose();
        }}
        style={{
          display: "block",
          width: "100%",
          padding: "8px 12px",
          textAlign: "left",
          border: "none",
          backgroundColor: "transparent",
          cursor: "pointer",
          borderRadius: "2px",
        }}
      >
        Add Node
      </button>
      <button
        onClick={() => {
          onRename();
          onClose();
        }}
        style={{
          display: "block",
          width: "100%",
          padding: "8px 12px",
          textAlign: "left",
          border: "none",
          backgroundColor: "transparent",
          cursor: "pointer",
          borderRadius: "2px",
        }}
      >
        Rename Node
      </button>
    </div>
  );
};

const SidebarSection = ({ id, title, activeId, onToggle, children, sectionRef, alwaysOpen = false }) => {
  const isOpen = alwaysOpen ? true : activeId === id;
  const bodyId = `sidebar-section-body-${id}`;
  const headerContent = (
    <>
      <span>{title}</span>
      {!alwaysOpen && <span className={`sidebarChevron ${isOpen ? "is-open" : ""}`}>&gt;</span>}
    </>
  );
  return (
    <section
      className={`sidebarSection glass ${isOpen ? "is-open" : ""} ${alwaysOpen ? "is-static" : ""}`}
      ref={sectionRef}
    >
      {alwaysOpen ? (
        <div className="sidebarSectionHeader is-static">{headerContent}</div>
      ) : (
        <button
          type="button"
          className="sidebarSectionHeader"
          onClick={() => onToggle(id)}
          aria-expanded={isOpen}
          aria-controls={bodyId}
        >
          {headerContent}
        </button>
      )}
      {isOpen && (
        <div id={bodyId} className="sidebarSectionBody">
          {children}
        </div>
      )}
    </section>
  );
};

const predefinedColors = [
  "#FF5733",
  "#33FF57",
  "#3357FF",
  "#FF33A8",
  "#A833FF",
  "#33FFF5",
  "#FFC233",
  "#FF3333",
  "#33FF8E",
  "#8E33FF",
  "#FF8E33",
  "#33A8FF",
  "#57FF33",
];

const LOCAL_BG_STYLE_KEY = "mapEditor:bgStyle";
const LOCAL_BG_COLOR_KEY = "mapEditor:bgColor";
const LOCAL_NODE_PRESET_KEY = "mapEditor:lastPreset";
const LOCAL_NODE_BORDER_KEY = "mapEditor:lastBorderColor";

const LOCAL_CURSOR_SHOW_KEY = "mapEditor:showMyCursor";
const LOCAL_CURSOR_FPS_KEY = "mapEditor:cursorFps";

const LOCAL_CURSOR_SHOW_OTHERS_KEY = "mapEditor:showOthersCursors";

const DEFAULT_EDGE_STYLE = { stroke: "#64748B", strokeOpacity: 0.45, strokeWidth: 2 };

const NODE_STYLE_PRESETS = [
  { id: "idea", label: "Idea", borderColor: "#0EA5E9" },
  { id: "question", label: "Question", borderColor: "#F59E0B" },
  { id: "important", label: "Important", borderColor: "#EF4444" },
  { id: "source", label: "Source", borderColor: "#10B981" },
];

const NODE_TYPE_DEFAULT = "Idea";
const NODE_TYPE_OPTIONS = ["Idea", "Question", "Important", "Source", "Task"];
const NODE_TYPE_STYLES = {
  Idea: { borderColor: "#0EA5E9" },
  Question: { borderColor: "#F59E0B" },
  Important: { borderColor: "#EF4444" },
  Source: { borderColor: "#10B981" },
  Task: { borderColor: "#8B5CF6" },
};

const colorFromId = (userId) => {
  if (!userId) return "#0ea5e9";
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  const palette = ["#FF5733", "#33FF57", "#3357FF", "#FF33A8", "#A833FF", "#33FFF5", "#FFC233", "#FF3333", "#33FF8E", "#8E33FF", "#FF8E33", "#33A8FF", "#57FF33"];
  return palette[h % palette.length];
};

const MapEditor = ({ mapId, onHome }) => {
  // React Flow
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const rf = useReactFlow();                             // <-- NEW: instance for transforms
  const navigate = useNavigate();

  // Map metadata
  const [mapName, setMapName] = useState("");
  const [mapDescription, setMapDescription] = useState("");
  const [lastEdited, setLastEdited] = useState("");
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapOwnerId, setMapOwnerId] = useState(null);

  // Node/edge UI helpers
  const [selectedElements, setSelectedElements] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [borderColor, setBorderColor] = useState(() => {
    try { return localStorage.getItem(LOCAL_NODE_BORDER_KEY) || "#64748B"; }
    catch { return "#64748B"; }
  });
  const [activePresetId, setActivePresetId] = useState(() => {
    try { return localStorage.getItem(LOCAL_NODE_PRESET_KEY) || ""; }
    catch { return ""; }
  });
  const [blockUploadState, setBlockUploadState] = useState({});
  const [pendingUploadFiles, setPendingUploadFiles] = useState({});
  const [nodeNotes, setNodeNotes] = useState({});
  const [nodeData, setNodeData] = useState({}); // { [nodeId]: { link, blocks } }
  const shortcutsSectionRef = useRef(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [activeSidebarPanel, setActiveSidebarPanel] = useState("settings");
  const [activeSettingsSection, setActiveSettingsSection] = useState("appearance");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeNodeTab, setActiveNodeTab] = useState("content");
  const [tagInput, setTagInput] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const [activeTagFilter, setActiveTagFilter] = useState("");
  const [focusMode, setFocusMode] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const commandInputRef = useRef(null);

  // Context menu + focus guards
  const [contextMenu, setContextMenu] = useState(null);
  const [disableShortcuts, setDisableShortcuts] = useState(false);
  const reactFlowWrapper = useRef(null);
  const nodeDetailsPanelRef = useRef(null);
  const edgeDetailsPanelRef = useRef(null);

  // Buffered inline editing
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [pendingLabel, setPendingLabel] = useState("");

  // Node creators (profiles)
  const [nodeCreators, setNodeCreators] = useState({}); // { uid: profile }
  const [participants, setParticipants] = useState([]); // [{id, username, profile_picture, online, role, isAdmin}]
  const [cursors, setCursors] = useState({}); // { userId: { x, y, username, color } }

  // Realtime presence roster (live)
  const [presenceUsers, setPresenceUsers] = useState({}); // { userId: { userId, username, color } }
  const realtimeChannelRef = useRef(null);                // <-- NEW
  const mapOwnerIdRef = useRef(null);

  // Refs to avoid noisy updates
  const prevMapRef = useRef(null);
  const lastCursorSentRef = useRef(0);
  const pendingNodeMigrationRef = useRef(null);
  const permissionNoticeTimerRef = useRef(null);

  // Current user
  const [currentUser, setCurrentUser] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [permissionNotice, setPermissionNotice] = useState("");
  const [accessNotice, setAccessNotice] = useState("");
  const [memberActionId, setMemberActionId] = useState(null);

  // === Background chooser (per-user) ===
  const [bgStyle, setBgStyle] = useState(() => {
    try { return localStorage.getItem(LOCAL_BG_STYLE_KEY) || "dots"; }
    catch { return "dots"; }
  });
  const [bgColor, setBgColor] = useState(() => {
    try { return localStorage.getItem(LOCAL_BG_COLOR_KEY) || "#CBD5E1"; }
    catch { return "#CBD5E1"; }
  });

  // --- Cursor UI: show own cursor + FPS throttle ---
  const [showMyCursor, setShowMyCursor] = useState(() => {
    try {
      const v = localStorage.getItem(LOCAL_CURSOR_SHOW_KEY);
      return v === null ? true : v === "true";
    } catch {
      return true;
    }
  });

  // Show others cursors
  const [showOthersCursors, setShowOthersCursors] = useState(() => {
    try {
      const v = localStorage.getItem(LOCAL_CURSOR_SHOW_OTHERS_KEY);
      return v === null ? true : v === "true";
    } catch {
      return true;
    }
  });

  const [cursorFps, setCursorFps] = useState(() => {
    try {
      const v = parseInt(localStorage.getItem(LOCAL_CURSOR_FPS_KEY), 10);
      return Number.isFinite(v) ? Math.min(60, Math.max(5, v)) : 20; // default 20 FPS
    } catch {
      return 20;
    }
  });

  // Keep a live ref of the toggle for the broadcast handler (avoids stale closures)
  const showOthersRef = useRef(showOthersCursors);
  useEffect(() => {
    showOthersRef.current = showOthersCursors;
  }, [showOthersCursors]);



  //  USEEFFECTS: Choose FPS for cursor updates + show/hide own cursor
  useEffect(() => {
    try { localStorage.setItem(LOCAL_CURSOR_SHOW_KEY, String(showMyCursor)); } catch { }
  }, [showMyCursor]);

  useEffect(() => {
    try { localStorage.setItem(LOCAL_CURSOR_FPS_KEY, String(cursorFps)); } catch { }
  }, [cursorFps]);

  //  Showing other users cursors
  useEffect(() => {
    try { localStorage.setItem(LOCAL_CURSOR_SHOW_OTHERS_KEY, String(showOthersCursors)); } catch { }
  }, [showOthersCursors]);

  // Hide other users cursors when toggled off, will also refresh any stuck cursors
  useEffect(() => {
    if (!showOthersCursors) {
      setCursors((prev) => {
        const me = currentUser?.id;
        return me && prev[me] ? { [me]: prev[me] } : {};
      });
    }
  }, [showOthersCursors, currentUser]);




  useEffect(() => {
    try { localStorage.setItem(LOCAL_BG_STYLE_KEY, bgStyle); } catch { }
  }, [bgStyle]);

  useEffect(() => {
    try { localStorage.setItem(LOCAL_BG_COLOR_KEY, bgColor); } catch { }
  }, [bgColor]);

  // ---- Helpers ----
  const removeUndefined = (obj) => {
    if (!obj || typeof obj !== "object") return obj;
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
  };

  const permissionMap = { owner_id: mapOwnerId };
  const permissionUser = { id: currentUser?.id, role: currentUserRole };
  const canViewMap = canViewPermission(permissionMap, permissionUser);
  const canEditMap = canEditPermission(permissionMap, permissionUser);
  const isAdmin = isAdminPermission(permissionMap, permissionUser);
  const isReadOnly = !canEditMap;

  const showPermissionNotice = useCallback((message) => {
    if (!message) return;
    setPermissionNotice(message);
    if (permissionNoticeTimerRef.current) {
      clearTimeout(permissionNoticeTimerRef.current);
    }
    permissionNoticeTimerRef.current = setTimeout(() => {
      setPermissionNotice("");
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (permissionNoticeTimerRef.current) {
        clearTimeout(permissionNoticeTimerRef.current);
      }
    };
  }, []);

  const requireEditPermission = useCallback(() => {
    if (canEditMap) return true;
    showPermissionNotice(canViewMap ? "This map is view-only." : "Access removed.");
    return false;
  }, [canEditMap, canViewMap, showPermissionNotice]);


  const updateMapRow = useCallback(
    async (newNodes, newEdges, nextNodeNotes = nodeNotes, nextNodeData = nodeData) => {
      if (!mapLoaded) return;
      if (!canEditMap) return;
      try {
        const filteredNodes = (newNodes || []).map((n) => removeUndefined(n));
        const filteredEdges = (newEdges || []).map((e) =>
          removeUndefined({ ...e, style: e.style || {} })
        );

        const payload = removeUndefined({
          nodes: filteredNodes,
          edges: filteredEdges,
          name: mapName || "Untitled",
          description: mapDescription || "",
          last_edited: new Date().toISOString(),
          node_notes: removeUndefined(nextNodeNotes),
          node_data: removeUndefined(nextNodeData),
        });

        const { error } = await supabase.from("maps").update(payload).eq("id", mapId);
        if (error) {
          console.error("❌ Update map failed:", error);
          const msg = (error.message || "").toLowerCase();
          if (error.code === "42501" || msg.includes("permission")) {
            setAccessNotice("Access removed.");
            showPermissionNotice("Access removed.");
          }
        }
      } catch (err) {
        console.error("❌ Unexpected updateMapRow error:", err);
      }
    },
    [mapLoaded, mapId, mapName, mapDescription, nodeNotes, nodeData, canEditMap, showPermissionNotice]
  );

  const applyNodeDataMigration = (nextNodes, nextEdges, nextNotes, nextData) => {
    const safeNotes = nextNotes || {};
    const safeData = nextData || {};
    const { nodeData: migratedNodeData, changed } = migrateNodeData(nextNodes, safeNotes, safeData);
    setNodeNotes(safeNotes);
    setNodeData(migratedNodeData);
    if (changed) {
      pendingNodeMigrationRef.current = {
        nodes: nextNodes,
        edges: nextEdges,
        nodeNotes: safeNotes,
        nodeData: migratedNodeData,
      };
    }
  };

  useEffect(() => {
    if (!mapLoaded || !pendingNodeMigrationRef.current) return;
    const pending = pendingNodeMigrationRef.current;
    pendingNodeMigrationRef.current = null;
    updateMapRow(pending.nodes, pending.edges, pending.nodeNotes, pending.nodeData);
  }, [mapLoaded, updateMapRow]);

  const onEdgeDoubleClick = useCallback((e, edge) => {
    e.preventDefault();
    setSelectedEdge(edge);
  }, []);

  const onEdgeClick = useCallback((e, edge) => {
    setSelectedEdge(edge);
    setActiveSidebarPanel("edge");
    setIsSidebarCollapsed(false);
  }, []);

  const onSelectionChange = useCallback(
    (elements) => {
      const ids = elements && Array.isArray(elements) ? elements.map((el) => el.id) : [];
      if (JSON.stringify(ids) !== JSON.stringify(selectedElements)) {
        setSelectedElements(ids);
      }
    },
    [selectedElements]
  );

  const saveTimeout = useRef(null);

  const handleNodeChanges = useCallback(
    (changes) => {
      if (editingNodeId) return;
      setNodes((nds) => {
        const updated = applyNodeChanges(changes, nds);
        if (canEditMap) {
          clearTimeout(saveTimeout.current);
          saveTimeout.current = setTimeout(() => {
            updateMapRow(updated, edges);
          }, 300);
        }
        return updated;
      });
    },
    [edges, updateMapRow, editingNodeId, setNodes, canEditMap]
  );

  const handleEdgeChanges = useCallback(
    (changes) => {
      setEdges((eds) => {
        const updated = applyEdgeChanges(changes, eds);
        if (canEditMap) {
          updateMapRow(nodes, updated);
        }
        return updated;
      });
    },
    [nodes, updateMapRow, setEdges, canEditMap]
  );


  // Live node-drag broadcasting

  const dragSaveTimeoutRef = useRef(null);

  const handleNodeDrag = useCallback((evt, node) => {
    const chan = realtimeChannelRef.current;
    if (!chan || !currentUser) return;

    // Broadcast this node's live position (visual only)
    chan.send({
      type: "broadcast",
      event: "node-move",
      payload: {
        userId: currentUser.id,
        nodeId: node.id,
        x: node.position.x,
        y: node.position.y,
        ts: Date.now(),
      },
    });
  }, [currentUser]);

  const handleNodeDragStop = useCallback(() => {
    if (!canEditMap) return;
    // Debounced persist: write final positions once user stops dragging
    clearTimeout(dragSaveTimeoutRef.current);
    dragSaveTimeoutRef.current = setTimeout(() => {
      setNodes((curr) => {
        updateMapRow(curr, edges);
        return curr;
      });
    }, 250);
  }, [edges, setNodes, updateMapRow, canEditMap]);

  // Until here -- added live node-drag broadcasting

  const onConnect = useCallback(
    (params) => {
      if (!requireEditPermission()) return;
      const modal = document.createElement("div");
      modal.style.position = "fixed";
      modal.style.top = "50%";
      modal.style.left = "50%";
      modal.style.transform = "translate(-50%, -50%)";
      modal.style.backgroundColor = "white";
      modal.style.padding = "20px";
      modal.style.border = "1px solid #ccc";
      modal.style.boxShadow = "0px 4px 6px rgba(0, 0, 0, 0.1)";
      modal.style.zIndex = "1000";
      modal.style.textAlign = "center";

      const title = document.createElement("h3");
      title.innerText = "Choose Edge Style";
      modal.appendChild(title);

      const createButton = (svgContent, onClick) => {
        const btn = document.createElement("button");
        btn.style.margin = "10px";
        btn.style.padding = "10px";
        btn.style.border = "1px solid #ddd";
        btn.style.backgroundColor = "#f9f9f9";
        btn.style.cursor = "pointer";
        btn.innerHTML = svgContent;
        btn.onclick = () => {
          onClick();
          document.body.removeChild(modal);
        };
        modal.appendChild(btn);
      };

      // Arrow
      createButton(
        `<svg height="30" width="80"><line x1="0" y1="15" x2="60" y2="15" stroke="black" stroke-width="2" /><polygon points="60,10 70,15 60,20" fill="black" /></svg>`,
        () => {
          setEdges((eds) => {
            const updated = addEdge(
              { ...params, markerEnd: { type: "arrowclosed" }, style: { ...DEFAULT_EDGE_STYLE } },
              eds
            );
            updateMapRow(nodes, updated);
            return updated;
          });
        }
      );
      // Dashed
      createButton(
        `<svg height="30" width="80"><line x1="0" y1="15" x2="70" y2="15" stroke="black" stroke-width="2" stroke-dasharray="5,5" /></svg>`,
        () => {
          setEdges((eds) => {
            const updated = addEdge(
              { ...params, style: { ...DEFAULT_EDGE_STYLE, strokeDasharray: "5,5" } },
              eds
            );
            updateMapRow(nodes, updated);
            return updated;
          });
        }
      );
      // No arrow
      createButton(
        `<svg height="30" width="80"><line x1="0" y1="15" x2="70" y2="15" stroke="black" stroke-width="2" /></svg>`,
        () => {
          setEdges((eds) => {
            const updated = addEdge({ ...params, style: { ...DEFAULT_EDGE_STYLE } }, eds);
            updateMapRow(nodes, updated);
            return updated;
          });
        }
      );

      document.body.appendChild(modal);
    },
    [nodes, updateMapRow, setEdges, requireEditPermission]
  );

  const onContextMenu = useCallback(
    (event) => {
      if (!canEditMap) return;
      event.preventDefault();
      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      setContextMenu({ x, y });
    },
    [canEditMap]
  );
  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  useEffect(() => {
    const handler = () => {
      if (contextMenu) closeContextMenu();
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [contextMenu, closeContextMenu]);

  const addNode = useCallback(
    async (position = { x: Math.random() * 400, y: Math.random() * 400 }) => {
      if (!requireEditPermission()) return;
      const maxId = nodes.length ? Math.max(...nodes.map((n) => parseInt(n.id))) : 0;
      const newNodeId = (maxId + 1).toString();

      const userId = currentUser?.id || "unknown";
      let preferredBorderColor = borderColor;
      try {
        preferredBorderColor = localStorage.getItem(LOCAL_NODE_BORDER_KEY) || borderColor;
      } catch {}

      const newNode = {
        id: newNodeId,
        data: { title: `Node ${newNodeId}`, tags: [], nodeType: NODE_TYPE_DEFAULT },
        position,
        style: { border: `2px solid ${preferredBorderColor}` },
        creator: userId,
        creationTimestamp: new Date().toISOString(),
      };

      setNodes((nds) => {
        const updated = [...nds, newNode];
        updateMapRow(updated, edges);
        return updated;
      });

      if (userId !== "unknown") {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id, username, profile_picture")
          .eq("id", userId)
          .single();
        if (prof) setNodeCreators((prev) => ({ ...prev, [userId]: prof }));
      }
    },
    [nodes, edges, updateMapRow, borderColor, currentUser, setNodes, requireEditPermission]
  );

  // ----- Inline edit: buffered typing -----
  const onNodeDoubleClick = useCallback(
    (_, node) => {
      if (!requireEditPermission()) return;
      setEditingNodeId(node.id);
      setPendingLabel(getNodeTitle(node));
      setNodes((nds) =>
        nds.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, isEditing: true } } : n))
      );
    },
    [setNodes, requireEditPermission]
  );

  const handleLabelTyping = (e) => setPendingLabel(e.target.value);

  const commitLabel = useCallback(() => {
    if (!editingNodeId) return;
    if (!requireEditPermission()) return;
    setNodes((nds) => {
      const updated = nds.map((n) => (n.id === editingNodeId ? setNodeTitle(n, pendingLabel) : n));
      updateMapRow(updated, edges);
      return updated;
    });
    setEditingNodeId(null);
  }, [editingNodeId, pendingLabel, edges, updateMapRow, setNodes, requireEditPermission]);

  const onDelete = useCallback(() => {
    if (!requireEditPermission()) return;
    const remainingNodes = nodes.filter((n) => !selectedElements.includes(n.id));
    const remainingEdges = edges.filter((e) => !selectedElements.includes(e.id));
    setNodes(remainingNodes);
    setEdges(remainingEdges);
    setSelectedElements([]);
    updateMapRow(remainingNodes, remainingEdges);
  }, [nodes, edges, selectedElements, updateMapRow, setNodes, setEdges, requireEditPermission]);

  const LOCAL_BG_PAGECOLOR_KEY = "mapEditor:bgPageColor";

  const [bgPageColor, setBgPageColor] = useState(() => {
    try { return localStorage.getItem(LOCAL_BG_PAGECOLOR_KEY) || "#F5F7FB"; }
    catch { return "#F5F7FB"; }
  });

  // --- MiniMap toggle (on/off) ---
  const LOCAL_MINIMAP_ENABLED_KEY = "mapEditor:minimapEnabled";
  const [minimapEnabled, setMinimapEnabled] = useState(() => {
    try {
      const v = localStorage.getItem(LOCAL_MINIMAP_ENABLED_KEY);
      return v === null ? true : v === "true";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try { localStorage.setItem(LOCAL_MINIMAP_ENABLED_KEY, String(minimapEnabled)); } catch { }
  }, [minimapEnabled]);

  useEffect(() => {
    try { localStorage.setItem(LOCAL_BG_PAGECOLOR_KEY, bgPageColor); } catch { }
  }, [bgPageColor]);

  // ----- Shortcuts -----
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (disableShortcuts || commandPaletteOpen) return;
      if (!canEditMap) return;
      const a = document.activeElement;
      if (a?.tagName === "INPUT" || a?.tagName === "TEXTAREA" || a?.isContentEditable) return;
      if (event.key === "Delete" || event.key === "Backspace") onDelete();
      else if (event.key.toLowerCase() === "n") addNode();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onDelete, addNode, disableShortcuts, commandPaletteOpen, canEditMap]);

  useEffect(() => {
    const handlePaletteShortcut = (event) => {
      const isCmdK = (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey));
      if (!isCmdK) return;
      event.preventDefault();
      setCommandPaletteOpen(true);
      setCommandQuery("");
    };
    document.addEventListener("keydown", handlePaletteShortcut);
    return () => document.removeEventListener("keydown", handlePaletteShortcut);
  }, []);

  useEffect(() => {
    if (!commandPaletteOpen) return;
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setCommandPaletteOpen(false);
        setCommandQuery("");
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [commandPaletteOpen]);

  useEffect(() => {
    if (!commandPaletteOpen) return;
    requestAnimationFrame(() => {
      commandInputRef.current?.focus();
    });
  }, [commandPaletteOpen]);

  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(node);
    setBorderColor(extractBorderColor(node) || "#64748B");
    setActiveSidebarPanel("node");
    setIsSidebarCollapsed(false);
    setActiveNodeTab("content");
  }, []);

  useEffect(() => {
    if (activeSidebarPanel === "node" && !selectedNode) {
      setActiveSidebarPanel("settings");
    }
    if (activeSidebarPanel === "edge" && !selectedEdge) {
      setActiveSidebarPanel("settings");
    }
  }, [activeSidebarPanel, selectedNode, selectedEdge]);

  useEffect(() => {
    setTagInput("");
  }, [selectedNode?.id]);

  const handleBorderColorChange = (color) => {
    if (!requireEditPermission()) return;
    if (!selectedNode) return;
    const updated = nodes.map((node) =>
      node.id === selectedNode.id ? { ...node, style: { ...node.style, border: `2px solid ${color}` } } : node
    );
    setNodes(updated);
    setBorderColor(color);
    setActivePresetId("");
    try {
      localStorage.setItem(LOCAL_NODE_BORDER_KEY, color);
      localStorage.removeItem(LOCAL_NODE_PRESET_KEY);
    } catch {}
    updateMapRow(updated, edges);
  };

  const handleApplyPreset = (presetId) => {
    if (!requireEditPermission()) return;
    if (!selectedNode) return;
    const preset = NODE_STYLE_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    const updated = nodes.map((node) =>
      node.id === selectedNode.id
        ? { ...node, style: { ...node.style, border: `2px solid ${preset.borderColor}` } }
        : node
    );
    setNodes(updated);
    setBorderColor(preset.borderColor);
    setActivePresetId(preset.id);
    try {
      localStorage.setItem(LOCAL_NODE_BORDER_KEY, preset.borderColor);
      localStorage.setItem(LOCAL_NODE_PRESET_KEY, preset.id);
    } catch {}
    updateMapRow(updated, edges);
  };

  const updateNodeDataFields = useCallback(
    (nodeId, patch) => {
      if (!requireEditPermission()) return;
      if (!nodeId) return;
      setNodes((nds) => {
        const updated = nds.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node
        );
        const nextSelected = updated.find((node) => node.id === nodeId);
        if (nextSelected) {
          setSelectedNode(nextSelected);
        }
        updateMapRow(updated, edges);
        return updated;
      });
    },
    [edges, updateMapRow, setNodes, setSelectedNode, requireEditPermission]
  );

  const handleNodeTypeChange = (event) => {
    if (!requireEditPermission()) return;
    if (!selectedNode) return;
    const nextType = event.target.value;
    if (!NODE_TYPE_OPTIONS.includes(nextType)) return;
    const currentType = getNodeType(selectedNode);
    if (nextType === currentType) return;
    const typeStyle = NODE_TYPE_STYLES[nextType];

    setNodes((nds) => {
      const updated = nds.map((node) => {
        if (node.id !== selectedNode.id) return node;
        const nextNode = { ...node, data: { ...node.data, nodeType: nextType } };
        if (typeStyle?.borderColor) {
          nextNode.style = { ...node.style, border: `2px solid ${typeStyle.borderColor}` };
        }
        return nextNode;
      });
      const nextSelected = updated.find((node) => node.id === selectedNode.id);
      if (nextSelected) {
        setSelectedNode(nextSelected);
      }
      if (typeStyle?.borderColor) {
        setBorderColor(typeStyle.borderColor);
      }
      updateMapRow(updated, edges);
      return updated;
    });
  };

  const handleAddTag = () => {
    if (!requireEditPermission()) return;
    if (!selectedNode) return;
    const incoming = splitTagInput(tagInput);
    if (!incoming.length) return;
    const existing = getNodeTags(selectedNode);
    const nextTags = dedupeTags([...existing, ...incoming]);
    setTagInput("");
    updateNodeDataFields(selectedNode.id, { tags: nextTags });
  };

  const handleRemoveTag = (tagToRemove) => {
    if (!requireEditPermission()) return;
    if (!selectedNode) return;
    const existing = getNodeTags(selectedNode);
    const nextTags = existing.filter(
      (tag) => String(tag).toLowerCase() !== String(tagToRemove).toLowerCase()
    );
    updateNodeDataFields(selectedNode.id, { tags: nextTags });
  };

  const handleTagInputKeyDown = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    handleAddTag();
  };

  const getBlocksForNodeId = (nodeId) => {
    const entry = nodeData?.[nodeId];
    return Array.isArray(entry?.blocks) ? entry.blocks : [];
  };

  const updateBlocksForNode = (nodeId, nextBlocks, { persist = false } = {}) => {
    if (!requireEditPermission()) return;
    const primaryText = pickPrimaryTextFromBlocks(nextBlocks);
    const primaryLink = pickPrimaryLinkFromBlocks(nextBlocks);
    const nextNodeData = {
      ...(nodeData || {}),
      [nodeId]: { ...(nodeData?.[nodeId] || {}), blocks: nextBlocks, link: primaryLink },
    };
    const nextNodeNotes = { ...(nodeNotes || {}), [nodeId]: primaryText };
    setNodeData(nextNodeData);
    setNodeNotes(nextNodeNotes);
    if (persist) {
      updateMapRow(nodes, edges, nextNodeNotes, nextNodeData);
    }
  };

  const updateBlockForNode = (nodeId, blockId, blockIndex, patch, { persist = false } = {}) => {
    const nextBlocks = getBlocksForNodeId(nodeId).map((block, idx) => {
      const matches = block?.id ? block.id === blockId : idx === blockIndex;
      if (!matches) return block;
      const nextId = block?.id || makeBlockId(block?.type || "block");
      const nextCreatedAt = block?.createdAt || new Date().toISOString();
      return { ...block, id: nextId, createdAt: nextCreatedAt, ...patch };
    });
    updateBlocksForNode(nodeId, nextBlocks, { persist });
  };

  const addBlockToNode = (nodeId, type) => {
    if (!requireEditPermission()) return;
    if (!nodeId) return;
    const createdAt = new Date().toISOString();
    let newBlock = { id: makeBlockId(type), type, createdAt };
    if (type === "text") newBlock = { ...newBlock, text: "" };
    if (type === "image" || type === "video") newBlock = { ...newBlock, url: "", caption: "" };
    if (type === "link") newBlock = { ...newBlock, url: "", label: "" };
    const nextBlocks = [...getBlocksForNodeId(nodeId), newBlock];
    updateBlocksForNode(nodeId, nextBlocks, { persist: true });
  };

  const handleAddBlock = (type) => {
    if (!requireEditPermission()) return;
    if (!selectedNode) return;
    addBlockToNode(selectedNode.id, type);
  };

  const handleRemoveBlock = (blockId, blockIndex) => {
    if (!requireEditPermission()) return;
    if (!selectedNode) return;
    const nextBlocks = getBlocksForNodeId(selectedNode.id).filter((block, idx) => {
      if (block?.id) return block.id !== blockId;
      return idx !== blockIndex;
    });
    updateBlocksForNode(selectedNode.id, nextBlocks, { persist: true });
  };

  const handleBlockFieldChange = (blockId, blockIndex, field, value) => {
    if (!requireEditPermission()) return;
    if (!selectedNode) return;
    updateBlockForNode(selectedNode.id, blockId, blockIndex, { [field]: value });
  };

  const handleMoveBlock = (blockId, blockIndex, direction) => {
    if (!requireEditPermission()) return;
    if (!selectedNode) return;
    const blocks = [...getBlocksForNodeId(selectedNode.id)];
    if (!blocks.length) return;
    const resolvedIndex = blockId ? blocks.findIndex((b) => b?.id === blockId) : blockIndex;
    const fromIndex = resolvedIndex >= 0 ? resolvedIndex : blockIndex;
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= blocks.length) return;
    const nextBlocks = [...blocks];
    const [moved] = nextBlocks.splice(fromIndex, 1);
    nextBlocks.splice(toIndex, 0, moved);
    updateBlocksForNode(selectedNode.id, nextBlocks, { persist: true });
  };

  const handleBlockFileSelection = (blockId, file, kind, resetInput) => {
    if (!requireEditPermission()) return;
    if (!file) return;
    const validationError = getMediaValidationError(file, kind);
    if (validationError) {
      setBlockUploadState((prev) => ({ ...prev, [blockId]: { uploading: false, error: validationError } }));
      if (resetInput) resetInput();
      setPendingUploadFiles((prev) => {
        const next = { ...prev };
        delete next[blockId];
        return next;
      });
      return;
    }
    setBlockUploadState((prev) => ({ ...prev, [blockId]: { ...prev[blockId], error: "" } }));
    setPendingUploadFiles((prev) => ({ ...prev, [blockId]: file }));
  };

  const handleBlockUpload = async (blockId, blockIndex, kind) => {
    if (!requireEditPermission()) return;
    if (!selectedNode) return;
    const file = pendingUploadFiles?.[blockId];
    if (!file) {
      setBlockUploadState((prev) => ({
        ...prev,
        [blockId]: { ...prev[blockId], error: "Choose a file first." },
      }));
      return;
    }
    const validationError = getMediaValidationError(file, kind);
    if (validationError) {
      setBlockUploadState((prev) => ({ ...prev, [blockId]: { uploading: false, error: validationError } }));
      return;
    }

    setBlockUploadState((prev) => ({ ...prev, [blockId]: { uploading: true, error: "" } }));
    try {
      let publicUrl = "";
      let storagePath = "";
      if (HAS_SUPABASE_STORAGE) {
        const ext = getFileExtension(file.name) || (kind === "image" ? "png" : "mp4");
        const path = `maps/${mapId}/${selectedNode.id}/${makeBlockId(kind)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(MEDIA_BUCKET)
          .upload(path, file, { upsert: true, contentType: file.type });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
        publicUrl = data?.publicUrl || "";
        if (!publicUrl) throw new Error("Could not generate a public URL.");
        storagePath = path;
      } else if (process.env.NODE_ENV !== "production") {
        if (file.size > LOCAL_MEDIA_UPLOAD_MAX_BYTES) {
          throw new Error("File is too large for local storage fallback (3MB max).");
        }
        const dataUrl = await readFileAsDataUrl(file);
        publicUrl = typeof dataUrl === "string" ? dataUrl : "";
        if (!publicUrl) throw new Error("Local storage fallback failed.");
      } else {
        throw new Error("Uploads are not configured.");
      }

      updateBlockForNode(
        selectedNode.id,
        blockId,
        blockIndex,
        { url: publicUrl, storagePath: storagePath || "" },
        { persist: true }
      );
      setPendingUploadFiles((prev) => {
        const next = { ...prev };
        delete next[blockId];
        return next;
      });
    } catch (err) {
      setBlockUploadState((prev) => ({
        ...prev,
        [blockId]: { uploading: false, error: err?.message || "Upload failed." },
      }));
    } finally {
      setBlockUploadState((prev) => ({
        ...prev,
        [blockId]: { ...prev[blockId], uploading: false },
      }));
    }
  };

  const handleRemoveBlockMedia = async (blockId, blockIndex) => {
    if (!requireEditPermission()) return;
    if (!selectedNode) return;
    const blocks = getBlocksForNodeId(selectedNode.id);
    const target =
      blocks.find((block) => block?.id === blockId) || blocks[blockIndex];
    if (!target) return;

    setBlockUploadState((prev) => ({ ...prev, [blockId]: { uploading: true, error: "" } }));
    try {
      if (target.storagePath && HAS_SUPABASE_STORAGE) {
        const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([target.storagePath]);
        if (error) throw error;
      }
      updateBlockForNode(selectedNode.id, blockId, blockIndex, { url: "", storagePath: "" }, { persist: true });
      setPendingUploadFiles((prev) => {
        const next = { ...prev };
        delete next[blockId];
        return next;
      });
    } catch (err) {
      setBlockUploadState((prev) => ({
        ...prev,
        [blockId]: { uploading: false, error: err?.message || "Failed to remove file." },
      }));
      return;
    }
    setBlockUploadState((prev) => ({ ...prev, [blockId]: { uploading: false, error: "" } }));
  };

  const handleBlockBlur = () => {
    if (!requireEditPermission()) return;
    if (!selectedNode) return;
    updateMapRow(nodes, edges);
  };

  const handleDuplicateNode = (nodeId) => {
    if (!requireEditPermission()) return;
    if (!nodeId) return;
    const sourceNode = nodes.find((node) => node.id === nodeId);
    if (!sourceNode) return;
    const maxId = nodes.length ? Math.max(...nodes.map((n) => parseInt(n.id))) : 0;
    const newNodeId = (maxId + 1).toString();
    const baseTitle = getNodeTitle(sourceNode) || `Node ${newNodeId}`;
    const newNode = {
      ...sourceNode,
      id: newNodeId,
      data: {
        ...sourceNode.data,
        title: baseTitle,
        isEditing: false,
        tags: getNodeTags(sourceNode),
        nodeType: getNodeType(sourceNode),
      },
      position: { x: sourceNode.position.x + 40, y: sourceNode.position.y + 40 },
      creator: currentUser?.id || sourceNode.creator || "unknown",
      creationTimestamp: new Date().toISOString(),
    };

    const sourceBlocks = getBlocksForNodeId(nodeId);
    const duplicatedBlocks = sourceBlocks.map((block) => {
      if (!block) return block;
      const { storagePath, ...rest } = block;
      return {
        ...rest,
        id: makeBlockId(block.type || "block"),
        createdAt: new Date().toISOString(),
      };
    });

    const nextNodeData = {
      ...(nodeData || {}),
      [newNodeId]: {
        ...(nodeData?.[nodeId] || {}),
        blocks: duplicatedBlocks,
        link: pickPrimaryLinkFromBlocks(duplicatedBlocks),
      },
    };
    const nextNodeNotes = {
      ...(nodeNotes || {}),
      [newNodeId]: pickPrimaryTextFromBlocks(duplicatedBlocks),
    };

    const updatedNodes = [...nodes, newNode];
    setNodes(updatedNodes);
    setNodeData(nextNodeData);
    setNodeNotes(nextNodeNotes);
    updateMapRow(updatedNodes, edges, nextNodeNotes, nextNodeData);
  };

  const handleDeleteNodeById = (nodeId) => {
    if (!requireEditPermission()) return;
    if (!nodeId) return;
    const remainingNodes = nodes.filter((node) => node.id !== nodeId);
    const remainingEdges = edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
    setNodes(remainingNodes);
    setEdges(remainingEdges);
    setSelectedElements((prev) => prev.filter((id) => id !== nodeId));
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
      setActiveSidebarPanel("settings");
    }
    updateMapRow(remainingNodes, remainingEdges);
  };

  const toggleSettingsSection = (section) => {
    setActiveSettingsSection((prev) => (prev === section ? null : section));
  };

  const openSidebarPanel = (panel, section) => {
    setActiveSidebarPanel(panel);
    setIsSidebarCollapsed(false);
    if (section) {
      setActiveSettingsSection(section);
    }
  };

  const openShortcuts = () => {
    openSidebarPanel("settings", "shortcuts");
    requestAnimationFrame(() => {
      shortcutsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const selectNodeById = useCallback(
    (nodeId, { center = false } = {}) => {
      if (!nodeId) return;
      const target = nodes.find((node) => node.id === nodeId);
      if (!target) return;
      setSelectedNode(target);
      setSelectedEdge(null);
      setSelectedElements([nodeId]);
      setActiveSidebarPanel("node");
      setIsSidebarCollapsed(false);
      setActiveNodeTab("content");
      setNodes((nds) =>
        nds.map((node) => ({ ...node, selected: node.id === nodeId }))
      );
      if (center && rf?.setCenter) {
        const width = typeof target.width === "number" ? target.width : 0;
        const height = typeof target.height === "number" ? target.height : 0;
        const cx = target.position.x + width / 2;
        const cy = target.position.y + height / 2;
        rf.setCenter(cx, cy, { zoom: 1.2, duration: 300 });
      }
    },
    [nodes, rf, setNodes]
  );

  // Render node label with creator info and date (display-only JSX)
  const renderNode = (node, { isDimmed = false } = {}) => {
    const creatorInfo = nodeCreators[node.creator];
    const creationDate = new Date(node.creationTimestamp).toLocaleDateString();
    const creatorUsername = creatorInfo?.username || "Unknown Username";
    const title = getNodeTitle(node);
    const nodeType = getNodeType(node);
    const typeColor = NODE_TYPE_STYLES[nodeType]?.borderColor || "#64748B";
    const nodeBorderColor = extractBorderColor(node);
    const nodeStyle = node.style?.border
      ? { border: node.style.border }
      : nodeBorderColor
      ? { borderColor: nodeBorderColor }
      : undefined;
    const isSelected = !!node.selected;
    const nodeBlocks = getBlocksForNodeId(node.id);
    const snippet = getSnippetFromBlocks(nodeBlocks);
    const { hasText, hasImage, hasVideo, hasLink } = getBlockTypePresence(nodeBlocks);
    const hasIcons = hasText || hasImage || hasVideo || hasLink;
    const nodeData = node.data || {};

    if (nodeData.isEditing) {
      const isThisEditing = node.id === editingNodeId;
      return (
        <div
          className={`me-node glass ${isSelected ? "is-selected" : ""} ${isDimmed ? "is-dimmed" : ""}`}
          style={nodeStyle}
        >
          <input
            type="text"
            value={isThisEditing ? pendingLabel : title}
            onFocus={() => setDisableShortcuts(true)}
            onChange={handleLabelTyping}
            onBlur={() => {
              setDisableShortcuts(false);
              commitLabel();
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                setDisableShortcuts(false);
                commitLabel();
              }
            }}
            autoFocus
            readOnly={isReadOnly}
            className="me-node-input"
            style={{ width: "100%" }}
          />
        </div>
      );
    }

    return (
      <div
        className={`me-node glass ${isSelected ? "is-selected" : ""} ${isDimmed ? "is-dimmed" : ""}`}
        style={nodeStyle}
      >
        <div className="me-node-content">
          <div className="me-node-header">
            <span className="me-node-title">{title}</span>
            {nodeType && (
              <span className="nodeTypeBadge" style={{ borderColor: typeColor, color: typeColor }}>
                {nodeType}
              </span>
            )}
          </div>
          {snippet && <span className="me-node-snippet">{snippet}</span>}
          {hasIcons && (
            <div className="me-node-icons">
              {hasText && (
                <span className="me-node-icon" title="Text">
                  📝
                </span>
              )}
              {hasLink && (
                <span className="me-node-icon" title="Link">
                  🔗
                </span>
              )}
              {hasImage && (
                <span className="me-node-icon" title="Image">
                  🖼️
                </span>
              )}
              {hasVideo && (
                <span className="me-node-icon" title="Video">
                  🎥
                </span>
              )}
            </div>
          )}
          <div
            className="nodeQuickActions"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="nodeQuickAction"
              title="Add text block"
              aria-label="Add text block"
              onClick={() => addBlockToNode(node.id, "text")}
              disabled={isReadOnly}
            >
              T
            </button>
            <button
              type="button"
              className="nodeQuickAction"
              title="Add link block"
              aria-label="Add link block"
              onClick={() => addBlockToNode(node.id, "link")}
              disabled={isReadOnly}
            >
              🔗
            </button>
            <button
              type="button"
              className="nodeQuickAction"
              title="Add image block"
              aria-label="Add image block"
              onClick={() => addBlockToNode(node.id, "image")}
              disabled={isReadOnly}
            >
              🖼️
            </button>
            <button
              type="button"
              className="nodeQuickAction"
              title="Add video block"
              aria-label="Add video block"
              onClick={() => addBlockToNode(node.id, "video")}
              disabled={isReadOnly}
            >
              🎥
            </button>
            <button
              type="button"
              className="nodeQuickAction"
              title="Duplicate node"
              aria-label="Duplicate node"
              onClick={() => handleDuplicateNode(node.id)}
              disabled={isReadOnly}
            >
              ⧉
            </button>
            <button
              type="button"
              className="nodeQuickAction is-danger"
              title="Delete node"
              aria-label="Delete node"
              onClick={() => handleDeleteNodeById(node.id)}
              disabled={isReadOnly}
            >
              ✕
            </button>
          </div>
          {isSelected && (
            <div className="me-node-meta">
              {creatorUsername} - {creationDate}
            </div>
          )}
        </div>
      </div>
    );
  };

  const refreshParticipants = useCallback(
    async (currentUserIdOverride) => {
      try {
        const { data: parts, error: partsErr } = await supabase
          .from("map_participants")
          .select("user_id, role")
          .eq("map_id", mapId);
        if (partsErr) throw partsErr;

        const ids = (parts || []).map((p) => p.user_id);
        if (!ids.length) {
          setParticipants([]);
          setCurrentUserRole(null);
          const meId = currentUserIdOverride || currentUser?.id;
          const ownerId = mapOwnerIdRef.current;
          if (meId && (!ownerId || ownerId !== meId)) {
            setAccessNotice("Access removed.");
          }
          return;
        }

        const roleMap = {};
        (parts || []).forEach((p) => {
          const normalized = normalizeRole(p.role);
          roleMap[p.user_id] = normalized || "viewer";
        });

        const { data: profs, error: profErr } = await supabase
          .from("profiles")
          .select("id, username, profile_picture")
          .in("id", ids);
        if (profErr) throw profErr;

        const { data: presence } = await supabase
          .from("map_presence")
          .select("user_id, online")
          .eq("map_id", mapId);

        const onlineMap = {};
        (presence || []).forEach((r) => (onlineMap[r.user_id] = r.online));

        const ownerId = mapOwnerIdRef.current;
        const list = (profs || []).map((p) => {
          const role = roleMap[p.id] || (ownerId === p.id ? "admin" : "viewer");
          const isAdmin = role === "admin" || ownerId === p.id;
          return {
            id: p.id,
            username: p.username || "Unknown",
            profile_picture: p.profile_picture || DEFAULT_AVATAR_URL,
            role,
            isAdmin,
            online: !!onlineMap[p.id],
          };
        });
        setParticipants(list);

        const meId = currentUserIdOverride || currentUser?.id;
        if (meId) {
          const isOwner = ownerId && ownerId === meId;
          const selfRole = isOwner ? "admin" : roleMap[meId] || null;
          setCurrentUserRole(selfRole);
          if (!isOwner && !roleMap[meId]) {
            setAccessNotice("Access removed.");
          }
        }
      } catch (err) {
        console.error("refreshParticipants error:", err);
      }
    },
    [mapId, currentUser?.id]
  );

  const handleMemberRoleChange = useCallback(
    async (userId, nextRole) => {
      if (!isAdmin) {
        showPermissionNotice("Only admins can manage members.");
        return;
      }
      if (!userId) return;
      if (!["viewer", "editor"].includes(nextRole)) return;
      setMemberActionId(userId);
      const { error } = await supabase
        .from("map_participants")
        .update({ role: nextRole })
        .eq("map_id", mapId)
        .eq("user_id", userId);
      if (error) {
        console.error("Role update failed:", error);
        showPermissionNotice("Couldn't update role.");
      } else {
        setParticipants((prev) =>
          prev.map((p) => (p.id === userId ? { ...p, role: nextRole } : p))
        );
        if (userId === currentUser?.id) {
          setCurrentUserRole(nextRole);
        }
      }
      setMemberActionId(null);
      await refreshParticipants(currentUser?.id);
    },
    [isAdmin, mapId, currentUser?.id, showPermissionNotice, refreshParticipants]
  );

  const handleRemoveParticipant = useCallback(
    async (userId) => {
      if (!isAdmin) {
        showPermissionNotice("Only admins can manage members.");
        return;
      }
      if (!userId) return;
      if (userId === currentUser?.id) {
        showPermissionNotice("Admins cannot remove themselves.");
        return;
      }
      const target = participants.find((p) => p.id === userId);
      if (target?.role === "admin") {
        showPermissionNotice("Admins cannot be removed.");
        return;
      }
      const confirmed = window.confirm("Remove this member from the map?");
      if (!confirmed) return;
      setMemberActionId(userId);
      const { error } = await supabase
        .from("map_participants")
        .delete()
        .eq("map_id", mapId)
        .eq("user_id", userId);
      if (error) {
        console.error("Remove member failed:", error);
        showPermissionNotice("Couldn't remove member.");
      } else {
        setParticipants((prev) => prev.filter((p) => p.id !== userId));
      }
      setMemberActionId(null);
      await refreshParticipants(currentUser?.id);
    },
    [isAdmin, mapId, currentUser?.id, participants, showPermissionNotice, refreshParticipants]
  );

  // ----- Load map + subscribe (durable data via Postgres; presence/cursors via Realtime) -----
  useEffect(() => {
    let mounted = true;
    let channel;
    let presenceTimer;

    const refreshPresence = async () => {
      const { data: presence, error: presenceErr } = await supabase
        .from("map_presence")
        .select("user_id, online")
        .eq("map_id", mapId);
      if (presenceErr) {
        const msg = (presenceErr.message || "").toLowerCase();
        if (presenceErr.code === "42501" || msg.includes("permission")) {
          setAccessNotice("Access removed.");
        }
        return;
      }

      const onlineMap = {};
      (presence || []).forEach((r) => (onlineMap[r.user_id] = r.online));

      setParticipants((prev) =>
        prev.map((p) => ({
          ...p,
          online: !!onlineMap[p.id],
        }))
      );
    };

    const load = async () => {
      const { data: u } = await supabase.auth.getUser();
      if (mounted) setCurrentUser(u?.user || null);

      const { data: m, error } = await supabase
        .from("maps")
        .select("id, name, description, nodes, edges, node_notes, node_data, last_edited, owner_id")
        .eq("id", mapId)
        .single();
      if (error) {
        console.error("Failed to load map:", error.message);
        const msg = (error.message || "").toLowerCase();
        if (error.code === "PGRST116" || msg.includes("permission")) {
          setAccessNotice("Access removed.");
        }
        return;
      }
      if (!mounted) return;

      const loadedNodes = m?.nodes || [];
      const loadedEdges = m?.edges || [];
      const loadedNotes = m?.node_notes || {};
      const loadedData = m?.node_data || {};

      setNodes(loadedNodes);
      setEdges(loadedEdges);
      setMapName(m?.name || "");
      setMapDescription(m?.description || "");
      applyNodeDataMigration(loadedNodes, loadedEdges, loadedNotes, loadedData);
      setLastEdited(m?.last_edited ? new Date(m.last_edited).toLocaleString() : "Not available");
      setMapLoaded(true);
      prevMapRef.current = m;
      mapOwnerIdRef.current = m?.owner_id || null;
      setMapOwnerId(m?.owner_id || null);

      const creatorIds = Array.from(
        new Set(loadedNodes.map((n) => n.creator).filter((c) => !!c && c !== "unknown"))
      );
      if (creatorIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, username, profile_picture")
          .in("id", creatorIds);
        const dict = {};
        (profs || []).forEach((p) => (dict[p.id] = p));
        setNodeCreators(dict);
      }

      await refreshParticipants(u?.user?.id);
      presenceTimer = setInterval(refreshPresence, 15000);

      // Subscribe to map row updates for live real time changes.
      channel = supabase
        .channel("map-" + mapId)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "maps", filter: `id=eq.${mapId}` },
          (payload) => {
            const m2 = payload.new;
            const nextNodes = m2.nodes || [];
            const nextEdges = m2.edges || [];
            const nextNotes = m2.node_notes || {};
            const nextData = m2.node_data || {};

            setNodes(nextNodes);
            setEdges(nextEdges);
            setMapName(m2.name || "");
            setMapDescription(m2.description || "");
            applyNodeDataMigration(nextNodes, nextEdges, nextNotes, nextData);
            setLastEdited(
              m2.last_edited ? new Date(m2.last_edited).toLocaleString() : "Not available"
            );
          }
        )
        // realtime is handled by presence and broadcast channels below
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "map_participants", filter: `map_id=eq.${mapId}` },
          () => refreshParticipants()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "map_cursors", filter: `map_id=eq.${mapId}` },
          () => refreshPresence()
        )
        .subscribe();
    };

    load();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
      if (presenceTimer) clearInterval(presenceTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId]);

  // ----- Presence heartbeat (map_cursors) -----
  useEffect(() => {
    if (!currentUser || !mapLoaded) return;

    let timer;

    const writeHeartbeat = async () => {
      try {
        const username =
          currentUser.user_metadata?.username ||
          currentUser.email?.split("@")[0] ||
          "Unknown User";
        const color = colorFromId(currentUser.id);

        const { error } = await supabase.from("map_cursors").upsert({
          map_id: mapId,
          user_id: currentUser.id,
          x: 0,
          y: 0,
          username,
          color,
          updated_at: new Date().toISOString(),
        });
        if (error) console.warn("cursor heartbeat error:", error.message);
      } catch (err) {
        console.warn("cursor heartbeat exception:", err);
      }
    };

    writeHeartbeat();
    timer = setInterval(writeHeartbeat, 12000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [currentUser, mapLoaded, mapId]);

  // ----- Realtime presence + cursor broadcast (Phase C) -----
  useEffect(() => {
    if (!currentUser) return;

    // Build (or reuse) Realtime channel with presence
    if (realtimeChannelRef.current) {
      try {
        supabase.removeChannel(realtimeChannelRef.current);
      } catch {}
      realtimeChannelRef.current = null;
    }

    const chan = supabase.channel(`map:${mapId}`, {
      config: { presence: { key: currentUser.id } },
    });

    const syncPresence = () => {
      const state = chan.presenceState();
      const next = {};
      Object.values(state).forEach((arr) => {
        arr.forEach((m) => {
          if (m?.userId) next[m.userId] = m;
        });
      });
      setPresenceUsers(next);

      // Reflect online in participants list immediately (optional)
      setParticipants((prev) => prev.map((p) => ({ ...p, online: !!next[p.id] })));
    };

    // Presence roster sync
    chan.on("presence", { event: "sync" }, syncPresence);
    chan.on("presence", { event: "join" }, syncPresence);
    chan.on("presence", { event: "leave" }, syncPresence);

    // Receive cursor broadcasts
    chan.on("broadcast", { event: "cursor" }, ({ payload }) => {
      const { userId, x, y, username, color } = payload || {};
      if (!userId) return;

      // Ignore my own broadcast    
      if (userId === currentUser.id) return;

      // If the user turned off "Show others’ cursors", skip   
      if (!showOthersRef.current) return;

      setCursors((prev) => ({ ...prev, [userId]: { x, y, username, color } }));
    });

    // Receive live node-move broadcasts
    chan.on("broadcast", { event: "node-move" }, ({ payload }) => {
      const { userId, nodeId, x, y } = payload || {};
      if (!nodeId) return;

      // Ignore my own broadcasts to avoid jitter
      if (currentUser && userId === currentUser.id) return;

      setNodes((curr) =>
        curr.map((n) => (n.id === nodeId ? { ...n, position: { x, y } } : n))
      );
    });


    // Subscribe & track our presence metadata
    const myColor = colorFromId(currentUser.id);
    const myUsername =
      currentUser.user_metadata?.username ||
      currentUser.email?.split("@")[0] ||
      "Unknown User";

    chan.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await chan.track({ userId: currentUser.id, username: myUsername, color: myColor });
        syncPresence();
      }
    });

    realtimeChannelRef.current = chan;

    return () => {
      try { chan.untrack(); } catch {}
      try { supabase.removeChannel(chan); } catch {}
      realtimeChannelRef.current = null;
      setPresenceUsers({});
    };
  }, [currentUser, mapId]);

  // close panels when clicking outside them
  useEffect(() => {
      const closeIfOutsideNode = (e) => {
        if (
          reactFlowWrapper.current &&
          reactFlowWrapper.current.contains(e.target) &&
          (!nodeDetailsPanelRef.current || !nodeDetailsPanelRef.current.contains(e.target))
        ) {
          setActiveSidebarPanel((panel) => (panel === "node" ? "settings" : panel));
        }
      };
      const closeIfOutsideEdge = (e) => {
        if (
          reactFlowWrapper.current &&
          reactFlowWrapper.current.contains(e.target) &&
          (!edgeDetailsPanelRef.current || !edgeDetailsPanelRef.current.contains(e.target))
        ) {
          setActiveSidebarPanel((panel) => (panel === "edge" ? "settings" : panel));
        }
      };
    document.addEventListener("mousedown", closeIfOutsideNode);
    document.addEventListener("mousedown", closeIfOutsideEdge);
    return () => {
      document.removeEventListener("mousedown", closeIfOutsideNode);
      document.removeEventListener("mousedown", closeIfOutsideEdge);
    };
  }, []);

  // ----- Cursors: broadcast from pane (Realtime) -----
  const handlePaneMouseMove = useCallback(
    (evt) => {
      if (!reactFlowWrapper.current || !currentUser || !rf) return;

      const minInterval = 1000 / Math.max(5, Math.min(60, cursorFps)); // 5..60 FPS
      const now = performance.now();
      if (now - lastCursorSentRef.current < minInterval) return;
      lastCursorSentRef.current = now;

      // screen -> flow coords
      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const px = evt.clientX - bounds.left;
      const py = evt.clientY - bounds.top;
      const { x, y } = rf.project({ x: px, y: py });

      const userId = currentUser.id;
      const username =
        currentUser.user_metadata?.username ||
        currentUser.email?.split("@")[0] ||
        "Unknown User";
      const color = colorFromId(userId);

      const chan = realtimeChannelRef.current;
      if (chan) {
        chan.send({
          type: "broadcast",
          event: "cursor",
          payload: { x, y, userId, username, color, ts: Date.now() },
        });
      }

      // Draw my own cursor locally only if enabled (still broadcast regardless)
      if (showMyCursor) {
        setCursors((prev) => ({ ...prev, [userId]: { x, y, username, color } }));
      } else {
        // if previously drawn and now disabled, clear my local dot
        setCursors((prev) => {
          if (!prev[userId]) return prev;
          const { [userId]: _mine, ...rest } = prev;
          return rest;
        });
      }
    },
    [currentUser, rf, cursorFps, showMyCursor]
  );


  // ---- UI Handlers ----
  const handleHome = () => {
    if (typeof onHome === "function") {
      onHome();
      return;
    }
    navigate("/", { replace: true });
  };

  // Helper: flow -> screen (to render absolute cursor at correct spot)
  const flowToScreen = useCallback(
    ({ x, y }) => {
      if (!rf) return { left: x, top: y };
      const { x: tx, y: ty, zoom } = rf.getViewport();
      return { left: x * zoom + tx, top: y * zoom + ty };
    },
      [rf]
    );

  const isNodePanelActive = activeSidebarPanel === "node" && selectedNode;
  const isEdgePanelActive = activeSidebarPanel === "edge" && selectedEdge;
  const isSettingsPanelActive = !isNodePanelActive && !isEdgePanelActive;
  const selectedNodeBlocks = selectedNode ? getBlocksForNodeId(selectedNode.id) : [];
  const selectedNodeTags = selectedNode ? getNodeTags(selectedNode) : [];
  const selectedNodeType = selectedNode ? getNodeType(selectedNode) : NODE_TYPE_DEFAULT;
  const allTags = Array.from(
    new Set(nodes.flatMap((node) => getNodeTags(node)))
  ).sort((a, b) => a.localeCompare(b));

  const normalizedFilterQuery = filterQuery.trim().toLowerCase();
  const normalizedTagFilter = activeTagFilter.trim().toLowerCase();
  const filterQueryValue = normalizedFilterQuery.startsWith("#")
    ? normalizedFilterQuery.slice(1)
    : normalizedFilterQuery;
  const isFilterActive = Boolean(filterQueryValue || normalizedTagFilter);

  const matchesFilter = (node) => {
    const title = getNodeTitle(node).toLowerCase();
    const tags = getNodeTags(node).map((tag) => String(tag).toLowerCase());
    const queryMatch =
      !filterQueryValue ||
      title.includes(filterQueryValue) ||
      tags.some((tag) => tag.includes(filterQueryValue));
    const tagMatch = !normalizedTagFilter || tags.includes(normalizedTagFilter);
    return queryMatch && tagMatch;
  };

  const filterMatches = new Set(nodes.filter(matchesFilter).map((node) => node.id));

  const focusNodeIds =
    focusMode && selectedNode
      ? (() => {
          const ids = new Set([selectedNode.id]);
          edges.forEach((edge) => {
            if (edge.source === selectedNode.id) ids.add(edge.target);
            if (edge.target === selectedNode.id) ids.add(edge.source);
          });
          return ids;
        })()
      : null;

  const displayNodes = (focusNodeIds ? nodes.filter((node) => focusNodeIds.has(node.id)) : nodes).map(
    (node) => {
      const isDimmed = isFilterActive && !filterMatches.has(node.id);
      const style = isDimmed ? { ...node.style, opacity: 0.25 } : node.style;
      return {
        ...node,
        style,
        data: { ...(node.data || {}), label: renderNode(node, { isDimmed }) },
      };
    }
  );

  const displayEdges = (focusNodeIds
    ? edges.filter((edge) => focusNodeIds.has(edge.source) && focusNodeIds.has(edge.target))
    : edges
  ).map((edge) => {
    if (!isFilterActive) return edge;
    const sourceMatch = filterMatches.has(edge.source);
    const targetMatch = filterMatches.has(edge.target);
    const baseOpacity =
      edge.style?.strokeOpacity ?? DEFAULT_EDGE_STYLE.strokeOpacity ?? 1;
    const strokeOpacity = sourceMatch && targetMatch ? baseOpacity : Math.min(0.15, baseOpacity);
    return { ...edge, style: { ...edge.style, strokeOpacity } };
  });

  const normalizedCommandQuery = commandQuery.trim().toLowerCase();
  const paletteResults = normalizedCommandQuery
    ? nodes
        .map((node) => {
          const title = getNodeTitle(node);
          const lowerTitle = title.toLowerCase();
          const blocks = getBlocksForNodeId(node.id);
          const textMatch = blocks.some(
            (block) =>
              block?.type === "text" &&
              normalizeBlockText(block.text).toLowerCase().includes(normalizedCommandQuery)
          );
          const titleMatch = lowerTitle.includes(normalizedCommandQuery);
          if (!titleMatch && !textMatch) return null;
          return { node, title, snippet: getSnippetFromBlocks(blocks) };
        })
        .filter(Boolean)
        .slice(0, 50)
    : [];

  const backlinkItems = selectedNode
    ? (() => {
        const map = new Map();
        edges.forEach((edge) => {
          if (edge.source === selectedNode.id) {
            const entry = map.get(edge.target) || { id: edge.target, incoming: false, outgoing: false };
            entry.outgoing = true;
            map.set(edge.target, entry);
          }
          if (edge.target === selectedNode.id) {
            const entry = map.get(edge.source) || { id: edge.source, incoming: false, outgoing: false };
            entry.incoming = true;
            map.set(edge.source, entry);
          }
        });
        return Array.from(map.values())
          .map((entry) => {
            const node = nodes.find((n) => n.id === entry.id);
            if (!node) return null;
            const direction = entry.incoming && entry.outgoing ? "Both" : entry.incoming ? "Incoming" : "Outgoing";
            return { id: entry.id, node, title: getNodeTitle(node), direction };
          })
          .filter(Boolean);
      })()
    : [];
  const accentColor = deriveAccentColor(bgColor);
  const mapStyleVars = {
    "--map-page-bg": bgPageColor,
    "--map-grid": bgColor,
    "--map-accent": accentColor,
  };

  if (accessNotice) {
    return (
      <div className="mapView" style={mapStyleVars}>
        <div className="permissionNotice is-blocked" role="alert">
          {accessNotice}
        </div>
      </div>
    );
  }

  return (
      <div className="mapView" style={mapStyleVars}>
        {permissionNotice && (
          <div className="permissionNotice" role="alert">
            {permissionNotice}
          </div>
        )}
        <div ref={reactFlowWrapper} className="mapStage map-editor reactflowWrapper">
          <div className="mapCanvas">
            <ReactFlow
              nodes={displayNodes}
            edges={displayEdges}
            defaultEdgeOptions={{
              style: { ...DEFAULT_EDGE_STYLE },
            }}
            nodesDraggable={canEditMap}
            nodesConnectable={canEditMap}
            edgesUpdatable={canEditMap}
            onNodesChange={handleNodeChanges}
            onEdgesChange={handleEdgeChanges}
            onContextMenu={onContextMenu}
            onConnect={onConnect}
            onPaneClick={() => {
              setActiveSidebarPanel("settings");
            }}
            onNodeClick={onNodeClick}
            onNodeDrag={handleNodeDrag}
            onNodeDragStop={handleNodeDragStop}

            onEdgeClick={onEdgeClick}
            onSelectionChange={onSelectionChange}
            onNodeDoubleClick={onNodeDoubleClick}
            onEdgeDoubleClick={onEdgeDoubleClick}
            onPaneMouseMove={handlePaneMouseMove}
            selectNodesOnDrag
            fitView
          >
            {/* Background chooser (per-user) */}
            {bgStyle !== "none" && (
              <Background
                id="editor-bg"
                variant={bgStyle === "dots" ? BackgroundVariant.Dots : BackgroundVariant.Lines}
                gap={24}
                size={1}
                color={bgColor}
              />
            )}
            </ReactFlow>

            {/* Live cursors (drawn in screen space using viewport transform) */}
            {Object.entries(cursors).map(([id, cursor]) => {
              // hide mine if "show my cursor" is off
            if (!showMyCursor && currentUser?.id === id) return null;
            // hide others if toggle is off
            if (!showOthersCursors && currentUser?.id !== id) return null;

            const pos = flowToScreen({ x: cursor.x, y: cursor.y }); // or your existing screen coord helper
            return (
              <div
                key={id}
                style={{
                  position: "absolute",
                  left: pos.left,
                  top: pos.top,
                  transform: "translate(-50%, -50%)",
                  pointerEvents: "none",
                  zIndex: 1000,
                }}
              >
                <div className="cursor-dot" style={{ background: cursor.color }} />
                <div className="cursor-label">{cursor.username}</div>
              </div>
            );
          })}





          {/* Context menu */}
            {contextMenu && (
              <ContextMenu
                position={contextMenu}
                onAddNode={() => addNode({ x: contextMenu.x, y: contextMenu.y })}
                onRename={() => selectedNode && onNodeDoubleClick(null, selectedNode)}
                onClose={closeContextMenu}
              />
            )}
          </div>

          <div className="mapOverlay">
            <button
              type="button"
              className="mapHelpButton glass"
              onClick={openShortcuts}
              title="Show keyboard shortcuts"
            >
              ?
            </button>

            {minimapEnabled && (
              <div className="mapMiniMap glass">
                <MiniMap
                  className="mapMiniMapInner"
                  nodeColor="rgba(15,23,42,0.45)"
                  nodeStrokeColor="rgba(15,23,42,0.35)"
                  nodeStrokeWidth={1}
                  nodeBorderRadius={6}
                  maskColor="rgba(15,23,42,0.12)"
                  maskStrokeColor={accentColor}
                  maskStrokeWidth={2}
                  pannable
                  zoomable
                />
              </div>
            )}

            {/* RIGHT: Side panel */}
            <div className={`me-sidepanel mapSidebar glass ${isSidebarCollapsed ? "is-collapsed" : ""}`}>
              {!isSidebarCollapsed && (
                <div className="sidebarHeader">
                  <h3 className="sidebarTitle">Learning Space</h3>
                  <button
                    type="button"
                    className="sidebarCollapseButton"
                    onClick={() => setIsSidebarCollapsed(true)}
                    title="Collapse sidebar"
                  >
                    &lt;
                  </button>
                </div>
              )}

              {isSidebarCollapsed ? (
                <div className="sidebarRail">
                  <button
                    type="button"
                    className="sidebarRailButton"
                    onClick={() => setIsSidebarCollapsed(false)}
                    title="Expand sidebar"
                  >
                    &gt;
                  </button>
                  <div className="sidebarRailDivider" />
                  <button
                    type="button"
                    className="sidebarRailButton"
                    onClick={() => openSidebarPanel("settings", "appearance")}
                    title="Settings"
                  >
                    S
                  </button>
                  <button
                    type="button"
                    className="sidebarRailButton"
                    onClick={openShortcuts}
                    title="Shortcuts"
                  >
                    ?
                  </button>
                  <button
                    type="button"
                    className="sidebarRailButton"
                    onClick={() => selectedNode && openSidebarPanel("node")}
                    title="Node details"
                    disabled={!selectedNode}
                  >
                    N
                  </button>
                  <button
                    type="button"
                    className="sidebarRailButton"
                    onClick={() => selectedEdge && openSidebarPanel("edge")}
                    title="Edge details"
                    disabled={!selectedEdge}
                  >
                    E
                  </button>
                </div>
              ) : (
                <>
                  {isSettingsPanelActive && (
                    <div className="sidebarStack">
                      <SidebarSection
                        id="actions"
                        title="Actions"
                        activeId={activeSettingsSection}
                        onToggle={toggleSettingsSection}
                        alwaysOpen
                      >
                        <div className="sidebarActions">
                          <button onClick={handleHome} className="btn-primary">
                            Home Page
                          </button>
                        </div>
                      </SidebarSection>

                      <SidebarSection
                        id="filter"
                        title="Filter & Focus"
                        activeId={activeSettingsSection}
                        onToggle={toggleSettingsSection}
                        alwaysOpen
                      >
                        <div className="me-field">
                          <label className="me-label">Search nodes</label>
                          <div className="filterRow">
                            <input
                              type="text"
                              className="me-input"
                              placeholder="Search title or #tag"
                              value={filterQuery}
                              onChange={(e) => setFilterQuery(e.target.value)}
                            />
                            <button
                              type="button"
                              className="filterClearButton"
                              onClick={() => {
                                setFilterQuery("");
                                setActiveTagFilter("");
                              }}
                              disabled={!isFilterActive}
                            >
                              Clear
                            </button>
                          </div>
                          <div className="me-meta">
                            Matches node titles and tags. Use #tag for tags.
                          </div>
                        </div>

                        {activeTagFilter && (
                          <div className="filterActiveTag">
                            <span className="filterLabel">Tag filter</span>
                            <button
                              type="button"
                              className="tagChipButton is-active"
                              onClick={() => setActiveTagFilter("")}
                            >
                              {activeTagFilter} ×
                            </button>
                          </div>
                        )}

                        <div className="tagList">
                          {allTags.length === 0 ? (
                            <div className="me-meta">No tags yet.</div>
                          ) : (
                            allTags.map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                className={`tagChipButton ${activeTagFilter === tag ? "is-active" : ""}`}
                                onClick={() => setActiveTagFilter(tag)}
                              >
                                {tag}
                              </button>
                            ))
                          )}
                        </div>

                        <div className="filterDivider" />

                        <label className="toggleRow" htmlFor="toggle-focus">
                          <span className="toggleText">Focus mode</span>
                          <span className="toggleSwitch">
                            <input
                              id="toggle-focus"
                              type="checkbox"
                              checked={focusMode}
                              onChange={(e) => setFocusMode(e.target.checked)}
                            />
                            <span className="toggleSlider" />
                          </span>
                        </label>
                        <div className="me-meta">
                          Shows the selected node and its direct neighbors.
                        </div>
                        {focusMode && (
                          <div className="focusRow">
                            <button
                              type="button"
                              className="focusExitButton"
                              onClick={() => setFocusMode(false)}
                            >
                              Exit focus
                            </button>
                            {!selectedNode && (
                              <span className="me-meta">Select a node to focus.</span>
                            )}
                          </div>
                        )}
                      </SidebarSection>

                      <SidebarSection
                        id="appearance"
                        title="Appearance"
                        activeId={activeSettingsSection}
                        onToggle={toggleSettingsSection}
                        alwaysOpen
                      >
                        <div className="me-field">
                          <span className="me-label">Background</span>
                          <div className="segmentedControl" role="radiogroup" aria-label="Background style">
                            <label className={`segment ${bgStyle === "dots" ? "is-active" : ""}`}>
                              <input
                                type="radio"
                                name="bgStyle"
                                value="dots"
                                checked={bgStyle === "dots"}
                                onChange={() => setBgStyle("dots")}
                              />
                              <span className="segmentContent">
                                <span className="segmentIcon segmentIcon-dots" aria-hidden="true" />
                                <span>Dots</span>
                              </span>
                            </label>
                            <label className={`segment ${bgStyle === "lines" ? "is-active" : ""}`}>
                              <input
                                type="radio"
                                name="bgStyle"
                                value="lines"
                                checked={bgStyle === "lines"}
                                onChange={() => setBgStyle("lines")}
                              />
                              <span className="segmentContent">
                                <span className="segmentIcon segmentIcon-lines" aria-hidden="true" />
                                <span>Lines</span>
                              </span>
                            </label>
                            <label className={`segment ${bgStyle === "none" ? "is-active" : ""}`}>
                              <input
                                type="radio"
                                name="bgStyle"
                                value="none"
                                checked={bgStyle === "none"}
                                onChange={() => setBgStyle("none")}
                              />
                              <span className="segmentContent">
                                <span className="segmentIcon segmentIcon-none" aria-hidden="true" />
                                <span>None</span>
                              </span>
                            </label>
                          </div>
                        </div>

                        <ColorControl
                          id="canvas-color"
                          label="Canvas color"
                          value={bgPageColor}
                          onChange={setBgPageColor}
                          onCopy={copyToClipboard}
                          pickerTitle="Background fill behind the grid"
                        />

                        <ColorControl
                          id="grid-color"
                          label="Grid color"
                          value={bgColor}
                          onChange={setBgColor}
                          onCopy={copyToClipboard}
                        />

                        <label className="toggleRow" htmlFor="toggle-minimap">
                          <span className="toggleText">Show MiniMap</span>
                          <span className="toggleSwitch">
                            <input
                              id="toggle-minimap"
                              type="checkbox"
                              checked={minimapEnabled}
                              onChange={(e) => setMinimapEnabled(e.target.checked)}
                            />
                            <span className="toggleSlider" />
                          </span>
                        </label>
                      </SidebarSection>

                      <SidebarSection
                        id="cursors"
                        title="Cursors"
                        activeId={activeSettingsSection}
                        onToggle={toggleSettingsSection}
                        alwaysOpen
                      >
                        <div className="me-field">
                          <label className="me-label">Cursor FPS: {cursorFps}</label>
                          <input
                            type="range"
                            min={5}
                            max={60}
                            step={1}
                            value={cursorFps}
                            onChange={(e) => setCursorFps(parseInt(e.target.value, 10))}
                            className="me-range"
                          />
                          <small className="me-help">Higher FPS = smoother, but more messages.</small>
                        </div>

                        <label className="toggleRow" htmlFor="toggle-my-cursor">
                          <span className="toggleText">Show my cursor</span>
                          <span className="toggleSwitch">
                            <input
                              id="toggle-my-cursor"
                              type="checkbox"
                              checked={showMyCursor}
                              onChange={(e) => setShowMyCursor(e.target.checked)}
                            />
                            <span className="toggleSlider" />
                          </span>
                        </label>

                        <label className="toggleRow" htmlFor="toggle-others-cursor">
                          <span className="toggleText">Show others' cursors</span>
                          <span className="toggleSwitch">
                            <input
                              id="toggle-others-cursor"
                              type="checkbox"
                              checked={showOthersCursors}
                              onChange={(e) => setShowOthersCursors(e.target.checked)}
                            />
                            <span className="toggleSlider" />
                          </span>
                        </label>
                      </SidebarSection>

                      <SidebarSection
                        id="details"
                        title="Learning Space"
                        activeId={activeSettingsSection}
                        onToggle={toggleSettingsSection}
                        alwaysOpen
                      >
                        <div className="me-field">
                          <label className="me-label">Learning Space Name</label>
                          <input
                            type="text"
                            value={mapName}
                            onChange={(e) => setMapName(e.target.value)}
                            onBlur={() => updateMapRow(nodes, edges)}
                            disabled={!canEditMap}
                            placeholder="Enter Learning Space name"
                            className="me-input"
                            title={!canEditMap ? "Only editors or admins can edit the map." : undefined}
                          />
                        </div>

                        <div className="me-field">
                          <label className="me-label">Learning Space Description</label>
                          <textarea
                            value={mapDescription}
                            onChange={(e) => setMapDescription(e.target.value)}
                            onBlur={() => updateMapRow(nodes, edges)}
                            disabled={!canEditMap}
                            placeholder="Enter Learning Space description"
                            className="me-textarea"
                            title={!canEditMap ? "Only editors or admins can edit the map." : undefined}
                          />
                        </div>

                        <div className="me-field">
                          <label className="me-label">Learning Space ID</label>
                          <div className="inlineRow">
                            <div className="me-chip">{mapId}</div>
                            <button
                              type="button"
                              className="copyButton"
                              onClick={() => copyToClipboard(mapId)}
                              aria-label="Copy Learning Space ID"
                            >
                              Copy
                            </button>
                          </div>
                        </div>

                        <div className="me-field">
                          <label className="me-label">Last Edited</label>
                          <div className="me-meta">{lastEdited}</div>
                        </div>
                      </SidebarSection>

                      <SidebarSection
                        id="participants"
                        title={`Participants (${participants.length})`}
                        activeId={activeSettingsSection}
                        onToggle={toggleSettingsSection}
                        alwaysOpen
                      >
                        <ul className="participantList">
                          {participants.map((p) => {
                            const roleValue = p.role || "viewer";
                            const roleLabel =
                              roleValue === "admin" ? "Admin" : roleValue === "editor" ? "Editor" : "Viewer";
                            const isSelf = currentUser?.id === p.id;
                            const isRoleLocked = roleValue === "admin" || p.isAdmin;
                            const canEditRole = isAdmin && !isRoleLocked;
                            const canRemove = isAdmin && !isRoleLocked && !isSelf;
                            const busy = memberActionId === p.id;
                            return (
                              <li key={p.id} className="participantRow">
                                <div className="participantIdentity">
                                  <img
                                    src={p.profile_picture || DEFAULT_AVATAR_URL}
                                    alt={`${p.username}'s profile`}
                                    className="participantAvatar"
                                    onError={handleAvatarError}
                                  />
                                  <div>
                                    <div className="participantName">
                                      <span className="participantNameText">
                                        {p.username} {isSelf ? "(Me)" : ""}
                                      </span>
                                      {canEditRole ? (
                                        <select
                                          className="participantRoleSelect"
                                          value={roleValue}
                                          onChange={(e) =>
                                            handleMemberRoleChange(p.id, e.target.value)
                                          }
                                          disabled={busy}
                                          aria-label={`Set role for ${p.username}`}
                                        >
                                          <option value="viewer">viewer</option>
                                          <option value="editor">editor</option>
                                        </select>
                                      ) : (
                                        <span className={`participantRole ${roleValue}`}>{roleLabel}</span>
                                      )}
                                    </div>
                                    <div
                                      className={`participantStatus ${
                                        (p.online ?? !!presenceUsers[p.id]) ? "online" : "offline"
                                      }`}
                                    >
                                      {(p.online ?? !!presenceUsers[p.id]) ? "online" : "offline"}
                                    </div>
                                  </div>
                                </div>
                                {canRemove && (
                                  <button
                                    type="button"
                                    className="participantRemoveButton"
                                    onClick={() => handleRemoveParticipant(p.id)}
                                    disabled={busy}
                                  >
                                    Remove
                                  </button>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </SidebarSection>

                      <SidebarSection
                        id="shortcuts"
                        title="Shortcuts"
                        activeId={activeSettingsSection}
                        onToggle={toggleSettingsSection}
                        sectionRef={shortcutsSectionRef}
                        alwaysOpen
                      >
                        <ul className="shortcutsList">
                          <li>
                            <span className="shortcutKey">N</span> Add a new node
                          </li>
                          <li>
                            <span className="shortcutKey">Del/Backspace</span> Delete selected node
                          </li>
                          <li>
                            <span className="shortcutKey">Right-click</span> Rename node, add node
                          </li>
                          <li>
                            <span className="shortcutKey">Double-click</span> Rename a node
                          </li>
                          <li>
                            <span className="shortcutKey">Click node</span> Open node details
                          </li>
                          <li>
                            <span className="shortcutKey">Click edge</span> Open edge details
                          </li>
                          <li>
                            <span className="shortcutKey">Click background</span> Close node or edge details
                          </li>
                        </ul>
                        <div className="shortcutsFooter">Total Nodes: {nodes.length}</div>
                      </SidebarSection>
                    </div>
                  )}

                  {isNodePanelActive && (
                    <div className="sidebarPanel glass" ref={nodeDetailsPanelRef}>
                      <div className="sidebarPanelHeader">
                        <h3>Node Details</h3>
                        <button
                          type="button"
                          onClick={() => setActiveSidebarPanel("settings")}
                          className="panelCloseButton"
                          aria-label="Close node details"
                        >
                          X
                        </button>
                      </div>

                      <div className="sidebarPanelBody">
                        <div className="nodeTabs" role="tablist" aria-label="Node tabs">
                          <button
                            type="button"
                            className={`nodeTab ${activeNodeTab === "content" ? "is-active" : ""}`}
                            onClick={() => setActiveNodeTab("content")}
                            role="tab"
                            aria-selected={activeNodeTab === "content"}
                          >
                            Content
                          </button>
                          <button
                            type="button"
                            className={`nodeTab ${activeNodeTab === "style" ? "is-active" : ""}`}
                            onClick={() => setActiveNodeTab("style")}
                            role="tab"
                            aria-selected={activeNodeTab === "style"}
                          >
                            Style
                          </button>
                          <button
                            type="button"
                            className={`nodeTab ${activeNodeTab === "details" ? "is-active" : ""}`}
                            onClick={() => setActiveNodeTab("details")}
                            role="tab"
                            aria-selected={activeNodeTab === "details"}
                          >
                            Details
                          </button>
                        </div>

                        {activeNodeTab === "content" && (
                          <div className="nodeTabPanel">
                            <div className="nodeBlockActions">
                              <button
                                type="button"
                                className="nodeBlockButton"
                                onClick={() => handleAddBlock("text")}
                                disabled={isReadOnly}
                              >
                                Add Text
                              </button>
                              <button
                                type="button"
                                className="nodeBlockButton"
                                onClick={() => handleAddBlock("image")}
                                disabled={isReadOnly}
                              >
                                Add Image
                              </button>
                              <button
                                type="button"
                                className="nodeBlockButton"
                                onClick={() => handleAddBlock("video")}
                                disabled={isReadOnly}
                              >
                                Add Video
                              </button>
                              <button
                                type="button"
                                className="nodeBlockButton"
                                onClick={() => handleAddBlock("link")}
                                disabled={isReadOnly}
                              >
                                Add Link
                              </button>
                            </div>

                            {selectedNodeBlocks.length === 0 ? (
                              <div className="nodeBlocksEmpty">
                                No content yet. Add a block to get started.
                              </div>
                            ) : (
                              <div className="nodeBlockList">
                                {selectedNodeBlocks.map((block, index) => {
                                  const blockKey = block?.id || `${block?.type || "block"}-${index}`;
                                  const blockTitle = block?.type
                                    ? `${block.type.charAt(0).toUpperCase()}${block.type.slice(1)}`
                                    : "Block";
                                  const isFirst = index === 0;
                                  const isLast = index === selectedNodeBlocks.length - 1;
                                  const uploadState = blockUploadState?.[blockKey] || {};
                                  const isUploading = !!uploadState.uploading;
                                  const uploadError = uploadState.error;
                                  const pendingFile = pendingUploadFiles?.[blockKey];
                                  const blockUrl = normalizeBlockText(block?.url);
                                  const videoEmbedUrl = blockUrl ? getVideoEmbedUrl(blockUrl) : "";
                                  const isDirectVideo = blockUrl ? isDirectVideoUrl(blockUrl) : false;
                                  return (
                                    <div key={blockKey} className="nodeBlockCard">
                                      <div className="nodeBlockHeader">
                                        <span className="nodeBlockTitle">{blockTitle}</span>
                                        <div className="nodeBlockControls">
                                          <button
                                            type="button"
                                            className="nodeBlockReorder"
                                            onClick={() => handleMoveBlock(blockKey, index, -1)}
                                            disabled={isReadOnly || isFirst}
                                            title="Move up"
                                            aria-label="Move block up"
                                          >
                                            ↑
                                          </button>
                                          <button
                                            type="button"
                                            className="nodeBlockReorder"
                                            onClick={() => handleMoveBlock(blockKey, index, 1)}
                                            disabled={isReadOnly || isLast}
                                            title="Move down"
                                            aria-label="Move block down"
                                          >
                                            ↓
                                          </button>
                                          <button
                                            type="button"
                                            className="nodeBlockRemove"
                                            onClick={() => handleRemoveBlock(blockKey, index)}
                                            disabled={isReadOnly}
                                          >
                                            Remove
                                          </button>
                                        </div>
                                      </div>

                                      {block?.type === "text" && (
                                        <div className="me-field">
                                          <label className="me-label">Text</label>
                                          <textarea
                                            value={block.text || ""}
                                            onChange={(e) =>
                                              handleBlockFieldChange(blockKey, index, "text", e.target.value)
                                            }
                                            onBlur={handleBlockBlur}
                                            placeholder="Write a note..."
                                            className="me-textarea"
                                            rows={3}
                                            readOnly={isReadOnly}
                                          />
                                        </div>
                                      )}

                                      {(block?.type === "image" || block?.type === "video") && (
                                        <>
                                          <div className="me-field">
                                            <label className="me-label">URL</label>
                                            <input
                                              type="text"
                                              value={block.url || ""}
                                              onChange={(e) =>
                                                handleBlockFieldChange(blockKey, index, "url", e.target.value)
                                              }
                                              onBlur={handleBlockBlur}
                                              placeholder={`Add a ${block.type} URL`}
                                              className="me-input"
                                              disabled={isReadOnly || isUploading}
                                            />
                                          </div>
                                          <div className="nodeBlockUploadRow">
                                            <input
                                              type="file"
                                              className="nodeBlockUploadInput"
                                              accept={
                                                block.type === "image"
                                                  ? ".png,.jpg,.jpeg,.webp,.gif,image/png,image/jpeg,image/webp,image/gif"
                                                  : ".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime"
                                              }
                                              onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                handleBlockFileSelection(
                                                  blockKey,
                                                  file,
                                                  block.type,
                                                  () => {
                                                    e.target.value = "";
                                                  }
                                                );
                                              }}
                                              disabled={isReadOnly || isUploading}
                                            />
                                            <button
                                              type="button"
                                              className="nodeBlockUploadButton"
                                              onClick={() => handleBlockUpload(blockKey, index, block.type)}
                                              disabled={isReadOnly || isUploading || !pendingFile}
                                            >
                                              {isUploading ? (
                                                <>
                                                  <span className="uploadSpinner" aria-hidden="true" />
                                                  Uploading...
                                                </>
                                              ) : (
                                                "Upload"
                                              )}
                                            </button>
                                            {blockUrl && (
                                              <button
                                                type="button"
                                                className="nodeBlockUploadButton is-ghost"
                                                onClick={() => handleRemoveBlockMedia(blockKey, index)}
                                                disabled={isReadOnly || isUploading}
                                              >
                                                Remove
                                              </button>
                                            )}
                                          </div>
                                          {pendingFile && !isUploading && (
                                            <div className="nodeBlockUploadHint">Selected: {pendingFile.name}</div>
                                          )}
                                          {uploadError && <div className="nodeBlockUploadError">{uploadError}</div>}
                                          <div className="me-field">
                                            <label className="me-label">Caption (optional)</label>
                                            <input
                                              type="text"
                                              value={block.caption || ""}
                                              onChange={(e) =>
                                                handleBlockFieldChange(blockKey, index, "caption", e.target.value)
                                              }
                                              onBlur={handleBlockBlur}
                                              placeholder="Add a caption"
                                              className="me-input"
                                              disabled={isReadOnly || isUploading}
                                            />
                                          </div>
                                          {block?.type === "image" && blockUrl && (
                                            <img
                                              src={block.url}
                                              alt={block.caption || "Image preview"}
                                              className="nodeBlockImagePreview"
                                              onError={(e) => {
                                                e.currentTarget.style.display = "none";
                                              }}
                                            />
                                          )}
                                          {block?.type === "video" && blockUrl && (
                                            <>
                                              {isDirectVideo && (
                                                <video
                                                  className="nodeBlockVideoPreview"
                                                  src={block.url}
                                                  controls
                                                  preload="metadata"
                                                />
                                              )}
                                              {!isDirectVideo && videoEmbedUrl && (
                                                <div className="nodeBlockVideoEmbed">
                                                  <iframe
                                                    src={videoEmbedUrl}
                                                    title="Video preview"
                                                    frameBorder="0"
                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                    allowFullScreen
                                                  />
                                                </div>
                                              )}
                                              {!isDirectVideo && !videoEmbedUrl && (
                                                <div className="nodeBlockVideoFallback">
                                                  Preview not available
                                                </div>
                                              )}
                                              <a
                                                href={block.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="nodeBlockLink"
                                              >
                                                Open video
                                              </a>
                                            </>
                                          )}
                                        </>
                                      )}

                                      {block?.type === "link" && (
                                        <>
                                          <div className="me-field">
                                            <label className="me-label">URL</label>
                                            <input
                                              type="text"
                                              value={block.url || ""}
                                              onChange={(e) =>
                                                handleBlockFieldChange(blockKey, index, "url", e.target.value)
                                              }
                                              onBlur={handleBlockBlur}
                                              placeholder="Add a link URL"
                                              className="me-input"
                                              disabled={isReadOnly}
                                            />
                                          </div>
                                          <div className="me-field">
                                            <label className="me-label">Label (optional)</label>
                                            <input
                                              type="text"
                                              value={block.label || ""}
                                              onChange={(e) =>
                                                handleBlockFieldChange(blockKey, index, "label", e.target.value)
                                              }
                                              onBlur={handleBlockBlur}
                                              placeholder="Short label"
                                              className="me-input"
                                              disabled={isReadOnly}
                                            />
                                          </div>
                                          {normalizeBlockText(block.url) && (
                                            <a
                                              href={block.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="nodeBlockLink"
                                            >
                                              Open link
                                            </a>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {activeNodeTab === "style" && (
                          <div className="nodeTabPanel">
                            <div className="nodePresetSection">
                              <div className="nodePresetLabel">Presets</div>
                              <div className="nodePresetList">
                                {NODE_STYLE_PRESETS.map((preset) => (
                                  <button
                                    key={preset.id}
                                    type="button"
                                    className={`nodePresetButton ${
                                      activePresetId === preset.id ? "is-active" : ""
                                    }`}
                                    onClick={() => handleApplyPreset(preset.id)}
                                    disabled={isReadOnly || !selectedNode}
                                    title={`Apply ${preset.label} preset`}
                                    aria-label={`Apply ${preset.label} preset`}
                                  >
                                    <span
                                      className="nodePresetSwatch"
                                      style={{ backgroundColor: preset.borderColor }}
                                    />
                                    {preset.label}
                                  </button>
                                ))}
                              </div>
                              {!selectedNode && (
                                <div className="nodePresetHint">Select a node to apply a preset.</div>
                              )}
                            </div>
                            <ColorControl
                              id="node-border-color"
                              label="Border Color"
                              value={borderColor}
                              onChange={handleBorderColorChange}
                              onCopy={copyToClipboard}
                              disabled={isReadOnly}
                            />
                          </div>
                        )}

                        {activeNodeTab === "details" && (
                          <div className="nodeTabPanel">
                            <div className="nodeDetailsHeader glass">
                              <div>
                                <div className="nodeDetailsTitle">
                                  {nodeCreators[selectedNode.creator]?.username || "Unknown Creator"}
                                </div>
                                <div className="nodeDetailsMeta">
                                  Created: {new Date(selectedNode.creationTimestamp).toLocaleDateString()}
                                </div>
                              </div>
                              <img
                                src={nodeCreators[selectedNode.creator]?.profile_picture || DEFAULT_AVATAR_URL}
                                alt="Creator Avatar"
                                className="nodeDetailsAvatar"
                                onError={handleAvatarError}
                              />
                            </div>

                            <div className="me-field">
                              <label className="me-label">Type</label>
                              <select
                                className="me-input"
                                value={selectedNodeType}
                                onChange={handleNodeTypeChange}
                                disabled={isReadOnly}
                              >
                                {NODE_TYPE_OPTIONS.map((type) => (
                                  <option key={type} value={type}>
                                    {type}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="me-field">
                              <label className="me-label">Tags</label>
                              <div className="tagInputRow">
                                <input
                                  type="text"
                                  className="me-input"
                                  placeholder="Add a tag and press Enter"
                                  value={tagInput}
                                  onChange={(e) => setTagInput(e.target.value)}
                                  onKeyDown={handleTagInputKeyDown}
                                  disabled={isReadOnly}
                                />
                                <button
                                  type="button"
                                  className="tagAddButton"
                                  onClick={handleAddTag}
                                  disabled={isReadOnly || !tagInput.trim()}
                                >
                                  Add
                                </button>
                              </div>
                              <div className="tagList">
                                {selectedNodeTags.length === 0 ? (
                                  <div className="me-meta">No tags yet.</div>
                                ) : (
                                  selectedNodeTags.map((tag) => (
                                    <div key={tag} className="tagChip">
                                      <button
                                        type="button"
                                        className="tagChipLabel"
                                        onClick={() => setActiveTagFilter(tag)}
                                        title="Filter by this tag"
                                      >
                                        {tag}
                                      </button>
                                      <button
                                        type="button"
                                        className="tagChipRemove"
                                        onClick={() => handleRemoveTag(tag)}
                                        aria-label={`Remove tag ${tag}`}
                                        disabled={isReadOnly}
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>

                            <div className="me-field">
                              <label className="me-label">Backlinks</label>
                              {backlinkItems.length === 0 ? (
                                <div className="me-meta">No connected nodes yet.</div>
                              ) : (
                                <div className="backlinksList">
                                  {backlinkItems.map((item) => (
                                    <button
                                      key={item.id}
                                      type="button"
                                      className="backlinkItem"
                                      onClick={() => selectNodeById(item.id, { center: true })}
                                    >
                                      <span className="backlinkTitle">
                                        {item.title || `Node ${item.id}`}
                                      </span>
                                      <span
                                        className={`backlinkDirection is-${item.direction.toLowerCase()}`}
                                      >
                                        {item.direction}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="me-field">
                              <label className="me-label">Node Name</label>
                              <div className="me-chip">{getNodeTitle(selectedNode)}</div>
                            </div>

                            <div className="me-field">
                              <label className="me-label">Node ID</label>
                              <div className="inlineRow">
                                <div className="me-chip">{selectedNode.id}</div>
                                <button
                                  type="button"
                                  className="copyButton"
                                  onClick={() => copyToClipboard(selectedNode.id)}
                                  aria-label="Copy Node ID"
                                >
                                  Copy
                                </button>
                              </div>
                            </div>

                            <div className="me-field">
                              <label className="me-label">Created</label>
                              <div className="me-chip">
                                {new Date(selectedNode.creationTimestamp).toLocaleString()}
                              </div>
                            </div>

                            <div className="me-field">
                              <label className="me-label">Creator ID</label>
                              <div className="me-chip">{selectedNode.creator || "Unknown"}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {isEdgePanelActive && (
                    <div className="sidebarPanel glass" ref={edgeDetailsPanelRef}>
                      <div className="sidebarPanelHeader">
                        <h3>Edge Details</h3>
                        <button
                          type="button"
                          onClick={() => setActiveSidebarPanel("settings")}
                          className="panelCloseButton"
                          aria-label="Close edge details"
                        >
                          X
                        </button>
                      </div>
                      <div className="sidebarPanelBody">
                        <div className="me-field">
                          <label className="me-label">Label:</label>
                          <input
                            type="text"
                            value={selectedEdge.label || ""}
                            onChange={(e) => {
                              if (isReadOnly) return;
                              const updated = edges.map((edge) =>
                                edge.id === selectedEdge.id ? { ...edge, label: e.target.value } : edge
                              );
                              setEdges(updated);
                              setSelectedEdge({ ...selectedEdge, label: e.target.value });
                              updateMapRow(nodes, updated);
                            }}
                            className="me-input"
                            disabled={isReadOnly}
                          />
                        </div>

                        <div className="me-field">
                          <label className="me-label">Color:</label>
                          <input
                            type="color"
                            value={selectedEdge.style?.stroke || DEFAULT_EDGE_STYLE.stroke}
                            onChange={(e) => {
                              if (isReadOnly) return;
                              const updated = edges.map((edge) =>
                                edge.id === selectedEdge.id
                                  ? { ...edge, style: { ...edge.style, stroke: e.target.value } }
                                  : edge
                              );
                              setEdges(updated);
                              setSelectedEdge({
                                ...selectedEdge,
                                style: { ...selectedEdge.style, stroke: e.target.value },
                              });
                              updateMapRow(nodes, updated);
                            }}
                            className="me-color"
                            disabled={isReadOnly}
                          />
                        </div>

                        <div className="me-field">
                          <label className="me-label">Type:</label>
                          <div className="edgeTypeButtons">
                            <button
                              onClick={() => {
                                if (isReadOnly) return;
                                const updated = edges.map((edge) =>
                                  edge.id === selectedEdge.id
                                    ? { ...edge, style: { strokeDasharray: undefined }, markerEnd: undefined }
                                    : edge
                                );
                                setEdges(updated);
                                setSelectedEdge({
                                  ...selectedEdge,
                                  style: { strokeDasharray: undefined },
                                  markerEnd: undefined,
                                });
                                updateMapRow(nodes, updated);
                              }}
                              className="btn-primary"
                              disabled={isReadOnly}
                            >
                              Solid
                            </button>

                            <button
                              onClick={() => {
                                if (isReadOnly) return;
                                const updated = edges.map((edge) =>
                                  edge.id === selectedEdge.id
                                    ? { ...edge, style: { strokeDasharray: "5,5" }, markerEnd: undefined }
                                    : edge
                                );
                                setEdges(updated);
                                setSelectedEdge({
                                  ...selectedEdge,
                                  style: { strokeDasharray: "5,5" },
                                  markerEnd: undefined,
                                });
                                updateMapRow(nodes, updated);
                              }}
                              className="btn-primary"
                              disabled={isReadOnly}
                            >
                              Dashed
                            </button>

                            <button
                              onClick={() => {
                                if (isReadOnly) return;
                                const updated = edges.map((edge) =>
                                  edge.id === selectedEdge.id
                                    ? {
                                        ...edge,
                                        markerEnd: { type: "arrowclosed" },
                                        style: { strokeDasharray: undefined },
                                      }
                                    : edge
                                );
                                setEdges(updated);
                                setSelectedEdge({
                                  ...selectedEdge,
                                  markerEnd: { type: "arrowclosed" },
                                  style: { strokeDasharray: undefined },
                                });
                                updateMapRow(nodes, updated);
                              }}
                              className="btn-primary"
                              disabled={isReadOnly}
                            >
                              Arrow
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
        </div>
          </div>
          {commandPaletteOpen && (
            <div className="commandPaletteOverlay" onClick={() => setCommandPaletteOpen(false)}>
              <div
                className="commandPalette glass"
                role="dialog"
                aria-modal="true"
                aria-label="Command palette"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  ref={commandInputRef}
                  type="text"
                  className="commandPaletteInput"
                  placeholder="Search nodes..."
                  value={commandQuery}
                  onChange={(e) => setCommandQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setCommandPaletteOpen(false);
                      setCommandQuery("");
                    }
                  }}
                />
                <div className="commandPaletteResults">
                  {normalizedCommandQuery && paletteResults.length === 0 && (
                    <div className="commandPaletteEmpty">No matches.</div>
                  )}
                  {!normalizedCommandQuery && (
                    <div className="commandPaletteEmpty">Type to search by title or text.</div>
                  )}
                  {paletteResults.map((result) => (
                    <button
                      key={result.node.id}
                      type="button"
                      className="commandPaletteResult"
                      onClick={() => {
                        selectNodeById(result.node.id, { center: true });
                        setCommandPaletteOpen(false);
                        setCommandQuery("");
                      }}
                    >
                      <div className="commandPaletteResultTitle">
                        {result.title || `Node ${result.node.id}`}
                      </div>
                      {result.snippet && (
                        <div className="commandPaletteResultSnippet">{result.snippet}</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
};

const MapEditorWithParams = ({ mapId, onHome }) => (
  <ReactFlowProvider>
    <MapEditor mapId={mapId} onHome={onHome} />
  </ReactFlowProvider>
);

export default MapEditorWithParams;
