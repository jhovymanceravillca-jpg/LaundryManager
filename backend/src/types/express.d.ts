declare global {
  namespace Express {
    interface Request {
      user?: { id: number; role: 'ADMIN' | 'STAFF'; fullName: string };
    }
  }
}
export {};
