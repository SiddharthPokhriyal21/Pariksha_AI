export const parseJwt = (token: string | null) => {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded;
  } catch (err) {
    return null;
  }
};

export const isTokenValid = (token: string | null) => {
  const p = parseJwt(token);
  if (!p) return false;
  if (p.exp && typeof p.exp === 'number') {
    const now = Math.floor(Date.now() / 1000);
    return p.exp > now;
  }
  return true;
};

export const getUserFromToken = (token: string | null) => {
  const p = parseJwt(token);
  if (!p) return null;
  return { id: p.id, role: p.role, email: p.email, name: p.name } as any;
};