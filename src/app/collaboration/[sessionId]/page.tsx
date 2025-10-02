'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import CollaborativeEditor from '../../../components/collaboration/CollaborativeEditor';

export default function SessionPage() {
  const { sessionId } = useParams(); // This is actually the sessionKey from the URL
  const router = useRouter();
  const { user } = useUser();
  
  // Mutations
  const joinSession = useMutation(api.collaboration.joinSession);
  const leaveSession = useMutation(api.collaboration.leaveSession);
  
  // Get session by sessionKey
  const session = useQuery(
    api.collaboration.getSessionByKey,
    { sessionKey: sessionId as string }
  );

  // Debug logging
  useEffect(() => {
    console.log('Session Page Debug:', {
      sessionKey: sessionId,
      session,
      user: user?.id,
      sessionExists: !!session,
      sessionData: session ? {
        id: session._id,
        name: session.name,
        isPublic: session.isPublic,
        creatorId: session.creatorId,
        participants: session.participants?.length
      } : null
    });
  }, [sessionId, session, user?.id]);

  // Auto-join session when component mounts
  useEffect(() => {
    if (!user?.id || !session?._id) return;

    const handleJoinSession = async () => {
      try {
        await joinSession({
          sessionId: session._id,
          userId: user.id,
        });
      } catch (error) {
        console.error('Failed to join session:', error);
        // If session doesn't exist or is full, redirect back
        router.push('/collaboration');
      }
    };

    handleJoinSession();
  }, [session?._id, user?.id, joinSession, router]);

  // Auto-leave session when component unmounts (URL changes)
  useEffect(() => {
    return () => {
      if (user?.id && session?._id) {
        // Use fire-and-forget approach for leaving
        leaveSession({
          sessionId: session._id,
          userId: user.id,
        }).catch((error) => {
          console.error('Failed to leave session:', error);
        });
      }
    };
  }, [session?._id, user?.id, leaveSession]);

  // Handle browser navigation events for reliable cleanup
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (user?.id && session?._id) {
        // Use sendBeacon for reliable departure notification
        navigator.sendBeacon('/api/session-leave', JSON.stringify({
          sessionId: session._id,
          userId: user.id,
        }));
      }
    };

    const handlePopState = () => {
      if (user?.id && session?._id) {
        leaveSession({
          sessionId: session._id,
          userId: user.id,
        }).catch(console.error);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [session?._id, user?.id, leaveSession]);

  const handleLeaveSession = () => {
    router.push('/collaboration');
  };

  // Loading state
  if (session === undefined) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#1e1e1e] text-white">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Loading session...</p>
          <p className="text-sm text-gray-400 mt-2">Session Key: {sessionId}</p>
        </div>
      </div>
    );
  }

  // Session not found
  if (session === null) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#1e1e1e] text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Session Not Found</h1>
          <p className="text-gray-400 mb-2">Session with key &quot;{sessionId}&quot; doesn&apos;t exist.</p>
          <p className="text-gray-400 mb-6">This session may have expired or the link is invalid.</p>
          <button
            onClick={() => router.push('/collaboration')}
            className="px-4 py-2 bg-[#007acc] hover:bg-[#005a99] rounded-md transition-colors"
          >
            Back to Sessions
          </button>
        </div>
      </div>
    );
  }

  // Session found - render editor
  console.log('Rendering CollaborativeEditor with session:', session._id);
  
  return (
    <div className="h-screen bg-[#1e1e1e]">
      {/* Debug info bar (remove in production) */}
      {/* <div className="bg-green-600 text-white px-4 py-1 text-xs">
        Session: {session.name} | Key: {sessionId} | Creator: {session.creatorId} | Public: {session.isPublic ? 'Yes' : 'No'}
      </div> */}
      
      <div className="h-[calc(100vh-2rem)]">
        <CollaborativeEditor
          sessionId={session._id}
          onLeaveSession={handleLeaveSession}
        />
      </div>
    </div>
  );
}