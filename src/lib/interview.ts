import { analyseCandidate, type SeniorityTier } from "@/lib/analysis";
import type { Candidate } from "@/lib/candidate";
import { buildDeterministicFeedback } from "@/lib/feedback";
import { callJSON, isLlmConfigured } from "@/lib/llm";
import { buildPlan, type InterviewPlan, type PlanTopic } from "@/lib/planner";
import { questionResponseSchema, questionSystemPrompt, questionUserPrompt } from "@/lib/prompts";
import type { Feedback, Session, Turn } from "@/lib/session";

const MAX_ANSWER_LENGTH = 4000;
const SIMILARITY_THRESHOLD = 0.6;

export interface TurnResult {
  session: Session;
  reply: string;
  done: boolean;
  feedback?: Feedback;
}

function lowerFirst(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toLowerCase() + s.slice(1);
}

/** Deterministic template question — also the fallback used whenever the LLM call fails. */
function deterministicQuestion(topic: PlanTopic, questionIndexWithinTopic: number): string {
  const objective = topic.objectives[questionIndexWithinTopic % topic.objectives.length];
  return `On day ${topic.day} ("${topic.title}"), one of the objectives was to ${lowerFirst(objective)}. Walk me through that.`;
}

function normalizeWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter(Boolean),
  );
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = normalizeWords(a);
  const setB = normalizeWords(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const word of setA) if (setB.has(word)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function isTooSimilarToAny(question: string, priorQuestions: string[]): boolean {
  return priorQuestions.some((q) => jaccardSimilarity(question, q) >= SIMILARITY_THRESHOLD);
}

async function requestQuestionFromLlm(params: {
  candidate: Candidate;
  seniorityTier: SeniorityTier;
  topic: PlanTopic;
  objective: string;
  priorQuestions: string[];
}): Promise<string> {
  const result = await callJSON({
    system: questionSystemPrompt(),
    user: questionUserPrompt({
      candidateName: params.candidate.member.name,
      jobRole: params.candidate.member.jobRole,
      seniorityTier: params.seniorityTier,
      day: params.topic.day,
      dayTitle: params.topic.title,
      objective: params.objective,
      tools: params.topic.tools,
      intent: params.topic.intent,
      priorQuestions: params.priorQuestions,
    }),
    schema: questionResponseSchema,
  });
  return result.question.trim();
}

/**
 * Generates the next question. Tries Groq first (if configured), falling back
 * to the deterministic template on any failure — a missing key, a network
 * error, or a question that's too similar to one already asked (retried once
 * with the prior questions listed, then falls back rather than looping).
 */
async function generateQuestion(params: {
  candidate: Candidate;
  seniorityTier: SeniorityTier;
  topic: PlanTopic;
  questionIndexWithinTopic: number;
  priorQuestions: string[];
}): Promise<string> {
  const objective = params.topic.objectives[params.questionIndexWithinTopic % params.topic.objectives.length];
  const fallback = deterministicQuestion(params.topic, params.questionIndexWithinTopic);

  if (!isLlmConfigured()) return fallback;

  try {
    let question = await requestQuestionFromLlm({ ...params, objective });
    if (isTooSimilarToAny(question, params.priorQuestions)) {
      question = await requestQuestionFromLlm({ ...params, objective });
      if (isTooSimilarToAny(question, params.priorQuestions)) {
        return fallback;
      }
    }
    return question;
  } catch {
    return fallback;
  }
}

function priorAgentQuestions(session: Session): string[] {
  return session.transcript.filter((t) => t.role === "agent").map((t) => t.content);
}

function questionsBeforeTopic(plan: InterviewPlan, topicIndex: number): number {
  return plan.topics.slice(0, topicIndex).reduce((sum, t) => sum + t.questionsAllotted, 0);
}

function withTurn(session: Session, turn: Turn): Session {
  return { ...session, transcript: [...session.transcript, turn] };
}

export async function startInterview(candidate: Candidate, sessionId: string): Promise<TurnResult> {
  const profile = analyseCandidate(candidate);
  const plan = buildPlan(profile);
  const firstTopic = plan.topics[0];
  const question = await generateQuestion({
    candidate,
    seniorityTier: profile.seniorityTier,
    topic: firstTopic,
    questionIndexWithinTopic: 0,
    priorQuestions: [],
  });
  const reply = `Welcome, ${candidate.member.name}. Let's begin your interview.\n\n${question}`;

  const session: Session = {
    sessionId,
    candidate,
    plan,
    topicIndex: 0,
    questionsAsked: 1,
    askedDays: [firstTopic.day],
    transcript: [{ role: "agent", content: reply, day: firstTopic.day }],
    phase: "questioning",
    createdAt: Date.now(),
  };

  return { session, reply, done: false };
}

/** Advances past the just-recorded answer: next question in-topic, next topic, or completion. */
async function advance(session: Session): Promise<TurnResult> {
  const plan = session.plan;
  const currentTopic = plan.topics[session.topicIndex];
  const questionsBefore = questionsBeforeTopic(plan, session.topicIndex);
  const questionWithinTopic = session.questionsAsked - questionsBefore;
  const seniorityTier = analyseCandidate(session.candidate).seniorityTier;

  if (questionWithinTopic < currentTopic.questionsAllotted) {
    const question = await generateQuestion({
      candidate: session.candidate,
      seniorityTier,
      topic: currentTopic,
      questionIndexWithinTopic: questionWithinTopic,
      priorQuestions: priorAgentQuestions(session),
    });
    const nextSession = withTurn(
      { ...session, questionsAsked: session.questionsAsked + 1 },
      { role: "agent", content: question, day: currentTopic.day },
    );
    return { session: nextSession, reply: question, done: false };
  }

  const nextTopicIndex = session.topicIndex + 1;
  if (nextTopicIndex >= plan.topics.length) {
    const doneSession: Session = { ...session, phase: "done" };
    const feedback = buildDeterministicFeedback(doneSession);
    const reply = "Interview completed. Thanks for walking me through all of that.";
    const finalSession = withTurn({ ...doneSession, feedback }, { role: "agent", content: reply });
    return { session: finalSession, reply, done: true, feedback };
  }

  const nextTopic = plan.topics[nextTopicIndex];
  const question = await generateQuestion({
    candidate: session.candidate,
    seniorityTier,
    topic: nextTopic,
    questionIndexWithinTopic: 0,
    priorQuestions: priorAgentQuestions(session),
  });
  const askedDays = session.askedDays.includes(nextTopic.day)
    ? session.askedDays
    : [...session.askedDays, nextTopic.day];
  const nextSession = withTurn(
    { ...session, topicIndex: nextTopicIndex, questionsAsked: session.questionsAsked + 1, askedDays },
    { role: "agent", content: question, day: nextTopic.day },
  );
  return { session: nextSession, reply: question, done: false };
}

export async function nextTurn(session: Session, message: string): Promise<TurnResult> {
  // Idempotent: a turn after completion replays the cached feedback rather than
  // advancing or regenerating anything.
  if (session.phase === "done") {
    return { session, reply: "Interview completed.", done: true, feedback: session.feedback };
  }

  const trimmed = message.trim();

  if (trimmed.length === 0) {
    if (session.awaitingReprompt) {
      // Already re-prompted once for this question — treat as "let's move on"
      // rather than asking forever.
      return advance({ ...session, awaitingReprompt: false });
    }
    const reply = "I didn't catch an answer there — want to give that one a shot, or should we move on?";
    const nextSession = withTurn({ ...session, awaitingReprompt: true }, { role: "agent", content: reply });
    return { session: nextSession, reply, done: false };
  }

  const content = trimmed.length > MAX_ANSWER_LENGTH ? trimmed.slice(0, MAX_ANSWER_LENGTH) : trimmed;
  const currentTopic = session.plan.topics[session.topicIndex];
  const withAnswer = withTurn(
    { ...session, awaitingReprompt: false },
    { role: "candidate", content, day: currentTopic?.day },
  );

  return advance(withAnswer);
}
