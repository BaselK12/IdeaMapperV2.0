// ParticipantBox.jsx (online computed from map_cursors)
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const ONLINE_WINDOW_MS = 20_000; // 20 seconds
const DEFAULT_AVATAR_URL = "/genericpp.png";
const handleAvatarError = (e) => {
  e.currentTarget.onerror = null;
  e.currentTarget.src = DEFAULT_AVATAR_URL;
};

const ParticipantBox = ({ mapId, currentUserId }) => {
  const [participants, setParticipants] = useState([]);

  const refresh = async () => {
    try {
      // 1) who is in this map
      const { data: mp, error: mpErr } = await supabase
        .from("map_participants")
        .select("user_id")
        .eq("map_id", mapId);
      if (mpErr) throw mpErr;

      const ids = (mp || []).map((r) => r.user_id);
      if (!ids.length) {
        setParticipants([]);
        return;
      }

      // 2) profiles
      const { data: profs, error: profErr } = await supabase
        .from("profiles")
        .select("id, username, profile_picture")
        .in("id", ids);
      if (profErr) throw profErr;

      // 3) latest cursors (for presence)
      const { data: cursors, error: curErr } = await supabase
        .from("map_cursors")
        .select("user_id, updated_at")
        .eq("map_id", mapId);
      if (curErr) throw curErr;

      const now = Date.now();
      const onlineByUser = {};
      (cursors || []).forEach((c) => {
        const ts = new Date(c.updated_at).getTime();
        onlineByUser[c.user_id] = ts && now - ts < ONLINE_WINDOW_MS;
      });

      const list = (profs || []).map((p) => ({
        id: p.id,
        username: p.username || "Unknown User",
        profile_picture: p.profile_picture || DEFAULT_AVATAR_URL,
        online: !!onlineByUser[p.id],
      }));

      // put "me" on top
      list.sort((a, b) => (a.id === currentUserId ? -1 : b.id === currentUserId ? 1 : 0));

      setParticipants(list);
    } catch (e) {
      console.error("ParticipantBox refresh error:", e);
    }
  };
  useEffect(() => {
    let channel;
    let poll;
  
    const setup = async () => {
      await refresh(); // initial
  
      channel = supabase
        .channel(`pb-${mapId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "map_participants", filter: `map_id=eq.${mapId}` },
          () => refresh()
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "map_participants", filter: `map_id=eq.${mapId}` },
          () => refresh()
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "map_cursors", filter: `map_id=eq.${mapId}` },
          () => refresh()
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "map_cursors", filter: `map_id=eq.${mapId}` },
          () => refresh()
        )
        .subscribe();
  
      // tiny safety net in case a realtime event is missed
      poll = setInterval(refresh, 15000);
    };
  
    setup();
    return () => {
      if (channel) supabase.removeChannel(channel);
      if (poll) clearInterval(poll);
    };
  }, [mapId]);
  

  return (
    <div style={{ marginTop: 20, padding: 10, border: "1px solid #ddd", borderRadius: 8 }}>
      <h4>Participants ({participants.length} Total)</h4>
      <ul style={{ listStyleType: "none", padding: 0, margin: 0 }}>
        {participants.map((p) => (
          <li
            key={p.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 0",
              borderBottom: "1px solid #eee",
            }}
          >
            <span>
              {p.username}
              {p.id === currentUserId ? " (Me)" : ""}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: p.online ? "green" : "red", fontSize: 12 }}>
                {p.online ? "online" : "offline"}
              </span>
              <img
                src={p.profile_picture || DEFAULT_AVATAR_URL}
                alt={`${p.username}'s profile`}
                style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover" }}
                onError={handleAvatarError}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ParticipantBox;
