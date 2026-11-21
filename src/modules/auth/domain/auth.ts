import { z } from 'zod';

export interface User { username: string; nombre: string; rol: string }
export interface Session { user: User; token: string; expiresAt: number }

/** Puerto de autenticación: usuario local hoy; reemplazable por un servicio de autenticación remoto. */
export interface AuthService {
  login(username: string, password: string): Promise<Session>;
  logout(session: Session): Promise<void>;
  /** Valida la sesión guardada al abrir la app. null = hay que iniciar sesión. */
  restore(saved: Session | null): Promise<Session | null>;
}

export class InvalidCredentialsError extends Error {
  constructor() { super('Usuario o contraseña incorrectos'); }
}

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'El usuario es obligatorio'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});
export type LoginForm = z.infer<typeof loginSchema>;
