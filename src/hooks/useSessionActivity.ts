"use client";

import { useEffect, useRef, useCallback } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

interface UseSessionActivityProps {
  sessionId: Id<"collaborativeSessions"> | null;
  userId: string | null;
  isActive?: boolean;
}

export function useSessionActivity({ sessionId, userId, isActive = true }: UseSessionActivityProps) {
  const updateActivity = useMutation(api.sessionActivity.updateUserActivity);
  const heartbeat = useMutation(api.collaboration.participantHeartbeat);
  
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Send heartbeat to server
  const sendHeartbeat = useCallback(async () => {
    if (!sessionId || !userId || !isActive) return;
    
    try {
      await heartbeat({ sessionId, userId });
    } catch (error) {
      console.error('Failed to send heartbeat:', error);
    }
  }, [sessionId, userId, isActive, heartbeat]);

  // Update user activity
  const updateUserActivity = useCallback(async () => {
    if (!sessionId || !userId || !isActive) return;
    
    const now = Date.now();
    // Throttle activity updates to once every 10 seconds
    if (now - lastActivityRef.current < 10000) return;
    
    lastActivityRef.current = now;
    
    try {
      await updateActivity({ sessionId, userId });
    } catch (error) {
      console.error('Failed to update activity:', error);
    }
  }, [sessionId, userId, isActive, updateActivity]);

  // Handle user activity events
  const handleActivity = useCallback(() => {
    updateUserActivity();
  }, [updateUserActivity]);

  // Handle page unload and navigation
  const handleBeforeUnload = useCallback(() => {
    if (sessionId && userId) {
      // Use sendBeacon for reliable departure notification
      const data = JSON.stringify({ sessionId, userId, action: 'leave' });
      
      // Try to send via navigator.sendBeacon (most reliable for page unload)
      if (navigator.sendBeacon) {
        const blob = new Blob([data], { type: 'application/json' });
        navigator.sendBeacon('/api/session-activity', blob);
      }
    }
  }, [sessionId, userId]);

  // Handle browser back/forward navigation
  const handlePopState = useCallback(() => {
    // User navigated away from the collaboration page
    if (sessionId && userId) {
      const data = JSON.stringify({ sessionId, userId, action: 'leave' });
      
      if (navigator.sendBeacon) {
        const blob = new Blob([data], { type: 'application/json' });
        navigator.sendBeacon('/api/session-activity', blob);
      }
    }
  }, [sessionId, userId]);

  // Handle page visibility change (user switches tabs, minimizes window, etc.)
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible') {
      // User is back, send heartbeat
      sendHeartbeat();
    } else {
      // User is away, we'll let the server-side timeout handle this
      // The session will be marked inactive after the threshold
    }
  }, [sendHeartbeat]);

  useEffect(() => {
    if (!sessionId || !userId || !isActive) {
      // Clear heartbeat if session becomes inactive
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      return;
    }

    // Start heartbeat interval (every 30 seconds)
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, 30000);

    // Activity event listeners
    const activityEvents = [
      'mousedown',
      'mousemove', 
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ];

    // Add activity listeners (throttled)
    let activityTimeout: NodeJS.Timeout | null = null;
    const throttledActivity = () => {
      if (activityTimeout) return;
      activityTimeout = setTimeout(() => {
        handleActivity();
        activityTimeout = null;
      }, 5000); // Throttle to once every 5 seconds
    };

    activityEvents.forEach(event => {
      window.addEventListener(event, throttledActivity, { passive: true });
    });

    // Page visibility change
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Page unload
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Browser navigation (back/forward buttons)
    window.addEventListener('popstate', handlePopState);

    // Send initial heartbeat
    sendHeartbeat();

    // Cleanup
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }

      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }

      activityEvents.forEach(event => {
        window.removeEventListener(event, throttledActivity);
      });

      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [sessionId, userId, isActive, sendHeartbeat, handleActivity, handleVisibilityChange, handleBeforeUnload, handlePopState]);

  return {
    sendHeartbeat,
    updateUserActivity,
  };
}