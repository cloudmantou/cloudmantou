const REMOTE_IMAGE_GLOBAL_CONCURRENCY = 2;
const REMOTE_IMAGE_MAX_QUEUE = 20;

type Waiter = {
  grant: () => void;
  reject: (error: Error) => void;
};

type PermitState = { active: number; waiters: Waiter[] };
const globalState = globalThis as typeof globalThis & {
  __cloudMantouRemoteImagePermits?: PermitState;
};
const state =
  globalState.__cloudMantouRemoteImagePermits ||
  (globalState.__cloudMantouRemoteImagePermits = { active: 0, waiters: [] });

export class RemoteImageQueueError extends Error {}

function releasePermit(): void {
  const next = state.waiters.shift();
  if (next) next.grant();
  else state.active = Math.max(0, state.active - 1);
}

function makeRelease(): () => void {
  let released = false;
  return () => {
    if (released) return;
    released = true;
    releasePermit();
  };
}

async function acquirePermit(deadline: number, signal?: AbortSignal): Promise<() => void> {
  if (signal?.aborted) throw new RemoteImageQueueError("remote image request aborted");
  if (state.active < REMOTE_IMAGE_GLOBAL_CONCURRENCY) {
    state.active += 1;
    return makeRelease();
  }
  if (state.waiters.length >= REMOTE_IMAGE_MAX_QUEUE) {
    throw new RemoteImageQueueError("remote image queue is full");
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const remove = () => {
      const index = state.waiters.indexOf(waiter);
      if (index >= 0) state.waiters.splice(index, 1);
    };
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      remove();
      cleanup();
      reject(error);
    };
    const abort = () => fail(new RemoteImageQueueError("remote image request aborted"));
    const waiter: Waiter = {
      grant: () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(makeRelease());
      },
      reject: fail,
    };
    const remaining = Math.max(0, deadline - Date.now());
    const timer = setTimeout(
      () => fail(new RemoteImageQueueError("remote image queue timed out")),
      remaining
    );

    state.waiters.push(waiter);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

/** 跨请求限制下载和 Sharp 解码；排队计入总时限，并响应客户端取消。 */
export async function withRemoteImagePermit<T>(
  task: () => Promise<T>,
  options: { deadline: number; signal?: AbortSignal }
): Promise<T> {
  const release = await acquirePermit(options.deadline, options.signal);
  try {
    return await task();
  } finally {
    release();
  }
}
