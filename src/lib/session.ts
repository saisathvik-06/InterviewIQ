import type { Candidate } from "@/lib/candidate";
import type { InterviewPlan } from "@/lib/planner";
import { Redis } from "@upstash/redis";

export interface Turn {
  role: "agent" | "candidate";
  content: string;
  day?: number;
}

export interface Feedback {
  summary: string;
  strengths: string[];
  gaps: string[];
  next: string[];
}

/** One LLM assessment of a single scored answer — the raw material for M8's feedback synthesis. */
export interface TopicNote {
  day: number;
  correctness: number; // 1-5
  depth: number; // 1-5
  usedConcreteExample: boolean;
  note: string;
}

export interface Session {
  sessionId: string;
  candidate: Candidate;
  plan: InterviewPlan;
  topicIndex: number;
  /** Planned (non-follow-up) questions asked so far within the current topic. Drives when to advance topics. */
  topicQuestionIndex: number;
  /** Follow-ups used on the current topic, capped at 2 in interview.ts regardless of what the model proposes. */
  followUpsInTopic: number;
  /** Whether the current topic has already used its one off-topic redirect. */
  redirectedInTopic: boolean;
  questionsAsked: number;
  askedDays: number[];
  transcript: Turn[];
  notes: TopicNote[];
  phase: "questioning" | "done";
  feedback?: Feedback;
  createdAt: number;
  /** Set after a blank answer, so the next blank answer advances instead of re-prompting forever. */
  awaitingReprompt?: boolean;
}

export interface SessionStore {
  get(sessionId: string): Promise<Session | null>;
  set(session: Session): Promise<void>;
}

const TTL_MS = 2 * 60 * 60 * 1000; // interviews are bounded; no reason to keep state longer
const REDIS_KEY_PREFIX = "interviewiq:session:";

class MemoryStore implements SessionStore {
  private entries = new Map<string, { session: Session; expiresAt: number }>();

  async get(sessionId: string): Promise<Session | null> {
    const entry = this.entries.get(sessionId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(sessionId);
      return null;
    }
    return entry.session;
  }

  async set(session: Session): Promise<void> {
    this.entries.set(session.sessionId, { session, expiresAt: Date.now() + TTL_MS });
  }
}

class RedisStore implements SessionStore {
  private redis: Redis;

  constructor(url: string, token: string) {
    this.redis = new Redis({ url, token });
  }

  async get(sessionId: string): Promise<Session | null> {
    const data = await this.redis.get<Session>(REDIS_KEY_PREFIX + sessionId);
    return data ?? null;
  }

  async set(session: Session): Promise<void> {
    await this.redis.set(REDIS_KEY_PREFIX + session.sessionId, session, {
      ex: TTL_MS / 1000,
    });
  }
}

/**
 * Wraps a primary store with a fallback. If the primary throws (Redis
 * unreachable, misconfigured, rate-limited), the call degrades to the
 * fallback instead of failing — the interview keeps going through an infra
 * blip rather than dying.
 */
class FallbackStore implements SessionStore {
  constructor(
    private primary: SessionStore,
    private fallback: SessionStore,
  ) {}

  async get(sessionId: string): Promise<Session | null> {
    try {
      return await this.primary.get(sessionId);
    } catch (err) {
      console.error("Session store: primary get() failed, using fallback", err);
      return this.fallback.get(sessionId);
    }
  }

  async set(session: Session): Promise<void> {
    try {
      await this.primary.set(session);
    } catch (err) {
      console.error("Session store: primary set() failed, using fallback", err);
      await this.fallback.set(session);
    }
  }
}

// Shared across calls within one warm instance/process, so the fallback path
// (and local dev with no Redis configured at all) still persists between requests.
const memoryStore = new MemoryStore();

/**
 * Redis-backed when Upstash env vars are present, in-memory otherwise. Checked
 * fresh on every call rather than cached, so the app is fully runnable with no
 * Redis account at all.
 */
export function getStore(): SessionStore {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    return new FallbackStore(new RedisStore(url, token), memoryStore);
  }
  return memoryStore;
}
