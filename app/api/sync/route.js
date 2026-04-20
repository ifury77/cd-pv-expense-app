import { kv } from '@vercel/kv';
import { getServerSession } from "next-auth/next";
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ rows: [] });
  const rows = await kv.get(`rows_${session.user.email}`);
  return NextResponse.json({ rows: rows || [] });
}

export async function POST(req) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { rows } = await req.json();
  await kv.set(`rows_${session.user.email}`, rows);
  return NextResponse.json({ success: true });
}
