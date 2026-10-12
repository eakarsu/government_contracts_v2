'use strict';

function assertCaptureActive(signal) { signal?.throwIfAborted(); }

function beginCaptureRequest(req, res, timeoutMs = 120_000) {
  const controller = new AbortController();
  const abort = () => {
    if (!controller.signal.aborted) controller.abort(Object.assign(new Error('Capture analysis cancelled'), { code: 'AI_CANCELLED', status: 499 }));
  };
  const dispose = () => { clearTimeout(timer); req.off('aborted', abort); res.off('close', close); res.off('finish', dispose); };
  const close = () => { if (!res.writableEnded) abort(); dispose(); };
  const timer = setTimeout(() => controller.abort(Object.assign(new Error('OpenRouter capture analysis timed out'), { code: 'AI_TIMEOUT', status: 504 })), timeoutMs);
  timer.unref?.();
  req.once('aborted', abort); res.once('close', close); res.once('finish', dispose);
  if (req.aborted || res.destroyed) abort();
  return { signal: controller.signal, abort, dispose, assertActive() { assertCaptureActive(controller.signal); } };
}

function captureRequestMiddleware(req, res, next) {
  if (req.method === 'POST') req.captureRequest = beginCaptureRequest(req, res);
  next();
}

function captureActor(req, supplied) {
  const id = req.user?.id;
  if (!id) throw Object.assign(new Error('An authenticated user is required'), { status: 401, code: 'AUTH_REQUIRED' });
  if (supplied != null && String(supplied) !== String(id)) throw Object.assign(new Error('Capture requests must use the authenticated user'), { status: 403, code: 'USER_SCOPE_MISMATCH' });
  return String(id);
}

module.exports = { assertCaptureActive, beginCaptureRequest, captureActor, captureRequestMiddleware };
