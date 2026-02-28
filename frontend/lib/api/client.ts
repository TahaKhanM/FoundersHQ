const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"
const IS_MOCK = process.env.NEXT_PUBLIC_MOCK_API === "true"

export class ApiError extends Error {
  status: number
  requestId?: string
  constructor(message: string, status: number, requestId?: string) {
    super(message)
    this.status = status
    this.requestId = requestId
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  if (IS_MOCK) {
    throw new Error("apiFetch should not be called in mock mode")
  }

  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    credentials: "include",
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(
      body.message ?? res.statusText,
      res.status,
      body.requestId
    )
  }

  return res.json()
}

export function isMockMode(): boolean {
  return IS_MOCK
}
