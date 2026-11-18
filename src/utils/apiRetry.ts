// Browser-side POST helper with retries for failures that are worth another try
// (rate limit, server overload, timeout, dropped connection, unusable model output).
// The server only retries briefly because a serverless function lives 60s; the longer waits happen here.

export type FailReason =
  | 'rate_limit'
  | 'overloaded'
  | 'timeout'
  | 'network'
  | 'bad_output'
  | 'bad_request'
  | 'other';

export class ApiError extends Error {
  reason: FailReason;
  retryable: boolean;

  constructor(message: string, reason: FailReason, retryable: boolean) {
    super(message);
    this.name = 'ApiError';
    this.reason = reason;
    this.retryable = retryable;
  }
}

// Short labels shown to the user while a retry is waiting.
export const FAIL_REASON_LABEL: Record<FailReason, string> = {
  rate_limit: '요청 한도 초과',
  overloaded: '서버 혼잡',
  timeout: '응답 지연',
  network: '연결 끊김',
  bad_output: '답 형식 오류',
  bad_request: '요청 오류',
  other: '오류',
};

export interface RetryInfo {
  reason: FailReason;
  /** 1 for the first retry. */
  attempt: number;
  waitMs: number;
}

// Wait before retry N (index 0 = first retry). Rate limits need a longer pause to clear.
const RETRY_WAITS_MS: Record<'rate_limit' | 'default', number[]> = {
  rate_limit: [8000, 20000],
  default: [2000, 5000],
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function postJsonOnce<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Network connection failed.', 'network', true);
  }

  if (res.ok) {
    try {
      return await res.json() as T;
    } catch {
      throw new ApiError('Server returned an unreadable response.', 'bad_output', true);
    }
  }

  let errData: { error?: string; details?: string; reason?: FailReason; retryable?: boolean } | null = null;
  try { errData = await res.json(); } catch { /* not JSON: gateway error page */ }

  if (!errData) {
    // The hosting gateway answered instead of our route (e.g. function timeout).
    const gatewayRetryable = res.status === 429 || res.status >= 500;
    throw new ApiError(
      `Server did not answer in time (${res.status}). The request may have taken too long.`,
      res.status === 429 ? 'rate_limit' : 'timeout',
      gatewayRetryable
    );
  }

  throw new ApiError(
    errData.details || errData.error || `Request failed (${res.status})`,
    errData.reason || (res.status === 429 ? 'rate_limit' : 'other'),
    errData.retryable ?? (res.status === 429 || res.status >= 500)
  );
}

export async function postJsonWithRetry<T>(
  url: string,
  body: unknown,
  options: {
    retries?: number;
    onRetry?: (info: RetryInfo) => void;
    /** Checked before each retry; return true to give up quietly (e.g. the user started a new generation). */
    isCancelled?: () => boolean;
  } = {}
): Promise<T> {
  const { retries = 2, onRetry, isCancelled } = options;

  for (let attempt = 0; ; attempt++) {
    try {
      return await postJsonOnce<T>(url, body);
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(String(e), 'other', false);
      if (!err.retryable || attempt >= retries || isCancelled?.()) throw err;

      const waits = err.reason === 'rate_limit' ? RETRY_WAITS_MS.rate_limit : RETRY_WAITS_MS.default;
      const waitMs = waits[Math.min(attempt, waits.length - 1)] + Math.random() * 1000;
      onRetry?.({ reason: err.reason, attempt: attempt + 1, waitMs });
      await sleep(waitMs);
      if (isCancelled?.()) throw err;
    }
  }
}
