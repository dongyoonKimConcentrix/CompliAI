export type UserRole = "USER" | "ADMIN";

export type SessionUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  role?: UserRole;
};

export type Session = {
  user: SessionUser;
};

export const TOKEN_COOKIE = "compliai_token";
