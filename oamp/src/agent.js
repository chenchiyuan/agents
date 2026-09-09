// src/agent.js — `oamp agent start <instance-id>` 生命周期编排（architecture §6.2/§6.3 / D6/D16/D17 + F03）
// 入口 = default 导出函数（cli.js 调用约定）：restArgs[0] = instance-id（O-1 收敛，2026-09-09 主 agent 裁决 A）。
// 流程：AGENT_START → connect（失败 stderr 报错含 socket 路径 + router 未运行提示，退出 1）
//   → register（请求，2s 上限；失败退出 1）→ REGISTERED（含授予 lease_timeout_ms）
//   → 周期心跳（通知）→ SIGINT：停心跳 → deregister（best-effort ≤1s）→ DEREGISTERED → 退出 0；二次 SIGINT → 130。
// 运行中断线（Router 死/连接被关）→ CONNECTION_LOST → 退出 1（不重连、不挂起）。

import { loadConfig } from './config.js';
import { NodeClient } from './node-client.js';
import { createEventLog } from './log.js';

// §4.6 instance_id 校验（非空、≤64、可打印 ASCII）
const INSTANCE_ID_RE = /^[\x21-\x7E]{1,64}$/;

export default async function startAgent(restArgs) {
  const instanceId = restArgs && restArgs[0];

  let config;
  try {
    config = loadConfig(process.env);
  } catch (err) {
    process.stderr.write(`oamp: agent start 失败: ${err.message}\n`);
    return 1;
  }

  if (typeof instanceId !== 'string' || !INSTANCE_ID_RE.test(instanceId)) {
    process.stderr.write(
      `oamp: agent start 失败: instance-id 非法（需 1~64 个可打印 ASCII 字符；当前值: ${JSON.stringify(instanceId)}）\n`,
    );
    return 1;
  }

  const logger = createEventLog({ role: 'agent' });
  logger.event('AGENT_START', { instance: instanceId });

  const client = new NodeClient({
    socketPath: config.socketPath,
    logger,
    registerTimeoutMs: 2000, // D17：agent.register 响应上限 2s
    deregisterTimeoutMs: 1000, // D17：agent.deregister 响应上限 1s
  });

  // —— 连接（§6.2 步骤 1）——
  try {
    await client.connect();
  } catch {
    process.stderr.write(
      `oamp: agent start 失败: 无法连接 oamp router（socket=${config.socketPath}；router 未运行？先执行 oamp router start）\n`,
    );
    return 1;
  }

  // —— 注册（§6.2 步骤 2）——
  let registered;
  try {
    registered = await client.register(instanceId);
  } catch (err) {
    const dataCode = err && err.dataCode ? err.dataCode : 'register-failed';
    process.stderr.write(`oamp: agent start 失败: 注册被拒（${dataCode}）: ${err && err.message ? err.message : err}\n`);
    client.close();
    return 1;
  }
  const leaseTimeoutMs = registered.lease_timeout_ms;
  logger.event('REGISTERED', { instance: instanceId, session: registered.session_id, lease_timeout_ms: leaseTimeoutMs });

  // §6.2 步骤 3：授予 lease < 2×interval → 启动打一条告警事件（建议 timeout ≥ 2×interval 防跳空误判）
  if (leaseTimeoutMs < 2 * config.heartbeatIntervalMs) {
    logger.event('LEASE_ALARM', {
      instance: instanceId,
      note: 'lease_timeout_ms < 2 x heartbeat_interval_ms（建议 timeout >= 2 x interval）',
    });
  }

  // —— 周期心跳 ——
  client.startHeartbeat(config.heartbeatIntervalMs);

  // —— 信号与退出 ——
  return await new Promise((resolve) => {
    let settled = false;
    let shuttingDown = false;
    let sigintCount = 0;

    const finish = (code) => {
      if (settled) return;
      settled = true;
      client.onClose = null;
      process.removeListener('SIGINT', onSigint);
      resolve(code);
    };

    const onSigint = () => {
      sigintCount += 1;
      if (sigintCount >= 2) {
        // 二次 SIGINT → 立即退出 130（D16）
        process.exit(130);
      }
      if (shuttingDown || settled) return;
      shuttingDown = true;
      // §6.3：停心跳 → deregister（请求语义，等响应 ≤1s，best-effort）→ 退出 0
      client.stopHeartbeat();
      client
        .deregister()
        .then(() => {
          logger.event('DEREGISTERED', { instance: instanceId });
          client.close();
          finish(0);
        })
        .catch(() => {
          // Router 已不在等情况：跳过事件（§6.3），仍优雅退出 0
          client.close();
          finish(0);
        });
    };

    // 运行中断线（非关闭流程中）→ CONNECTION_LOST → 退出 1
    client.onClose = () => {
      if (shuttingDown || settled) return;
      logger.event('CONNECTION_LOST', { instance: instanceId });
      finish(1);
    };

    process.on('SIGINT', onSigint);
  });
}
