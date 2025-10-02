import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    const { sessionId, userId } = await request.json();

    if (!sessionId || !userId) {
      return NextResponse.json(
        { error: 'Missing sessionId or userId' },
        { status: 400 }
      );
    }

    // Call the leave session mutation
    await convex.mutation(api.collaboration.leaveSession, {
      sessionId: sessionId as Id<"collaborativeSessions">,
      userId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to leave session:', error);
    return NextResponse.json(
      { error: 'Failed to leave session' },
      { status: 500 }
    );
  }
}
