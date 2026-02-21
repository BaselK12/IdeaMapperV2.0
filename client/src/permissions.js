export const ROLE_VIEWER = "viewer";
export const ROLE_EDITOR = "editor";
export const ROLE_ADMIN = "admin";

const ROLE_SET = new Set([ROLE_VIEWER, ROLE_EDITOR, ROLE_ADMIN]);

export const normalizeRole = (role) => {
  if (!role) return null;
  const normalized = String(role).toLowerCase();
  if (normalized === "owner") return ROLE_ADMIN;
  return ROLE_SET.has(normalized) ? normalized : null;
};

export const getEffectiveRole = (map, user) => {
  const userId = user?.id;
  if (!userId) return null;
  if (map?.owner_id && map.owner_id === userId) return ROLE_ADMIN;
  return normalizeRole(user?.role || user?.membershipRole || user?.mapRole);
};

export const canView = (map, user) => Boolean(getEffectiveRole(map, user));

export const canEdit = (map, user) => {
  const role = getEffectiveRole(map, user);
  return role === ROLE_EDITOR || role === ROLE_ADMIN;
};

export const isAdmin = (map, user) => getEffectiveRole(map, user) === ROLE_ADMIN;
