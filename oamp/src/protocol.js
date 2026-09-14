// src/protocol.js — L2：被写定的会话标准面（4 动作 / 3 类增量 / 2 类反向请求 / 能力位 / 协议中立错误）
// + **唯一注入点**（解析链选实现）。（architecture §3.3 L2 / §5.1 标准面 / §5.3 注入点与解析链 / §5.7）
// 全仓唯一 import 三个实现模块的文件；实现模块反向 import 本文件的符号 ⇒ 两者互有 import 是既定形态（§3.3）。
// 推论（对实现模块的硬约束）：本文件的**类与常量**不得在实现模块的模块顶层被求值——顶层求值会命中 ESM
// 循环导入的 TDZ；本文件自身只在函数体内求值导入符号，故加载无 TDZ（PR 验收 10）。
// 门名解析原语在本文件**自持并具名导出**（不从 acp-client.js 引入：该处无 export，且 RPC 与 ACP 审批门
// 要求同源单点定义，§5.6）。

import { AcpClient } from './acp-client.js';
import { createOneshotSession } from './oneshot-client.js';
import { createRpcSession, rpcCapabilities } from './rpc-client.js';

/** 协议中立错误（码值逐字沿用既有 AcpError.code 五值 ⇒ 消费层错误映射零改动，§5.1）。 */
export class ProtocolError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ProtocolError';
    this.code = code;
  }
}

/** 能力位键集 = 六项原样（不增不减；§5.1 / §5.7）。 */
export const CAPABILITY_KEYS = ['streaming', 'thinking', 'approvalGate', 'hostTools', 'introspection', 'queueControl'];

// 审批门 title 首行前缀（omp 实测产出 `Allow tool: <工具名>\n<详情行…>`，M-5；体例同 acp-client 的同名常量）。
const APPROVAL_MESSAGE_PREFIX = 'Allow tool: ';

/**
 * 审批门工具名解析原语（RPC 与 ACP 审批门**同源**，§5.6）：取 title 首行「前缀之后」的剩余段并 trim。
 * 非字符串 / 前缀不符 / 结果为空 ⇒ null（调用方不得据此放行任何东西）。
 */
export function readApprovalToolName(title) {
  if (typeof title !== 'string' || !title.startsWith(APPROVAL_MESSAGE_PREFIX)) return null;
  const name = title.slice(APPROVAL_MESSAGE_PREFIX.length).split('\n')[0].trim();
  return name === '' ? null : name;
}

// 选择域恰 {rpc, acp}（§5.3）；`oneshot` 不在选择域——它由「一次性」语义选中（§4.2 L2-7）。
const SELECTABLE_PROTOCOLS = new Set(['rpc', 'acp']);
const DEFAULT_PROTOCOL = 'rpc'; // 解析链第四档：内置默认

// 档位取值域恰两值（§5.1；`write` / `tier` 不入域 — N1 / A2）与内置默认
const APPROVAL_VALUES = new Set(['always-ask', 'yolo']);
const DEFAULT_APPROVAL = 'yolo';

/**
 * 读一档档位取值：未提供（undefined / null）⇒ undefined；其余（含空串 / 非字符串 / 域外值）⇒ 响亮失败
 * （体例逐字对齐既有配置校验：`OAMP 配置错误` + 点名当前值，绝不静默回落 `'yolo'`）。
 */
function readApprovalValue(value, source) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || !APPROVAL_VALUES.has(value)) {
    throw new Error(`OAMP 配置错误: ${source} 仅支持 always-ask/yolo（当前值 ${JSON.stringify(value)}）`);
  }
  return value;
}

/**
 * 档位解析链（§5.1 / F03 验收 4 / L1-1：**全仓唯一判定处**，三实现只消费其输出）：
 * ① `spec.permission === 'deny'` ⇒ `'always-ask'`（优先于显式档位——deny 档不得因显式档位而失去门）
 * ② `spec.approval`（显式 `--approval-mode`，未给 ⇒ null）⇒ 该值
 * ③ `spec.configApproval`（config.json 第 5 键）⇒ 该值
 * ④ 否则 ⇒ `'yolo'`（内置默认；不做任何档位配置即默认档）
 */
export function resolveApproval(spec) {
  const source = spec && typeof spec === 'object' ? spec : {};
  if (source.permission === 'deny') return 'always-ask';
  const explicit = readApprovalValue(source.approval, '--approval-mode');
  if (explicit !== undefined) return explicit;
  const configured = readApprovalValue(source.configApproval, 'approval（config.json）');
  return configured === undefined ? DEFAULT_APPROVAL : configured;
}

/**
 * 读一档协议取值：未提供（undefined / null / 空串，体例同 config.js 的「空即未设」）⇒ undefined；
 * 域外值 ⇒ 响亮失败（体例逐字对齐既有配置校验，`OAMP 配置错误` + 当前值）。
 */
function readProtocolValue(value, source) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !SELECTABLE_PROTOCOLS.has(value)) {
    throw new Error(`OAMP 配置错误: ${source} 仅支持 rpc/acp（当前值 ${JSON.stringify(value)}）`);
  }
  return value;
}

