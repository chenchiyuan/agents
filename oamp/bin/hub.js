#!/usr/bin/env node
// oamp hub 可执行入口：仅转发给 sdk/cli.js（argv 分发逻辑集中在 cli.js）
import { main } from '../sdk/cli.js';

process.exitCode = await main(process.argv.slice(2));
