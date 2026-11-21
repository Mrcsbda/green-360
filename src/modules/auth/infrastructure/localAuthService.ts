import { InvalidCredentialsError, type AuthService, type Session } from '../domain/auth';

// shortcut: usuario y contraseña locales en el cliente; reemplazar por un servicio de autenticación remoto antes de manejar varios usuarios.
const LOCAL_USERS = [{ username: 'operativo1', password: 'root123', nombre: 'Operativo 1', rol: 'Operaciones' }];
const SESSION_HOURS = 8;

export const localAuthService: AuthService = {
  async login(username, password) {
    const u = LOCAL_USERS.find((x) => x.username === username.trim() && x.password === password);
    if (!u) throw new InvalidCredentialsError();
    return {
      user: { username: u.username, nombre: u.nombre, rol: u.rol },
      token: `local-${Math.random().toString(36).slice(2)}`,
      expiresAt: Date.now() + SESSION_HOURS * 3_600_000,
    } satisfies Session;
  },
  async logout() {},
  async restore(s) { return s && s.expiresAt > Date.now() ? s : null; },
};