/**
 * 解析链（§5.3）：角色级 > env `OAMP_PROTOCOL` > `config.json: protocol` > 内置 `'rpc'`。
 * 第二/三档已由 pr-001 的 `loadConfig()` 折叠为 `config.protocol`（含 env 覆盖）⇒ 门面只需在角色级档位
 * 在场时覆盖该折叠值、缺省回落折叠值：角色级 = `resident.protocol`，折叠值 = `resident.configProtocol`。
 */
function resolveProtocol(resident) {
  const roleLevel = readProtocolValue(resident.protocol, '--protocol（角色级）');
  if (roleLevel !== undefined) return roleLevel;
  const folded = readProtocolValue(resident.configProtocol, 'protocol（OAMP_PROTOCOL / config.json 折叠值）');
  return folded === undefined ? DEFAULT_PROTOCOL : folded;
}

/**
 * 唯一注入点（§5.3）：由注入配置装配出一个门面；消费层只认识本门面。
 * `resident` = 常驻会话的解析结果（承载协议选择、档位输入与常驻字段：`protocol` / `configProtocol` /
 * `approval`（显式档位） / `configApproval`（config 第 5 键） / `model` / `roleFile` / `tools` / `permission`）；
 * `profiles` 为 §5.1 的签名参数位（本迭代未使用：profile 表由 L1 的 `PROFILES` 单点持有，§5.2 / L2-13）。
 * @returns {{capabilities: function, createResident: function, createEphemeral: function}}
 */
export function createProtocolLayer({ resident = {}, profiles = null, bin = null, cwd = null, logger = null } = {}) {
  const spec = resident && typeof resident === 'object' ? resident : {};
  const protocol = resolveProtocol(spec); // 解析链一次落定（切换协议 = 新会话，N9）
  // §5.1 档位唯一汇聚点：装配时求值**恰一次**并就地写入 `spec.approval`（全仓唯一赋值点；三实现只读该值，
  // 自身零档位判定 ⇒ 「某条链路忘记覆写」的通路不存在 — F03 验收 4 / L1-1）。
  spec.approval = resolveApproval(spec);

  return {
    /** 常驻协议的能力位（声明面）：rpc 的六键表由其实现模块自持；acp 的声明面随 AcpClient 实例落地（§9.2 B-8）。 */
    capabilities() {
      return protocol === 'rpc' ? rpcCapabilities() : null;
    },

    /**
     * 开会话（常驻通道）：按解析链选出的实现装配，就绪后返回会话对象。
     * 会话身份三键只在此处可得 ⇒ acp 分支的审计面（`instance` / `role` / `chat_id` / 惰性 `context_id`）在此装配。
     */
    async createResident({ chatId = null, agentId = null, role = null, hooks = null } = {}) {
      if (protocol === 'rpc') return createRpcSession({ resident: spec, logger, hooks });
      // acp 分支：装配既有 AcpClient 的构造面 10 键（§5.1；现状入参面见 context-pool.js:203-227）。
      // 反向请求钩子（`onApproval` / `onHostUi`）不直连 AcpClient——它自带两型权限钩子；此处只承载
      // `onExit` / `onPermissionRequest` 的装配位与透传（「仅 allow 档注入 + 附加 {chatId, agentId, origin}」
      // 的档位语义由消费层给出，属 pr-003 的接线面，§5.1）。
      const client = new AcpClient({
        bin,
        model: spec.model ?? null,
        cwd: cwd ?? process.cwd(),
        tools: spec.tools === true,
        roleFile: spec.roleFile ?? null,
        permission: spec.permission ?? 'allow',
        // §5.1 argv 面：已解析档位（acp 实现只消费；工具关时实现侧自行传 null ⇒ 无档位段）
        approval: spec.approval,
        // §5.1 提问钩子（T-03）：与门钩子并存但注入条件不同（门钩子的档位判定在消费层），此处只透传装配位
        onQuestionRequest:
          typeof (hooks && hooks.onQuestionRequest) === 'function' ? (info) => hooks.onQuestionRequest(info) : null,
        auditContext: {
          instance: agentId,
          role,
          chat_id: chatId,
          // 惰性 getter：`context_id` 依赖 spawn 后的 pid ⇒ 取值期才解析，转发回调用方会话的 contextId
          // （单次求值：转发位可能是取值器，重复求值等于重复解析）。
          get context_id() {
            return hooks ? hooks.contextId ?? null : null;
          },
        },
        logger,
        onExit: typeof (hooks && hooks.onExit) === 'function' ? () => hooks.onExit() : null,
        onPermissionRequest:
          typeof (hooks && hooks.onPermissionRequest) === 'function' ? (info) => hooks.onPermissionRequest(info) : null,
      });
      return client.start();
    },

    /**
     * 一次性执行（无会话语义）：**固定**装配 oneshot 实现、不经解析链（§4.2 L2-7）。
     * 不产生任何反向请求（能力位 `approvalGate:'no'`）⇒ `hooks` 不在本分支使用（签名位保留，§5.1）。
     */
    createEphemeral({ hooks = null } = {}) {
      return createOneshotSession({ resident: spec });
    },
  };
}
