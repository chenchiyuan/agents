// src/pool-routing.js — 池内最空闲选择、会话粘性与在飞预留计数
// 粘性键包含 chat_id，Router 任务条目不携带 chat_id，因此职责落在 web 进程。
// 叶子模块：零依赖、零 import、零文件/网络 I/O；角色解析器由调用方注入。
// 导出 createPoolRouting、roleOfPoolInstance；工厂返回 choose、release、bindingOf、inflightOf 四个方法。

export function roleOfPoolInstance(instanceId, baseResolve) {
  if (typeof instanceId !== 'string' || typeof baseResolve !== 'function') return null;

  let exact;
  try {
    exact = baseResolve(instanceId);
  } catch {
    return null;
  }
  if (exact !== null) return exact;

  const match = /^pb-(.+)-([1-9]\d*)$/.exec(instanceId);
  if (!match) return null;
  try {
    const role = baseResolve(`pb-${match[1]}`);
    return role === null ? null : role;
  } catch {
    return null;
  }
}

const STICKY_SEP = '\u0000';

export function createPoolRouting({ roleFromInstanceId }) {
  const inflight = new Map();
  const bindings = new Map();

  const keyOf = (chatId, role) => chatId + STICKY_SEP + role;
  const validChatId = chatId => typeof chatId === 'string' && chatId.length > 0;

  const membersOf = (role, snapshot) => {
    const nodes = Array.isArray(snapshot?.nodes) ? snapshot.nodes : [];
    const work = snapshot?.work;
    return nodes
      .filter(node => node
        && node.state === 'online'
        && node.connected === true
        && typeof node.instance_id === 'string'
        && roleOfPoolInstance(node.instance_id, roleFromInstanceId) === role)
      .map(node => {
        const status = work instanceof Map ? work.get(node.instance_id) : null;
        return {
          instanceId: node.instance_id,
          queued: status?.queued ?? 0,
          busy: status?.busy === true,
          inflight: inflight.get(node.instance_id) ?? 0,
        };
      });
  };

  const before = (a, b) => a.queued - b.queued
    || Number(a.busy) - Number(b.busy)
    || a.inflight - b.inflight
    || (a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0);

  const reserve = instanceId => {
    inflight.set(instanceId, (inflight.get(instanceId) ?? 0) + 1);
  };

  const choose = (role, { chatId, noReuse, snapshot } = {}) => {
    const sticky = validChatId(chatId);
    const key = sticky ? keyOf(chatId, role) : null;
    const members = membersOf(role, snapshot);

    if (members.length === 0) {
      if (sticky) bindings.delete(key);
      return null;
    }

    const binding = sticky ? bindings.get(key) : null;
    if (binding && noReuse !== true && members.some(member => member.instanceId === binding)) {
      reserve(binding);
      return binding;
    }

    let pick = members[0];
    for (let index = 1; index < members.length; index += 1) {
      if (before(members[index], pick) < 0) pick = members[index];
    }

    if (sticky) bindings.set(key, pick.instanceId);
    reserve(pick.instanceId);
    return pick.instanceId;
  };

  const release = instanceId => {
    const count = inflight.get(instanceId);
    if (!(count > 0)) return;
    if (count === 1) inflight.delete(instanceId);
    else inflight.set(instanceId, count - 1);
  };

  const bindingOf = (chatId, role) => validChatId(chatId)
    ? bindings.get(keyOf(chatId, role)) ?? null
    : null;

  const inflightOf = instanceId => inflight.get(instanceId) ?? 0;

  return { choose, release, bindingOf, inflightOf };
}
