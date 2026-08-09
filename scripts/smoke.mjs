#!/usr/bin/env node
// Drives a full interview against a deployed (or local) InterviewIQ instance and asserts the
// technical-spec contract holds end to end. Run before submitting:
//
//   node scripts/smoke.mjs                              # against the live Vercel URL
//   node scripts/smoke.mjs http://localhost:3000         # against a local dev server
//
// No dependencies beyond Node's built-in fetch (Node 18+).

const DEFAULT_URL = "https://interview-iq-nu-taupe.vercel.app";
const CANDIDATES_URL_PATH = "/api/candidates";
const INTERVIEW_URL_PATH = "/api/interview";
const CANDIDATE_ID = "CAND-018"; // Diane Foster — 31/31 first-try, exercises the "strong" path
const MIN_QUESTIONS = 8;
const MIN_DISTINCT_DAYS = 4;
const MAX_TURNS = 40; // matches the app's own per-session turn cap; a real bug, not a slow model
const CANNED_ANSWER =
  "I'd walk through it with a concrete example from my own project, including the tradeoffs and " +
  "failure modes I ran into.";

const baseUrl = (process.argv[2] ?? DEFAULT_URL).replace(/\/$/, "");

let failures = 0;

function fail(message) {
  failures++;
  console.error(`✗ ${message}`);
}

function ok(message) {
  console.log(`✓ ${message}`);
}

function assert(condition, message) {
  if (condition) ok(message);
  else fail(message);
}

async function main() {
  console.log(`Smoke-testing ${baseUrl}\n`);

  // 1. Candidate list is reachable and non-empty.
  const candidatesRes = await fetch(`${baseUrl}${CANDIDATES_URL_PATH}`);
  assert(candidatesRes.ok, `GET ${CANDIDATES_URL_PATH} returns 200 (got ${candidatesRes.status})`);
  const candidatesBody = await candidatesRes.json();
  const candidate = candidatesBody.candidates?.find((c) => c.member?.id === CANDIDATE_ID);
  assert(Boolean(candidate), `${CANDIDATE_ID} is present in the candidate list`);
  if (!candidate) return report();

  // 2. Start the interview.
  const sessionId = `smoke-${Date.now()}`;
  let res = await fetch(`${baseUrl}${INTERVIEW_URL_PATH}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, candidate }),
  });
  assert(res.status === 200, `start request returns 200 (got ${res.status})`);
  let body = await res.json();
  assert(typeof body.reply === "string" && body.reply.length > 0, "start reply is a non-empty string");
  assert(body.done === false, "start response has done:false");

  // 3. Drive turns until the interview completes, tracking the last known progress snapshot —
  //    the final done:true response is intentionally bare (spec-shaped only), so the guarantee
  //    has to be checked from the last in-progress turn before it.
  let lastProgress = body.progress;
  let turns = 0;
  while (!body.done) {
    turns++;
    if (turns > MAX_TURNS) {
      fail(`interview did not complete within ${MAX_TURNS} turns`);
      return report();
    }
    res = await fetch(`${baseUrl}${INTERVIEW_URL_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, message: CANNED_ANSWER }),
    });
    if (res.status !== 200) {
      fail(`turn ${turns} returned ${res.status}, expected 200`);
      return report();
    }
    body = await res.json();
    if (!body.done && body.progress) lastProgress = body.progress;
  }

  // 4. Final response matches the spec exactly: {reply, done, feedback} and nothing else.
  assert(body.done === true, "final response has done:true");
  assert(typeof body.reply === "string" && body.reply.length > 0, "final reply is a non-empty string");
  const feedback = body.feedback ?? {};
  assert(typeof feedback.summary === "string" && feedback.summary.length > 0, "feedback.summary is a non-empty string");
  assert(Array.isArray(feedback.strengths), "feedback.strengths is an array");
  assert(Array.isArray(feedback.gaps), "feedback.gaps is an array");
  assert(Array.isArray(feedback.next), "feedback.next is an array");
  assert(
    JSON.stringify(Object.keys(body).sort()) === JSON.stringify(["done", "feedback", "reply"]),
    `final response has exactly {done, feedback, reply}, no extra keys (got ${Object.keys(body).sort().join(", ")})`,
  );

  // 5. The hackathon's actual minimum requirement: >=8 questions across >=4 curriculum days.
  assert(Boolean(lastProgress), "progress was reported on at least one in-progress turn");
  if (lastProgress) {
    assert(
      lastProgress.questionsAsked >= MIN_QUESTIONS,
      `>= ${MIN_QUESTIONS} questions asked (got ${lastProgress.questionsAsked})`,
    );
    assert(
      lastProgress.daysCovered.length >= MIN_DISTINCT_DAYS,
      `>= ${MIN_DISTINCT_DAYS} distinct curriculum days covered (got ${lastProgress.daysCovered.length}: ${lastProgress.daysCovered.join(", ")})`,
    );
  }

  report();
}

function report() {
  console.log("");
  if (failures > 0) {
    console.error(`${failures} check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log("All checks passed.");
  }
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exitCode = 1;
});
