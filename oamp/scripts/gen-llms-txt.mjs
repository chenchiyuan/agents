#!/usr/bin/env node
// scripts/gen-llms-txt.mjs — llms.txt 快照生成器（0016 / F05，architecture §5.3）
// 用法：node oamp/scripts/gen-llms-txt.mjs（在仓库根或 oamp/ 下执行均可——输出路径按脚本位置解析，不依赖 cwd）
// 生成逻辑只有一处（src/web.js 的 renderLlmsTxt，纯函数）；本脚本只是 CLI 包装，不重复实现。
// 单产物结构：写出的 `llms.txt`（包根）既是仓库快照，也是 HTTP 面 /llms.txt 的响应字节。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiRoutes, projectRoutes, renderLlmsTxt } from '../src/web.js';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'llms.txt');
const text = renderLlmsTxt(projectRoutes(createApiRoutes({})));
fs.writeFileSync(OUT, text, 'utf8');
process.stdout.write(`llms.txt 已生成：${OUT}（接口 ${text.match(/^- (?:GET|POST) /gm).length} 条，${Buffer.byteLength(text)} 字节）\n`);
