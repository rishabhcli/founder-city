import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.redirect(new URL("/play", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
}

export async function POST() {
  return NextResponse.redirect(new URL("/play", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
}
