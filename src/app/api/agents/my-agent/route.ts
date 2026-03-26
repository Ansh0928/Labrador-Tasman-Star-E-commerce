import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { a, b } = await req.json();
    if (typeof a !== "number" || typeof b !== "number") {
      return NextResponse.json({ error: "a and b must be numbers" }, { status: 400 });
    }
    return NextResponse.json({ result: a + b });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
