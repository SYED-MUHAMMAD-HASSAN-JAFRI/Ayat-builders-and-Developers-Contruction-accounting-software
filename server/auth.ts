import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { get, getOrCreateAppSetting } from './db.js';

function getJwtSecret(): string {
  const envSecret = process.env.JWT_SECRET?.trim();
  if (envSecret) return envSecret;
  return getOrCreateAppSetting('jwt_secret', () => crypto.randomBytes(32).toString('hex'));
}

export interface AuthUser {
  id: number;
  username: string;
  role: 'admin' | 'user';
  name: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
    },
    getJwtSecret(),
    { expiresIn: '30d' }
  );
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token = req.cookies?.token;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AuthUser;
    const dbUser = get<AuthUser>(
      'SELECT id, username, role, name FROM users WHERE id = ?',
      [decoded.id]
    );
    if (!dbUser) {
      res.status(401).json({ error: 'User account no longer exists. Please log in again.' });
      return;
    }
    req.user = dbUser;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    return;
  }
  next();
}
