import { Redis } from '@upstash/redis';

export interface Child {
  name: string;
  age: number;
  gender: 'male' | 'female';
  avatar?: string;
  avatarRole?: string;
  index?: number;
}

export interface Achievement {
  id: string;
  title: string;
  unlockedAt: string;
}

export interface User {
  email: string;
  username: string;
  passwordHash: string;
  parentPinHash?: string;
  parentName?: string;
  children: Child[];
  plan: 'free' | 'basic' | 'family';
  planExpiry?: string | null;
  role?: 'user' | 'admin';
  secretQuestion?: string;
  secretAnswerHash?: string;
  achievements?: Achievement[];
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!
});

const USER_PREFIX = 'geroy:user:';

export async function findUserTyped(email: string): Promise<User | null> {
  const user = await redis.get<User>(USER_PREFIX + email.toLowerCase());
  return user || null;
}

export async function saveUserTyped(email: string, userData: Partial<User>): Promise<User> {
  const normalizedEmail = email.toLowerCase();
  const user: User = {
    ...(userData as User),
    email: normalizedEmail,
    updatedAt: new Date().toISOString()
  };
  await redis.set(USER_PREFIX + normalizedEmail, user);
  return user;
}

export type { User as UserProfile, Child as ChildProfile, Achievement as UserAchievement };
