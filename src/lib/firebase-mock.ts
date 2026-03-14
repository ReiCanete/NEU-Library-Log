export interface User {
  uid: string;
  email?: string;
  displayName: string;
  college: string;
  studentId: string;
  role: 'user' | 'admin';
  blocked: boolean;
  blockReason?: string;
}

export interface Visit {
  id: string;
  studentId: string;
  fullName: string;
  college: string;
  purpose: string;
  timestamp: Date;
  loginMethod: 'id' | 'google';
}

// In-memory mock data
let mockUsers: User[] = [
  {
    uid: 'admin-1',
    email: 'admin@neu.edu.ph',
    displayName: 'Library Admin',
    college: 'Library Office',
    studentId: 'ADMIN-001',
    role: 'admin',
    blocked: false,
  }
];

let mockVisits: Visit[] = [];

export const firebaseService = {
  async findUserByStudentId(studentId: string): Promise<User | null> {
    return mockUsers.find(u => u.studentId === studentId) || null;
  },

  async findUserByEmail(email: string): Promise<User | null> {
    return mockUsers.find(u => u.email === email) || null;
  },

  async createUser(user: Omit<User, 'blocked' | 'role'>): Promise<User> {
    const newUser: User = { ...user, role: 'user', blocked: false };
    mockUsers.push(newUser);
    return newUser;
  },

  async logVisit(visit: Omit<Visit, 'id' | 'timestamp'>): Promise<Visit> {
    const newVisit: Visit = {
      ...visit,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
    };
    mockVisits.push(newVisit);
    return newVisit;
  },

  async getVisits(limitCount = 50): Promise<Visit[]> {
    return [...mockVisits].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, limitCount);
  },

  async getStats() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return {
      today: mockVisits.filter(v => v.timestamp >= today).length,
      week: mockVisits.filter(v => {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        return v.timestamp >= weekAgo;
      }).length,
      month: mockVisits.filter(v => {
        const monthAgo = new Date();
        monthAgo.setMonth(now.getMonth() - 1);
        return v.timestamp >= monthAgo;
      }).length,
    };
  },

  async blockUser(studentId: string, reason: string) {
    const user = mockUsers.find(u => u.studentId === studentId);
    if (user) {
      user.blocked = true;
      user.blockReason = reason;
    }
  }
};
