// MapEditor.jsx
import React, { useState, useCallback, useEffect, useRef } from "react";
import ReactFlow, {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  Panel,
  MiniMap,
  Background,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";
import { supabase } from "../supabaseClient";
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
        backgroundColor: "white",
        boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
        borderRadius: "4px",
        padding: "8px",
      }}
      className="context-menu"
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
        onMouseEnter={(e) => (e.target.style.backgroundColor = "#f0f0f0")}
        onMouseLeave={(e) => (e.target.style.backgroundColor = "transparent")}
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

const LOCAL_CURSOR_SHOW_KEY = "mapEditor:showMyCursor";
const LOCAL_CURSOR_FPS_KEY = "mapEditor:cursorFps";

const LOCAL_CURSOR_SHOW_OTHERS_KEY = "mapEditor:showOthersCursors";


const colorFromId = (userId) => {
  if (!userId) return "#0ea5e9";
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  const palette = ["#FF5733", "#33FF57", "#3357FF", "#FF33A8", "#A833FF", "#33FFF5", "#FFC233", "#FF3333", "#33FF8E", "#8E33FF", "#FF8E33", "#33A8FF", "#57FF33"];
  return palette[h % palette.length];
};

const MapEditor = ({ mapId }) => {
  // React Flow
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const rf = useReactFlow();                             // <-- NEW: instance for transforms

  // Map metadata
  const [mapName, setMapName] = useState("");
  const [mapDescription, setMapDescription] = useState("");
  const [lastEdited, setLastEdited] = useState("");
  const [mapLoaded, setMapLoaded] = useState(false);

  // Node/edge UI helpers
  const [selectedElements, setSelectedElements] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [borderColor, setBorderColor] = useState("#000000");
  const [nodeNotes, setNodeNotes] = useState({});
  const [nodeData, setNodeData] = useState({}); // { [nodeId]: { link } }
  const noteInputRef = useRef(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [showNodeDetails, setShowNodeDetails] = useState(false);
  const [showEdgeDetails, setShowEdgeDetails] = useState(false);

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
  const [participants, setParticipants] = useState([]); // [{id, username, profile_picture, online}]
  const [cursors, setCursors] = useState({}); // { userId: { x, y, username, color } }

  // Realtime presence roster (live)
  const [presenceUsers, setPresenceUsers] = useState({}); // { userId: { userId, username, color } }
  const realtimeChannelRef = useRef(null);                // <-- NEW

  // Refs to avoid noisy updates
  const prevMapRef = useRef(null);
  const lastCursorSentRef = useRef(0);

  // Current user
  const [currentUser, setCurrentUser] = useState(null);

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

  const updateMapRow = useCallback(
    async (newNodes, newEdges) => {
      if (!mapLoaded) return;
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
          node_notes: removeUndefined(nodeNotes),
          node_data: removeUndefined(nodeData),
        });

        const { error } = await supabase.from("maps").update(payload).eq("id", mapId);
        if (error) console.error("❌ Update map failed:", error);
      } catch (err) {
        console.error("❌ Unexpected updateMapRow error:", err);
      }
    },
    [mapLoaded, mapId, mapName, mapDescription, nodeNotes, nodeData]
  );

  const onEdgeDoubleClick = useCallback((e, edge) => {
    e.preventDefault();
    setSelectedEdge(edge);
  }, []);

  const onEdgeClick = useCallback((e, edge) => {
    setSelectedEdge(edge);
    setShowEdgeDetails(true);
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
        clearTimeout(saveTimeout.current);
        saveTimeout.current = setTimeout(() => {
          updateMapRow(updated, edges);
        }, 300);
        return updated;
      });
    },
    [edges, updateMapRow, editingNodeId, setNodes]
  );

  const handleEdgeChanges = useCallback(
    (changes) => {
      setEdges((eds) => {
        const updated = applyEdgeChanges(changes, eds);
        updateMapRow(nodes, updated);
        return updated;
      });
    },
    [nodes, updateMapRow, setEdges]
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
    // Debounced persist: write final positions once user stops dragging
    clearTimeout(dragSaveTimeoutRef.current);
    dragSaveTimeoutRef.current = setTimeout(() => {
      setNodes((curr) => {
        updateMapRow(curr, edges);
        return curr;
      });
    }, 250);
  }, [edges, setNodes, updateMapRow]);

  // Until here -- added live node-drag broadcasting

  const onConnect = useCallback(
    (params) => {
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
            const updated = addEdge({ ...params, markerEnd: { type: "arrowclosed" } }, eds);
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
            const updated = addEdge({ ...params, style: { strokeDasharray: "5,5" } }, eds);
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
            const updated = addEdge({ ...params, style: { stroke: "#000000" } }, eds);
            updateMapRow(nodes, updated);
            return updated;
          });
        }
      );

      document.body.appendChild(modal);
    },
    [nodes, updateMapRow, setEdges]
  );

  const handleNoteChange = (e) => {
    if (selectedNode) {
      const newNote = e.target.value;
      setNodeNotes((prev) => ({ ...prev, [selectedNode.id]: newNote }));
    }
  };
  const handleNoteBlur = () => {
    if (selectedNode) {
      updateMapRow(nodes, edges);
    }
  };

  const onContextMenu = useCallback((event) => {
    event.preventDefault();
    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    setContextMenu({ x, y });
  }, []);
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
      const maxId = nodes.length ? Math.max(...nodes.map((n) => parseInt(n.id))) : 0;
      const newNodeId = (maxId + 1).toString();

      const userId = currentUser?.id || "unknown";

      const newNode = {
        id: newNodeId,
        data: { title: `Node ${newNodeId}` },
        position,
        style: { border: `2px solid ${borderColor}` },
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
    [nodes, edges, updateMapRow, borderColor, currentUser, setNodes]
  );

  // ----- Inline edit: buffered typing -----
  const onNodeDoubleClick = useCallback(
    (_, node) => {
      setEditingNodeId(node.id);
      setPendingLabel(getNodeTitle(node));
      setNodes((nds) =>
        nds.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, isEditing: true } } : n))
      );
    },
    [setNodes]
  );

  const handleLabelTyping = (e) => setPendingLabel(e.target.value);

  const commitLabel = useCallback(() => {
    if (!editingNodeId) return;
    setNodes((nds) => {
      const updated = nds.map((n) => (n.id === editingNodeId ? setNodeTitle(n, pendingLabel) : n));
      updateMapRow(updated, edges);
      return updated;
    });
    setEditingNodeId(null);
  }, [editingNodeId, pendingLabel, edges, updateMapRow, setNodes]);

  const onDelete = useCallback(() => {
    const remainingNodes = nodes.filter((n) => !selectedElements.includes(n.id));
    const remainingEdges = edges.filter((e) => !selectedElements.includes(e.id));
    setNodes(remainingNodes);
    setEdges(remainingEdges);
    setSelectedElements([]);
    updateMapRow(remainingNodes, remainingEdges);
  }, [nodes, edges, selectedElements, updateMapRow, setNodes, setEdges]);

  const LOCAL_BG_PAGECOLOR_KEY = "mapEditor:bgPageColor";

  const [bgPageColor, setBgPageColor] = useState(() => {
    try { return localStorage.getItem(LOCAL_BG_PAGECOLOR_KEY) || "#f7fafc"; }
    catch { return "#f7fafc"; }
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
      if (disableShortcuts) return;
      const a = document.activeElement;
      if (a?.tagName === "INPUT" || a?.tagName === "TEXTAREA" || a?.isContentEditable) return;
      if (event.key === "Delete" || event.key === "Backspace") onDelete();
      else if (event.key.toLowerCase() === "n") addNode();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onDelete, addNode, disableShortcuts]);

  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(node);
    setBorderColor(node.style?.border?.split(" ")[2] || "#000000");
    setShowNodeDetails(true);
  }, []);

  const handleBorderColorChange = (color) => {
    if (!selectedNode) return;
    const updated = nodes.map((node) =>
      node.id === selectedNode.id ? { ...node, style: { ...node.style, border: `2px solid ${color}` } } : node
    );
    setNodes(updated);
    setBorderColor(color);
    updateMapRow(updated, edges);
  };

  const handleLinkChange = (link) => {
    if (!selectedNode) return;
    setNodeData((prev) => ({
      ...prev,
      [selectedNode.id]: { ...(prev[selectedNode.id] || {}), link },
    }));
  };

  // Render node label with creator info and date (display-only JSX)
  const renderNode = (node) => {
    const creatorInfo = nodeCreators[node.creator];
    const creationDate = new Date(node.creationTimestamp).toLocaleDateString();
    const creatorUsername = creatorInfo?.username || "Unknown Username";
    const title = getNodeTitle(node);

    if (node.data.isEditing) {
      const isThisEditing = node.id === editingNodeId;
      return (
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
          className="me-node-input"
          style={{ width: "100%" }}
        />
      );
    }

    return (
      <div className="me-node" style={{ position: "relative", width: "100%", height: "100%" }}>
        <div className="me-node-meta">
          <img
            src={creatorInfo?.profile_picture || DEFAULT_AVATAR_URL}
            alt="Creator Avatar"
            style={{ width: 20, height: 20, borderRadius: "50%", marginRight: 5 }}
            onError={handleAvatarError}
          />
          <span>{creatorUsername}</span> ({creationDate})
        </div>
        <span className="me-node-title">{title}</span>
      </div>
    );
  };

  // ----- Load map + subscribe (durable data via Postgres; presence/cursors via Realtime) -----
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data: u } = await supabase.auth.getUser();
      setCurrentUser(u?.user || null);

      const { data: m, error } = await supabase
        .from("maps")
        .select("id, name, description, nodes, edges, node_notes, node_data, last_edited")
        .eq("id", mapId)
        .single();
      if (error) {
        console.error("Failed to load map:", error.message);
        return;
      }
      if (!mounted) return;

      setNodes(m?.nodes || []);
      setEdges(m?.edges || []);
      setMapName(m?.name || "");
      setMapDescription(m?.description || "");
      setNodeNotes(m?.node_notes || {});
      setNodeData(m?.node_data || {});
      setLastEdited(m?.last_edited ? new Date(m.last_edited).toLocaleString() : "Not available");
      setMapLoaded(true);
      prevMapRef.current = m;

      const creatorIds = Array.from(
        new Set((m?.nodes || []).map((n) => n.creator).filter((c) => !!c && c !== "unknown"))
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

      await refreshParticipants();

      // Subscribe to map row updates for live real time changes.
      const channel = supabase
        .channel("map-" + mapId)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "maps", filter: `id=eq.${mapId}` },
          (payload) => {
            const m2 = payload.new;
            setNodes(m2.nodes || []);
            setEdges(m2.edges || []);
            setMapName(m2.name || "");
            setMapDescription(m2.description || "");
            setNodeNotes(m2.node_notes || {});
            setNodeData(m2.node_data || {});
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
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const refreshParticipants = async () => {
      const { data: parts } = await supabase
        .from("map_participants")
        .select("user_id")
        .eq("map_id", mapId);
      const ids = (parts || []).map((p) => p.user_id);
      if (!ids.length) {
        setParticipants([]);
        return;
      }
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, profile_picture")
        .in("id", ids);

      // presence via map_presence view (still okay as a fallback)
      const { data: presence } = await supabase
        .from("map_presence")
        .select("user_id, online")
        .eq("map_id", mapId);

      const onlineMap = {};
      (presence || []).forEach((r) => (onlineMap[r.user_id] = r.online));

      const list = (profs || []).map((p) => ({
        id: p.id,
        username: p.username || "Unknown",
        profile_picture: p.profile_picture || DEFAULT_AVATAR_URL,
        online: !!onlineMap[p.id],
      }));
      setParticipants(list);
    };

    load();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId]);

  // ----- Realtime presence + cursor broadcast (Phase C) -----
  useEffect(() => {
    if (!currentUser) return;

    // Build (or reuse) Realtime channel with presence
    const chan = supabase.channel(`map:${mapId}`, {
      config: { presence: { key: currentUser.id } },
    });

    // Presence roster sync
    chan.on("presence", { event: "sync" }, () => {
      const state = chan.presenceState();
      const next = {};
      Object.values(state).forEach((arr) => {
        arr.forEach((m) => { next[m.userId] = m; });
      });
      setPresenceUsers(next);

      // Reflect online in participants list immediately (optional)
      setParticipants((prev) => prev.map((p) => ({ ...p, online: !!next[p.id] })));
    });

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
      }
    });

    realtimeChannelRef.current = chan;

    return () => {
      try { chan.unsubscribe(); } catch { }
      realtimeChannelRef.current = null;
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
        setShowNodeDetails(false);
      }
    };
    const closeIfOutsideEdge = (e) => {
      if (
        reactFlowWrapper.current &&
        reactFlowWrapper.current.contains(e.target) &&
        (!edgeDetailsPanelRef.current || !edgeDetailsPanelRef.current.contains(e.target))
      ) {
        setShowEdgeDetails(false);
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
  const refreshPage = () => window.location.reload();

  // === MiniMap helpers ===
  const deriveNodeColor = useCallback((node) => {
    const border = node?.style?.border || "";
    const parts = border.split(" ");
    const color = parts[2];
    return color || "#94A3B8";
  }, []);

  // Helper: flow -> screen (to render absolute cursor at correct spot)
  const flowToScreen = useCallback(
    ({ x, y }) => {
      if (!rf) return { left: x, top: y };
      const { x: tx, y: ty, zoom } = rf.getViewport();
      return { left: x * zoom + tx, top: y * zoom + ty };
    },
    [rf]
  );

  return (
    <div
      ref={reactFlowWrapper}
      className="map-editor"
      style={{ height: "100vh" }}
    >
      {/* LEFT: Canvas */}
      <div className="me-canvas" style={{ backgroundColor: bgPageColor }}>
        <Panel position="top-left">
          <div
            className="description me-stats"
            style={{
              padding: "2px",
              background: "linear-gradient(to bottom, #0ea5e9, #0ea5e9)",
              color: "#ffffff",
              boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
              borderRadius: "4px",
              height: "60%",
            }}
          >
            <p style={{ textAlign: "center" }}>Keyboard Shortcuts:</p>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", fontSize: "10px" }}>
              <li style={{ color: "#FFFFFF" }}><strong>N:</strong> Add a new node</li>
              <li style={{ color: "#FFFFFF" }}><strong>Del/Backspace:</strong> Delete selected node</li>
              <li style={{ color: "#FFFFFF" }}><strong>Right-click:</strong> Rename node, Add node</li>
              <li style={{ color: "#FFFFFF" }}><strong>Double-click on node:</strong> Rename a node</li>
              <li style={{ color: "#FFFFFF" }}><strong>Click on node:</strong> open node details</li>
              <li style={{ color: "#FFFFFF" }}><strong>Click on edge:</strong> open edge details</li>
              <li style={{ color: "#FFFFFF" }}><strong>Click on the background:</strong> close node/edge details</li>
            </ul>
            <br></br>
            <p style={{ color: "#FFFFFF", textAlign: "center" }}>Total Nodes: {nodes.length}</p>
          </div>
        </Panel>

        {/* ReactFlow */}
        <ReactFlow
          nodes={nodes.map((node) => ({
            ...node,
            data: { ...node.data, label: renderNode(node) },
          }))}
          edges={edges}
          onNodesChange={handleNodeChanges}
          onEdgesChange={handleEdgeChanges}
          onContextMenu={onContextMenu}
          onConnect={onConnect}
          onPaneClick={() => {
            setShowNodeDetails(false);
            setShowEdgeDetails(false);
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
              variant={bgStyle === "dots" ? "dots" : "lines"}
              gap={24}
              size={1}
              color={bgColor}
            />
          )}

          {/* MiniMap */}
          {minimapEnabled && (
            <MiniMap
              className="me-minimap"
              style={{
                position: "absolute",
                left: 12,
                bottom: 12,
                width: 220,
                height: 140,
                background: "rgba(255,255,255,.92)",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                boxShadow: "0 8px 20px rgba(2,6,23,.10)",
                zIndex: 5,
              }}
              nodeColor={deriveNodeColor}
              nodeBorderRadius={6}
              pannable
              zoomable
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

      {/* RIGHT: Side panel */}
      <div
        className="me-sidepanel"
        style={{
          zIndex: 1000,
          width: "20%",
          padding: "10px",
          right: "0",
          top: "0",
          position: "absolute",
          background: "#f4f4f4",
          height: "100%",
          overflowY: "auto",
          boxShadow: "0 0 10px rgba(0, 0, 0, 0.1)",
        }}
      >
        <h3 style={{ color: "#2C5F2D" }}>Learning Space Details</h3>


        {/* Home Page Button */}
        <div style={{ marginBottom: "10px", textAlign: "center" }}>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
            style={{
              padding: "10px 20px",
              backgroundColor: "#4caf50",
              color: "white",
              border: "none",
              borderRadius: "5px",
              fontSize: "1rem",
              fontWeight: "bold",
              cursor: "pointer",
              boxShadow: "0px 2px 5px rgba(0, 0, 0, 0.1)",
            }}
          >
            Home Page
          </button>
        </div>
        {/* End of Home Page Button */}

        {/* Canvas Settings */}
        <div className="me-canvas-settings" style={{ marginBottom: 12 }}>
          <div className="me-field">
            <span className="me-label">Background</span>
            <div style={{ display: "flex", gap: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="radio"
                  name="bgStyle"
                  value="dots"
                  checked={bgStyle === "dots"}
                  onChange={() => setBgStyle("dots")}
                />
                Dots
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="radio"
                  name="bgStyle"
                  value="lines"
                  checked={bgStyle === "lines"}
                  onChange={() => setBgStyle("lines")}
                />
                Lines
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="radio"
                  name="bgStyle"
                  value="none"
                  checked={bgStyle === "none"}
                  onChange={() => setBgStyle("none")}
                />
                None
              </label>
            </div>
          </div>

          <div className="me-field">
            <label className="me-label">Canvas color</label>
            <input
              type="color"
              className="me-color"
              value={bgPageColor}
              onChange={(e) => setBgPageColor(e.target.value)}
              title="Background fill behind the grid"
            />
          </div>

          <div className="me-field">
            <label className="me-label">Grid color</label>
            <input
              type="color"
              className="me-color"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
            />
          </div>
        </div>
        {/* End of Canvas Settings */}

        {/* Cursor settings */}

        {/* FPS Slider Settings */}
        <div className="me-field">
          <label className="me-label">Cursor FPS: {cursorFps}</label>
          <input
            type="range"
            min={5}
            max={60}
            step={1}
            value={cursorFps}
            onChange={(e) => setCursorFps(parseInt(e.target.value, 10))}
            style={{ width: "100%" }}
          />
          <small style={{ color: "#64748b" }}>
            Higher FPS = smoother, but more messages.
          </small>
        </div>


        <div className="me-field" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <input
            id="toggle-my-cursor"
            type="checkbox"
            checked={showMyCursor}
            onChange={(e) => setShowMyCursor(e.target.checked)}
          />
          <label htmlFor="toggle-my-cursor" className="me-label" style={{ margin: 0 }}>
            Show my cursor
          </label>
        </div>

        {/* Cursor visibility for other cursors */}
        <div className="me-field" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <input
            id="toggle-others-cursor"
            type="checkbox"
            checked={showOthersCursors}
            onChange={(e) => setShowOthersCursors(e.target.checked)}
          />
          <label htmlFor="toggle-others-cursor" className="me-label" style={{ margin: 0 }}>
            Show others’ cursors
          </label>
        </div>


        {/* MiniMap toggle */}
        <div
          className="me-field"
          style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}
        >
          <input
            id="toggle-minimap"
            type="checkbox"
            checked={minimapEnabled}
            onChange={(e) => setMinimapEnabled(e.target.checked)}
          />
          <label htmlFor="toggle-minimap" className="me-label" style={{ margin: 0 }}>
            Show MiniMap
          </label>
        </div>


        {/* Map Name */}
        <div className="me-field">
          <label className="me-label">Learning Space Name:</label>
          <input
            type="text"
            value={mapName}
            onChange={(e) => setMapName(e.target.value)}
            onBlur={() => updateMapRow(nodes, edges)}
            placeholder="Enter Learning Space name"
            className="me-input"
          />
        </div>

        {/* Map Description */}
        <div className="me-field">
          <label className="me-label">Learning Space Description:</label>
          <textarea
            value={mapDescription}
            onChange={(e) => setMapDescription(e.target.value)}
            onBlur={() => updateMapRow(nodes, edges)}
            placeholder="Enter Learning Space description"
            className="me-textarea"
          />
        </div>

        {/* Map ID */}
        <div className="me-field">
          <label className="me-label">Learning Space ID:</label>
          <div className="me-chip">{mapId}</div>
        </div>

        {/* Last Edited */}
        <div className="me-field">
          <label className="me-label">Last Edited:</label>
          <div className="me-chip">{lastEdited}</div>
        </div>



        {/* Node details panel */}
        <div
          className={`drawer ${showNodeDetails ? "open" : ""}`}
          ref={nodeDetailsPanelRef}
        >
          <button onClick={() => setShowNodeDetails(false)} className="btn-close">
            Close
          </button>

          {selectedNode && (
            <div>
              <div
                style={{
                  textAlign: "center",
                  marginBottom: "20px",
                  padding: "15px",
                  backgroundColor: "#4caf50",
                  color: "white",
                  borderRadius: "12px",
                }}
              >
                <h3 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "bold" }}>Node Details</h3>
                <img
                  src={nodeCreators[selectedNode.creator]?.profile_picture || DEFAULT_AVATAR_URL}
                  alt="Creator Avatar"
                  style={{
                    width: "60px",
                    height: "60px",
                    borderRadius: "50%",
                    marginTop: "10px",
                    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.2)",
                  }}
                  onError={handleAvatarError}
                />
                <p style={{ padding: "10px", margin: "10px 0 0", fontSize: "1rem", fontWeight: "bold" }}>
                  {nodeCreators[selectedNode.creator]?.username || "Unknown Creator"}
                </p>
              </div>

              {/* Node Name */}
              <div className="me-field" style={{ marginTop: 30 }}>
                <label className="me-label">Node Name:</label>
                <div className="me-chip">{getNodeTitle(selectedNode)}</div>
              </div>

              {/* Creation Date */}
              <div className="me-field">
                <label className="me-label">Creation Date:</label>
                <div className="me-chip">{new Date(selectedNode.creationTimestamp).toLocaleString()}</div>
              </div>

              {/* Border Color Picker */}
              <div className="me-field">
                <label className="me-label">Border Color:</label>
                <input
                  type="color"
                  value={borderColor}
                  onChange={(e) => handleBorderColorChange(e.target.value)}
                  className="me-color"
                />
              </div>

              {/* Notes */}
              <div className="me-field">
                <label className="me-label">Notes:</label>
                <textarea
                  ref={noteInputRef}
                  value={nodeNotes[selectedNode.id] || ""}
                  onChange={handleNoteChange}
                  onBlur={handleNoteBlur}
                  placeholder="Add a note for this node"
                  className="me-textarea"
                  style={{ height: 60 }}
                />
              </div>

              {/* Link */}
              <div className="me-field">
                <label className="me-label">Link:</label>
                <input
                  type="text"
                  value={nodeData[selectedNode.id]?.link || ""}
                  onChange={(e) => handleLinkChange(e.target.value)}
                  onBlur={() => updateMapRow(nodes, edges)}
                  placeholder="Add a link"
                  className="me-input"
                />
                {nodeData[selectedNode.id]?.link && (
                  <div style={{ marginTop: 15 }}>
                    <label className="me-label">View Link:</label>
                    <a
                      href={nodeData[selectedNode.id].link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "block",
                        marginTop: "10px",
                        color: "#0ea5e9",
                        textDecoration: "underline",
                        wordBreak: "break-word",
                        fontSize: "1rem",
                      }}
                    >
                      {nodeData[selectedNode.id].link}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Edge Details Panel */}
        {showEdgeDetails && selectedEdge && (
          <div className={`drawer open`} ref={edgeDetailsPanelRef}>
            <button onClick={() => setShowEdgeDetails(false)} className="btn-close">
              Close
            </button>

            <div style={{ marginBottom: "10px", marginTop: "30px" }}>
              <h3 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "bold" }}>Edge Details</h3>
            </div>

            {/* Label */}
            <div className="me-field">
              <label className="me-label">Label:</label>
              <input
                type="text"
                value={selectedEdge.label || ""}
                onChange={(e) => {
                  const updated = edges.map((edge) =>
                    edge.id === selectedEdge.id ? { ...edge, label: e.target.value } : edge
                  );
                  setEdges(updated);
                  setSelectedEdge({ ...selectedEdge, label: e.target.value });
                  updateMapRow(nodes, updated);
                }}
                className="me-input"
              />
            </div>

            {/* Color */}
            <div className="me-field">
              <label className="me-label">Color:</label>
              <input
                type="color"
                value={selectedEdge.style?.stroke || "#000000"}
                onChange={(e) => {
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
              />
            </div>

            {/* Type buttons */}
            <div className="me-field">
              <label className="me-label">Type:</label>
              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button
                  onClick={() => {
                    const updated = edges.map((edge) =>
                      edge.id === selectedEdge.id
                        ? { ...edge, style: { strokeDasharray: undefined }, markerEnd: undefined }
                        : edge
                    );
                    setEdges(updated);
                    setSelectedEdge({ ...selectedEdge, style: { strokeDasharray: undefined }, markerEnd: undefined });
                    updateMapRow(nodes, updated);
                  }}
                  className="btn-primary"
                >
                  Solid
                </button>

                <button
                  onClick={() => {
                    const updated = edges.map((edge) =>
                      edge.id === selectedEdge.id
                        ? { ...edge, style: { strokeDasharray: "5,5" }, markerEnd: undefined }
                        : edge
                    );
                    setEdges(updated);
                    setSelectedEdge({ ...selectedEdge, style: { strokeDasharray: "5,5" }, markerEnd: undefined });
                    updateMapRow(nodes, updated);
                  }}
                  className="btn-primary"
                >
                  Dashed
                </button>

                <button
                  onClick={() => {
                    const updated = edges.map((edge) =>
                      edge.id === selectedEdge.id
                        ? { ...edge, markerEnd: { type: "arrowclosed" }, style: { strokeDasharray: undefined } }
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
                >
                  Arrow
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Participants box (Supabase) */}
        <div
          style={{
            marginTop: "20px",
            padding: "10px",
            border: "1px solid #ddd",
            borderRadius: "8px",
            background: "white",
          }}
        >
          <h4>Participants ({participants.length} Total)</h4>
          <ul style={{ listStyleType: "none", padding: 0, margin: 0 }}>
            {participants.map((p) => (
              <li
                key={p.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "5px 0",
                  borderBottom: "1px solid #eee",
                }}
              >
                <span>
                  {p.username} {currentUser?.id === p.id ? " (Me)" : ""}
                </span>
                <img
                  src={p.profile_picture || DEFAULT_AVATAR_URL}
                  alt={`${p.username}'s profile`}
                  style={{ width: 50, height: 50, borderRadius: "50%", objectFit: "cover" }}
                  onError={handleAvatarError}
                />
                <span style={{ color: presenceUsers[p.id] ? "green" : "red", fontSize: 12 }}>
                  {presenceUsers[p.id] ? "online" : "offline"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

const MapEditorWithParams = ({ mapId }) => (
  <ReactFlowProvider>
    <MapEditor mapId={mapId} />
  </ReactFlowProvider>
);

export default MapEditorWithParams;
