/**
 * Generate a unique session ID using timestamp, random values, and crypto
 * Format: [timestamp][random][crypto] -> ~15-20 characters
 * Example: "lmn4k2p7x3q9r5wx"
 */
export function generateSessionId(): string {
  // Base36 timestamp (more compact than base10)
  const timestamp = Date.now().toString(36);
  
  // Random component
  const random = Math.random().toString(36).substring(2, 8);
  
  // Crypto component for extra uniqueness
  const crypto = typeof window !== 'undefined' && window.crypto
    ? window.crypto.getRandomValues(new Uint8Array(3))
        .reduce((acc, byte) => acc + byte.toString(36), '')
    : Math.random().toString(36).substring(2, 5);
  
  return `${timestamp}${random}${crypto}`.toLowerCase();
}

/**
 * Validate if a session ID has the correct format
 */
export function isValidSessionId(sessionId: string): boolean {
  // Should be 15-25 characters, alphanumeric lowercase
  return /^[a-z0-9]{15,25}$/.test(sessionId);
}

/**
 * Extract timestamp from session ID (approximate creation time)
 */
export function getSessionCreationTime(sessionId: string): Date | null {
  try {
    // Extract first ~11 characters as timestamp
    const timestampStr = sessionId.substring(0, 11);
    const timestamp = parseInt(timestampStr, 36);
    
    // Validate the timestamp is reasonable (after 2020)
    if (timestamp > 1577836800000) { // Jan 1, 2020
      return new Date(timestamp);
    }
    
    return null;
  } catch {
    return null;
  }
}