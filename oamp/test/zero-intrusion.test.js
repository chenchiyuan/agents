// test/zero-intrusion.test.js — §9.4.2 B-17：零侵入契约（D-2 / D-3）的**可执行证据**
// 三条机械判据（architecture §3.3）：
//   ① 生产消费层不 import、不构造任何具体协议实现模块；
//   ② 生产消费层不出现按协议取值的字面（选择域只存在于唯一注入点）；
//   ③ 切换协议只改注入配置时，生产消费层逐字节不变（运行时快照比对：测试起始读基线 ⇒
//      以两种注入配置各起一次真实 agent ⇒ 再读比对；基线 = 本次快照，不内嵌哈希）。
// 定位（§9.4）：与既有测试面的断言更新（B-11~B-15）**并存、互不替代**；本文件只承载上述机械判据，
// **不**承载行为断言（过程增量 / 门 / 时序归 pr-003 的其它测试面与阶段 6）。
// 只用 node:* 内置模块（零第三方依赖，F12）；不新增 / 不修改 test/helpers/**。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startRouter, startAgent, stopAll } from './helpers/harness.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// 生产消费层（§3.3 判据 2 的适用范围）；具体协议实现与唯一注入点不在本判据面内
const CONSUMPTION_FILES = ['src/context-pool.js', 'src/agent.js', 'src/web.js'];

const readSource = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('B-17①：生产消费层不 import、不构造具体协议实现模块', () => {
  for (const relative of CONSUMPTION_FILES) {
    const source = readSource(relative);
    assert.doesNotMatch(
      source,
      /from\s+['"][^'"]*\/(?:acp|rpc|oneshot)-client\.js['"]/,
      `${relative}：不得 import 具体协议实现模块（会话经注入的工厂获取）`,
    );
    assert.doesNotMatch(
      source,
      /\bnew\s+(?:AcpClient|RpcClient|Oneshot[A-Za-z]*)\b/,
      `${relative}：不得构造具体协议实现`,
    );
  }
});

test('B-17②：生产消费层不出现按协议取值的字面', () => {
  for (const relative of CONSUMPTION_FILES) {
    const source = readSource(relative);
    assert.doesNotMatch(
      source,
      /['"](?:rpc|acp|oneshot)['"]/,
      `${relative}：不得出现协议取值字面（取值域与解析链只在唯一注入点）`,
    );
  }
});

test('B-17③：切换协议只改注入配置 ⇒ 生产消费层逐字节不变', async (t) => {
  const baseline = CONSUMPTION_FILES.map(readSource);
  const router = await startRouter();
  t.after(() => stopAll([router]));

  // 两种注入配置各起一次真实 agent：默认（无任何协议指定）与显式切到另一实现
  const configs = [
    { instanceId: 'zero-intrusion-default', envExtra: {} },
    { instanceId: 'zero-intrusion-switched', envExtra: { OAMP_PROTOCOL: 'acp' } },
  ];
  for (const { instanceId, envExtra } of configs) {
    const agent = await startAgent(instanceId, { socketPath: router.socketPath, envExtra });
    t.after(() => agent.stop());
    await agent.waitAgentLine(new RegExp(`REGISTERED instance=${instanceId}`));
    const exit = await agent.stop();
    assert.equal(exit.code, 0, `agent(${instanceId}) 应优雅退出 0`);
  }

  CONSUMPTION_FILES.forEach((relative, index) => {
    assert.equal(readSource(relative), baseline[index], `${relative}：注入配置变更后必须零 diff`);
  });
});
