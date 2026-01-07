import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp"]);

const isAllowedImageFile = (file) => {
  if (!file) return false;
  if (ALLOWED_IMAGE_TYPES.has(file.type)) return true;
  const ext = (file.name || "").split(".").pop()?.toLowerCase();
  return ALLOWED_IMAGE_EXTS.has(ext);
};

const getAvatarValidationError = (file) => {
  if (!file) return "Please choose an image.";
  if (!isAllowedImageFile(file)) return "Please upload a JPG, PNG, or WebP image.";
  if (file.size > MAX_AVATAR_BYTES) return "Image must be 5MB or smaller.";
  return "";
};

/**
 * Props:
 * - isOpen: boolean
 * - userId: string (auth.uid())
 * - defaultAvatarUrl: string (public URL)
 * - onClose: function({ updated: boolean, skipped?: boolean, url?: string })
 *
 * Notes:
 * - Uses a public storage bucket called "avatars".
 * - Visuals rely on your existing Dashboard/Login CSS:
 *   .modal, .modal-content, .modal-header, .modal-buttons, .card-button
 */

export default function AvatarPromptModal({
  isOpen,
  userId,
  defaultAvatarUrl,
  onClose,
}) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (isOpen) return;
    setErr("");
    if (previewUrl) setPreviewUrl("");
    if (fileRef.current) fileRef.current.value = "";
  }, [isOpen, previewUrl]);

  if (!isOpen) return null;

  const handleAvatarError = (e) => {
    e.currentTarget.onerror = null;
    e.currentTarget.src = defaultAvatarUrl;
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationError = getAvatarValidationError(file);
    if (validationError) {
      setErr(validationError);
      e.target.value = "";
      return;
    }
    setErr("");
    const nextUrl = URL.createObjectURL(file);
    setPreviewUrl(nextUrl);
  };

  const handleSkip = async () => {
    try {
      setBusy(true);
      setErr("");
      if (!userId) throw new Error("Missing user id.");

      const { error } = await supabase
        .from("profiles")
        .update({
          profile_picture: defaultAvatarUrl,
          onboarding_seen: true,
        })
        .eq("id", userId)
        .eq("onboarding_seen", false); // only set if not seen yet
      if (error) throw error;

      onClose?.({ updated: true, skipped: true });
    } catch (e) {
      setErr(e.message ?? "Failed to update profile.");
      setBusy(false);
    }
  };

  const handleUpload = async () => {
    try {
      setBusy(true);
      setErr("");
      if (!userId) throw new Error("Missing user id.");

      const file = fileRef.current?.files?.[0];
      const validationError = getAvatarValidationError(file);
      if (validationError) throw new Error(validationError);

      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = data?.publicUrl;
      if (!publicUrl) throw new Error("Could not generate public URL.");

      const { error: updErr } = await supabase
        .from("profiles")
        .update({
          profile_picture: publicUrl,
          onboarding_seen: true,
        })
        .eq("id", userId)
        .eq("onboarding_seen", false);
      if (updErr) throw updErr;

      onClose?.({ updated: true, url: publicUrl });
    } catch (e) {
      setErr(e.message ?? "Upload failed.");
      setBusy(false);
    }
  };

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Welcome! 🎉</h2>
          {/* X just closes without changing anything */}
          <button
            className="close-button"
            onClick={() => onClose?.({ updated: false })}
            aria-label="Close"
            type="button"
          >
            &times;
          </button>
        </div>

        <p style={{ marginTop: 0 }}>
          Oh hey, I see you signed up to organize your ideas — want to choose a
          profile picture now?
        </p>

        <div className="form-group">
          <label htmlFor="avatar-upload-input">Upload/Change photo</label>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <img
              src={previewUrl || defaultAvatarUrl}
              alt="Profile preview"
              className="profile-picture"
              onError={handleAvatarError}
            />
            <input
              ref={fileRef}
              id="avatar-upload-input"
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              className="form-input"
              onChange={handleFileChange}
              disabled={busy}
            />
          </div>
          <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: ".85rem" }}>
            JPG, PNG, or WebP up to 5MB.
          </p>
        </div>

        {err && <p className="error-text">{err}</p>}

        <div className="modal-buttons">
          <button
            type="button"
            disabled={busy}
            onClick={handleSkip}
            className="card-button"
          >
            Not now
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleUpload}
            className="card-button"
            style={{ background: "#0ea5e9", color: "white", border: "none" }}
          >
            {busy ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}
