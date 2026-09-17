// src/reason.js — 失败终态源串 → reason 五值闭集的唯一公式（architecture §4 A-03 / A-04）
// 归类公式只此一处；唯一消费点是 pr-005 的 composeCallEnvelope。
// 叶子模块：零依赖、纯函数、无 I/O、无定时器。

const EXACT_REASONS = Object.freeze({
  cancelled: 'cancelled_by_client',
  rejected_by_agent: 'rejected',
  structured_output_invalid: 'rejected',
  permission_denied: 'rejected',
  model_unavailable: 'rejected',
  context_busy: 'rejected',
  timeout: 'timeout',
  context_crashed: 'infra_error',
  dispatch_failed: 'infra_error',
});

const PREFIX_RULES = Object.freeze([
  Object.freeze({ prefix: 'timeout_after_', suffix: 'ms', reason: 'timeout' }),
  Object.freeze({ prefix: 'spawn_failed:', reason: 'infra_error' }),
  Object.freeze({ prefix: 'spawn_error:', reason: 'infra_error' }),
]);

export function reasonOf(state, error) {
  if (state !== 'failed') {
    return null;
  }
  if (typeof error !== 'string') {
    return 'agent_error';
  }

  if (Object.hasOwn(EXACT_REASONS, error)) {
    return EXACT_REASONS[error];
  }

  for (const rule of PREFIX_RULES) {
    if (error.startsWith(rule.prefix) && (!rule.suffix || error.endsWith(rule.suffix))) {
      return rule.reason;
    }
  }

  return 'agent_error';
}
