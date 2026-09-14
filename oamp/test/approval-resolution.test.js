// test/approval-resolution.test.js — 档位唯一汇聚点（T-01 / F03 验收 4 / L1-1 / F11 验收 1+3）。
// 观测面：`protocol.js` 的 `resolveApproval`（纯函数）、`createProtocolLayer` 的求值一次与写回、
//         `capabilities()` 的六键与档位解耦。零第三方依赖、零真实 omp / 网络（不 spawn 任何子进程）。
// 依据：architecture §5.1（解析链 / 取值域 / 能力位面）、§4.1 L1-1 / L1-7、§4.2 L2-1、§9.4；prs/pr-001-tasks.md T3。
// 期望值真源 = 唯一汇聚点自身的契约（四条解析链与两值取值域），测试内不复写任何链路判定。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAPABILITY_KEYS, createProtocolLayer, resolveApproval } from '../src/protocol.js';

// ─────────────────────────── ① 解析链四条与优先级（T3 验收 1） ───────────────────────────

test('① 解析链四条逐条成立（deny > 显式档 > config 档 > 内置 yolo）', () => {
  // ① permission=deny ⇒ always-ask（优先于显式档位：同时给 yolo 也不得降级）
  assert.equal(resolveApproval({ permission: 'deny', approval: 'yolo' }), 'always-ask');
  assert.equal(resolveApproval({ permission: 'deny', configApproval: 'yolo' }), 'always-ask');
  assert.equal(resolveApproval({ permission: 'deny' }), 'always-ask');
  // ② 显式档位（--approval-mode）⇒ 该值
  assert.equal(resolveApproval({ approval: 'always-ask' }), 'always-ask');
  // ③ config.json 第 5 键 ⇒ 该值
  assert.equal(resolveApproval({ configApproval: 'always-ask' }), 'always-ask');
  // ④ 否则 ⇒ 内置默认 yolo（不做任何档位配置）
  assert.equal(resolveApproval({}), 'yolo');
  assert.equal(resolveApproval({ permission: 'allow' }), 'yolo');
  assert.equal(resolveApproval({ approval: null, configApproval: null }), 'yolo');
  assert.equal(resolveApproval(undefined), 'yolo');
});

test('① 优先级：显式档位压 config 档（两个方向都成立）', () => {
  assert.equal(resolveApproval({ approval: 'yolo', configApproval: 'always-ask' }), 'yolo');
  assert.equal(resolveApproval({ approval: 'always-ask', configApproval: 'yolo' }), 'always-ask');
});

// ─────────────────────────── ② 域外值响亮失败（T3 验收 2 / F02 验收 4） ───────────────────────────

test('② 域外值（write / 非字符串 / 空串）两键皆响亮失败并点名该值，绝不回落 yolo', () => {
  for (const key of ['approval', 'configApproval']) {
    for (const bogus of ['write', 'tier', '', 3, true, {}]) {
      assert.throws(
        () => resolveApproval({ [key]: bogus }),
        (err) => err instanceof Error && /OAMP 配置错误/.test(err.message) && err.message.includes(JSON.stringify(bogus)),
        `${key}=${JSON.stringify(bogus)} 须响亮失败且点名该值`,
      );
    }
  }
});

// ─────────────────────────── ③ 求值一次 + 就地写入（T3 验收 3） ───────────────────────────

test('③ 装配期求值恰一次，结果就地写入 spec.approval（三实现只读该值）', () => {
  let configReads = 0;
  const spec = {
    get configApproval() {
      configReads += 1;
      return 'always-ask';
    },
  };
  const layer = createProtocolLayer({ resident: spec });
  assert.equal(configReads, 1, '装配期只读一次（不求值两遍、不在调用点各自判定）');
  assert.equal(spec.approval, 'always-ask', '结果写回同一个 spec 对象（唯一赋值点）');
  assert.equal(typeof layer.createResident, 'function');

  const denySpec = { permission: 'deny', approval: 'yolo' };
  createProtocolLayer({ resident: denySpec });
  assert.equal(denySpec.approval, 'always-ask', 'deny 压显式档位的解析结果同样就地写回');
});

// ─────────────────────────── ④ 能力位不随档位变（T3 验收 4 / F11 验收 1+3） ───────────────────────────

test('④ capabilities() 六键不随档位变（rpc 两档深相等；acp 两档同为 null；oneshot 两档深相等）', () => {
  const rpcYolo = createProtocolLayer({ resident: { protocol: 'rpc', approval: 'yolo' } }).capabilities();
  const rpcAsk = createProtocolLayer({ resident: { protocol: 'rpc', approval: 'always-ask' } }).capabilities();
  assert.deepEqual(Object.keys(rpcYolo).sort(), [...CAPABILITY_KEYS].sort(), '六键齐全且不增不减');
  assert.deepEqual(rpcYolo, rpcAsk, '同一协议两档的能力位深相等（档位不进入任何能力位）');
  assert.equal(rpcYolo.approvalGate, 'yes', 'approvalGate 表达「该协议是否有门这一机制」，与档位无关');

  const acpYolo = createProtocolLayer({ resident: { protocol: 'acp', approval: 'yolo' } }).capabilities();
  const acpAsk = createProtocolLayer({ resident: { protocol: 'acp', approval: 'always-ask' } }).capabilities();
  assert.equal(acpYolo, acpAsk, 'acp 的声明面随实例落地 ⇒ 门面侧两档同为 null');

  const oneshotYolo = createProtocolLayer({ resident: { tools: true, approval: 'yolo' } }).createEphemeral().capabilities;
  const oneshotAsk = createProtocolLayer({ resident: { tools: true, approval: 'always-ask' } }).createEphemeral().capabilities;
  assert.deepEqual(oneshotYolo, oneshotAsk, '一次性实现两档的能力位深相等');
  assert.equal(oneshotYolo.approvalGate, 'no', '一次性实现无门这一机制（与档位无关）');
});
