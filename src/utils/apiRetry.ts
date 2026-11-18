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

export const API_KEY_MESSAGE = 'API 키가 없거나 맞지 않아요. 설정에서 넣어 주세요.';

const FAIL_REASON_MESSAGE: Record<FailReason, string> = {
  rate_limit: '요청 한도를 넘었어요. 잠시 뒤 다시 해 주세요.',
  overloaded: 'AI 서버가 붐벼요. 잠시 뒤 다시 해 주세요.',
  timeout: '응답이 너무 늦어요. 다시 해 주세요.',
  network: '연결이 끊겼어요. 인터넷을 확인해 주세요.',
  bad_output: 'AI 답을 읽지 못했어요. 다시 해 주세요.',
  bad_request: '요청을 처리하지 못했어요. 입력 내용을 확인해 주세요.',
  other: '문제가 생겼어요. 다시 해 주세요.',
};

/** The sentence shown to the user for a failed request. Raw server text stays in the console. */
export function userMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  if (/api.?key/i.test(raw)) return API_KEY_MESSAGE;
  return FAIL_REASON_MESSAGE[e instanceof ApiError ? e.reason : 'other'];
}

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
