import { analyseCandidate } from "@/lib/analysis";
import type { Candidate } from "@/lib/candidate";
import { buildDeterministicFeedback } from "@/lib/feedback";
import { buildPlan, type InterviewPlan, type PlanTopic } from "@/lib/planner";
import type { Feedback, Session, Turn } from "@/lib/session";

const MAX_ANSWER_LENGTH = 4000;

export interface TurnResult {
  session: Session;
  reply: string;
  done: boolean;
  feedback?: Feedback;
}

function lowerFirst(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toLowerCase() + s.slice(1);
}

/** Deterministic template question. Also the exact fallback used when a later LLM call fails. */
function formatQuestion(topic: PlanTopic, questionIndexWithinTopic: number): string {
  const objective = topic.objectives[questionIndexWithinTopic % topic.objectives.length];
  return `On day ${topic.day} ("${topic.title}"), one of the objectives was to ${lowerFirst(objective)}. Walk me through that.`;
}

function questionsBeforeTopic(plan: InterviewPlan, topicIndex: number): number {
  return plan.topics.slice(0, topicIndex).reduce((sum, t) => sum + t.questionsAllotted, 0);
}

function withTurn(session: Session, turn: Turn): Session {
  return { ...session, transcript: [...session.transcript, turn] };
}

export function startInterview(candidate: Candidate, sessionId: string): TurnResult {
  const profile = analyseCandidate(candidate);
  const plan = buildPlan(profile);
  const firstTopic = plan.topics[0];
  const question = formatQuestion(firstTopic, 0);
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
function advance(session: Session): TurnResult {
  const plan = session.plan;
  const currentTopic = plan.topics[session.topicIndex];
  const questionsBefore = questionsBeforeTopic(plan, session.topicIndex);
  const questionWithinTopic = session.questionsAsked - questionsBefore;

  if (questionWithinTopic < currentTopic.questionsAllotted) {
    const question = formatQuestion(currentTopic, questionWithinTopic);
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
  const question = formatQuestion(nextTopic, 0);
  const askedDays = session.askedDays.includes(nextTopic.day)
    ? session.askedDays
    : [...session.askedDays, nextTopic.day];
  const nextSession = withTurn(
    { ...session, topicIndex: nextTopicIndex, questionsAsked: session.questionsAsked + 1, askedDays },
    { role: "agent", content: question, day: nextTopic.day },
  );
  return { session: nextSession, reply: question, done: false };
}

export function nextTurn(session: Session, message: string): TurnResult {
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
