export const SESSION_ID_KEY = "tape_client_id";

export function getSessionId(): string | null {
    return localStorage.getItem(SESSION_ID_KEY);
}

export function getOrCreateSessionId(): string {
    let sessionId = localStorage.getItem(SESSION_ID_KEY);
    if (!sessionId) {
        sessionId = crypto.randomUUID();
        localStorage.setItem(SESSION_ID_KEY, sessionId);
    }
    return sessionId;
}
