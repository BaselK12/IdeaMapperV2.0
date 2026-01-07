// MapEditor.jsx — Supabase version (styled to match Login/Dashboard)
// - Stores node title as plain string (data.title) to avoid {Object object}
// - Uses CSS classes from MapEditor.css (light glass + cyan gradient)

import React, { useState, useCallback, useEffect, useRef } from "react";
import ReactFlow, {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  Panel,
} from "reactflow";
import "reactflow/dist/style.css";
import { supabase } from "../supabaseClient";
import "../styles/MapEditor.css";

const DEFAULT_AVATAR_URL = "/genericpp.png";
const handleAvatarError = (e) => {
  e.currentTarget.onerror = null;
  e.currentTarget.src = DEFAULT_AVATAR_URL;
};

// --- String helpers
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

const MapEditor = ({ mapId }) => {
  // React Flow
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

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
  const canvasRef = useRef(null);

  // Buffered inline editing (prevents ResizeObserver churn)
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [pendingLabel, setPendingLabel] = useState("");

  // Node creators (profiles)
  const [nodeCreators, setNodeCreators] = useState({}); // { uid: profile }
  const [participants, setParticipants] = useState([]); // [{id, username, profile_picture, online}]
  const [cursors, setCursors] = useState({}); // { user_id: { x, y, username, color }}

  // Refs to avoid noisy updates
  const prevMapRef = useRef(null);
  const lastCursorSentRef = useRef(0);

  // Current user
  const [currentUser, setCurrentUser] = useState(null);

  // ---- Helpers ----
  const removeUndefined = (obj) => {
    if (!obj || typeof obj !== "object") return obj;
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
  };

  const updateMapRow = useCallback(
    async (newNodes, newEdges) => {
      if (!mapLoaded) return;
      try {
        // do NOT persist JSX; our nodes state only contains strings in data.title.
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

  // Skip ReactFlow node-change writes while an inline edit is active
  const handleNodeChanges = useCallback(
    (changes) => {
      if (editingNodeId) return; // prevent churn while typing
      setNodes((nds) => {
        const updated = applyNodeChanges(changes, nds);
        updateMapRow(updated, edges);
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

  const onConnect = useCallback(
    (params) => {
      // small modal with style choices (same as your original UX)
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
        data: { title: `Node ${newNodeId}` }, // store plain string ONLY
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

      // fetch and cache creator profile (so labels show)
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
      setPendingLabel(getNodeTitle(node)); // read from string field
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
      updateMapRow(updated, edges); // single write after edit completes
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

  // ----- Presence heartbeat (write immediately + every 10s) -----
  useEffect(() => {
    if (!currentUser || !mapLoaded) return;

    let timer;

    const write = async () => {
      try {
        const { error } = await supabase.from("map_cursors").upsert({
          map_id: mapId,
          user_id: currentUser.id, // Supabase auth id
          x: 0,
          y: 0,
          username: currentUser.user_metadata?.username || "Unknown User",
          color: "#FF5733",
          updated_at: new Date().toISOString(),
        });
        if (error) console.warn("cursor heartbeat error:", error.message);
      } catch (e) {
        console.warn("cursor heartbeat exception:", e);
      }
    };

    write(); // immediate
    timer = setInterval(write, 10000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [currentUser, mapLoaded, mapId]);

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
    // Save on blur below via updateMapRow
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
          className="me-node-input"
          type="text"
          value={isThisEditing ? pendingLabel : title}
          onFocus={() => setDisableShortcuts(true)}
          onChange={handleLabelTyping} // local only
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
        />
      );
    }

return (
  <div className="me-node">
    <div className="me-node-meta">
      <img
        src={creatorInfo?.profile_picture || DEFAULT_AVATAR_URL}
        alt="Creator Avatar"
        style={{ width: 20, height: 20, borderRadius: "50%" }}
        onError={handleAvatarError}
      />
      <span>{creatorUsername}</span> ({creationDate})
    </div>
    <div className="me-node-title">{title}</div>
  </div>
);

  };

  // ----- Load map + subscribe -----
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      // current user
      const { data: u } = await supabase.auth.getUser();
      setCurrentUser(u?.user || null);

      // map row
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

      // apply
      setNodes(m?.nodes || []);
      setEdges(m?.edges || []);
      setMapName(m?.name || "");
      setMapDescription(m?.description || "");
      setNodeNotes(m?.node_notes || {});
      setNodeData(m?.node_data || {});
      setLastEdited(m?.last_edited ? new Date(m.last_edited).toLocaleString() : "Not available");
      setMapLoaded(true);
      prevMapRef.current = m;

      // fetch creators
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

      // participants + realtime presence
      await refreshParticipants();

      // subscribe to map row + presence + participants
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
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "map_cursors", filter: `map_id=eq.${mapId}` },
          () => refreshCursors()
        )
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

      // presence via map_presence view
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

    const refreshCursors = async () => {
      const { data: rows } = await supabase
        .from("map_cursors")
        .select("user_id, x, y, username, color, updated_at")
        .eq("map_id", mapId);

      const next = {};
      (rows || []).forEach((r, idx) => {
        next[r.user_id] = {
          x: r.x,
          y: r.y,
          username: r.username || "Unknown User",
          color: r.color || predefinedColors[idx % predefinedColors.length],
        };
      });
      setCursors(next);
    };

    load();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId]);

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

  // ----- Cursors: write my position (only inside canvas) -----
useEffect(() => {
  if (!currentUser || !canvasRef.current) return;

  const el = canvasRef.current;

  const onMove = async (event) => {
    // Ignore if hovering UI overlays (drawers, panels, context menus)
    if (event.target.closest(".drawer, .context-menu, .me-sidepanel")) return;

    const now = Date.now();
    if (now - lastCursorSentRef.current < 50) return; // ~20fps throttle
    lastCursorSentRef.current = now;

    const bounds = el.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;

    // Don’t send if mouse is outside the map area
    if (x < 0 || y < 0 || x > bounds.width || y > bounds.height) return;

    let username = "Unknown User";
    if (currentUser?.user_metadata?.username) {
      username = currentUser.user_metadata.username;
    } else {
      const { data: prof } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", currentUser.id)
        .single();
      if (prof?.username) username = prof.username;
    }

    await supabase.from("map_cursors").upsert({
      map_id: mapId,
      user_id: currentUser.id,
      x,
      y,
      username,
      color: "#FF5733",
      updated_at: new Date().toISOString(),
    });
  };

  el.addEventListener("mousemove", onMove);
  return () => el.removeEventListener("mousemove", onMove);
}, [currentUser, mapId]);


  // ---- UI Handlers ----
  const refreshPage = () => window.location.reload();

  return (
    <div ref={reactFlowWrapper} className="map-editor">
      <div className="me-canvas">
        <Panel position="top-left">
          <div className="me-stats">
            <p>Keyboard Shortcuts:</p>
            <ul>
              <li>
                <strong>N:</strong> Add a new node
              </li>
              <li>
                <strong>Del/Backspace:</strong> Delete selected node
              </li>
              <li>
                <strong>Right-click:</strong> Rename node, Add node
              </li>
              <li>
                <strong>Double-click on node:</strong> Rename a node
              </li>
              <li>
                <strong>Click on node:</strong> open node details
              </li>
              <li>
                <strong>Click on edge:</strong> open edge details
              </li>
              <li>
                <strong>Click on the background:</strong> close node/edge details
              </li>
            </ul>
            <small>Total Nodes: {nodes.length}</small>
          </div>
        </Panel>

        <ReactFlow
          nodes={nodes.map((node) => ({
            ...node,
            // Inject display-only label from current node state
            data: {
              ...node.data,
              label: renderNode(node),
            },
          }))}
          edges={edges}
          onNodesChange={handleNodeChanges /* ReactFlow internal state updates */}
          onEdgesChange={handleEdgeChanges}
          onContextMenu={onContextMenu}
          onConnect={onConnect}
          onPaneClick={() => {
            setShowNodeDetails(false);
            setShowEdgeDetails(false);
          }}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onSelectionChange={onSelectionChange}
          onNodeDoubleClick={onNodeDoubleClick}
          onEdgeDoubleClick={onEdgeDoubleClick}
          selectNodesOnDrag
          fitView
        />

        {/* Edge Details Drawer */}
        {showEdgeDetails && selectedEdge && (
          <div ref={edgeDetailsPanelRef} className={`drawer ${showEdgeDetails ? "open" : ""}`}>
            <button className="btn-close" onClick={() => setShowEdgeDetails(false)}>
              Close
            </button>

            <h3>Edge Details</h3>

            {/* Label */}
            <div className="me-field">
              <label className="me-label">Label:</label>
              <input
                className="me-input"
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
              />
            </div>

            {/* Color */}
            <div className="me-field">
              <label className="me-label">Color:</label>
              <input
                className="me-color"
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
              />
            </div>

            {/* Type buttons (kept simple for now) */}
            <div className="me-field">
              <label className="me-label">Type:</label>
              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button
                  onClick={() => {
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
                    setSelectedEdge({
                      ...selectedEdge,
                      style: { strokeDasharray: "5,5" },
                      markerEnd: undefined,
                    });
                    updateMapRow(nodes, updated);
                  }}
                >
                  Dashed
                </button>

                <button
                  onClick={() => {
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
                >
                  Arrow
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Live cursors (label below the dot) */}
        {Object.entries(cursors).map(([id, cursor]) => (
          <div
            key={id}
            style={{
              position: "absolute",
              left: cursor.x,
              top: cursor.y,
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
              zIndex: 1000,
            }}
          >
            <div className="cursor-dot" style={{ background: cursor.color }} />
            <div className="cursor-label">{cursor.username}</div>
          </div>
        ))}

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

      {/* Right panel: map + node details + participants */}
      <div className="me-sidepanel">
        <h3>Learning Space Details</h3>

        <div style={{ marginBottom: 10, textAlign: "center" }}>
          <button className="btn-primary" onClick={refreshPage}>
            Home Page
          </button>
        </div>

        {/* Map Name */}
        <div className="me-field">
          <label className="me-label">Learning Space Name:</label>
          <input
            className="me-input"
            type="text"
            value={mapName}
            onChange={(e) => setMapName(e.target.value)}
            onBlur={() => updateMapRow(nodes, edges)}
            placeholder="Enter Learning Space name"
          />
        </div>

        {/* Map Description */}
        <div className="me-field">
          <label className="me-label">Learning Space Description:</label>
          <textarea
            className="me-textarea"
            value={mapDescription}
            onChange={(e) => setMapDescription(e.target.value)}
            onBlur={() => updateMapRow(nodes, edges)}
            placeholder="Enter Learning Space description"
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

        {/* Node details drawer */}
        <div ref={nodeDetailsPanelRef} className={`drawer ${showNodeDetails ? "open" : ""}`}>
          <button className="btn-close" onClick={() => setShowNodeDetails(false)}>
            Close
          </button>

          {selectedNode && (
            <div>
              <div
                style={{
                  textAlign: "center",
                  marginBottom: 20,
                  padding: 15,
                  backgroundColor: "#0ea5e9",
                  color: "white",
                  borderRadius: 12,
                }}
              >
                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "bold" }}>Node Details</h3>
                <img
                  src={nodeCreators[selectedNode.creator]?.profile_picture || DEFAULT_AVATAR_URL}
                  alt="Creator Avatar"
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: "50%",
                    marginTop: 10,
                    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.2)",
                  }}
                  onError={handleAvatarError}
                />
                <p style={{ padding: 10, margin: "10px 0 0", fontSize: "1rem", fontWeight: "bold" }}>
                  {nodeCreators[selectedNode.creator]?.username || "Unknown Creator"}
                </p>
              </div>

              {/* Node Name */}
              <div className="me-field" style={{ marginTop: 10 }}>
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
                  className="me-color"
                  type="color"
                  value={borderColor}
                  onChange={(e) => handleBorderColorChange(e.target.value)}
                />
              </div>

              {/* Notes */}
              <div className="me-field">
                <label className="me-label">Notes:</label>
                <textarea
                  ref={noteInputRef}
                  className="me-textarea"
                  value={nodeNotes[selectedNode.id] || ""}
                  onChange={handleNoteChange}
                  onBlur={handleNoteBlur}
                  placeholder="Add a note for this node"
                  style={{ height: 60 }}
                />
              </div>

              {/* Link */}
              <div className="me-field">
                <label className="me-label">Link:</label>
                <input
                  className="me-input"
                  type="text"
                  value={nodeData[selectedNode.id]?.link || ""}
                  onChange={(e) => handleLinkChange(e.target.value)}
                  onBlur={() => updateMapRow(nodes, edges)}
                  placeholder="Add a link"
                />
                {nodeData[selectedNode.id]?.link && (
                  <div style={{ marginTop: 12 }}>
                    <label className="me-label">View Link:</label>
                    <a
                      href={nodeData[selectedNode.id].link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "block",
                        marginTop: 8,
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

        {/* Participants box */}
        <div
          style={{
            marginTop: 20,
            padding: 10,
            border: "1px solid #ddd",
            borderRadius: 8,
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
                <span style={{ color: p.online ? "green" : "red", fontSize: 12 }}>
                  {p.online ? "online" : "offline"}
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
