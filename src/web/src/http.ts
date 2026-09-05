/** A failed HTTP response, distinct from a network or rendering error. */
export class ApiError extends Error {
  constructor(public readonly status: number) {
    super(`Request failed with status ${status}`);
    this.name = 'ApiError';
  }
}

/** Send the captured token and notify the session owner if the API rejects it. */
export async function requestJson<T>(url: string, init: RequestInit, token: string | null, onUnauthorized: (token: string | null) => void): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(url, { ...init, headers });
  if (response.status === 401) onUnauthorized(token);
  if (!response.ok) throw new ApiError(response.status);
  return response.json() as Promise<T>;
}
