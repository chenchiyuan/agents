#!/usr/bin/env node
// oamp CLI 可执行入口：仅转发给 src/cli.js（argv 分发逻辑集中在 cli.js）
import { main } from '../src/cli.js';

process.exitCode = await main(process.argv.slice(2));
