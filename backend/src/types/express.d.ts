declare global {
  namespace Express {
    interface Request {
      user?: { id: number; role: 'ADMIN' | 'STAFF' | 'CLIENT'; fullName: string; avatarUrl?: string | null; isClient?: boolean };
      session?: { id: number; tokenVersion: number };
    }
  }
}
export {};
