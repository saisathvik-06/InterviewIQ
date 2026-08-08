import { NextResponse } from "next/server";
import { getAllCandidates } from "@/lib/candidate";

export async function GET() {
  return NextResponse.json({ candidates: getAllCandidates() });
}
