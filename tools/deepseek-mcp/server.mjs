#!/usr/bin/env node
/* ============================================================================
 * DeepSeek MCP 服务器（本地 stdio，需求单 #4）。
 * ----------------------------------------------------------------------------
 * Claude 桌面版启动它，就能在一个界面里派活给 DeepSeek：
 *   ds_code({task, files?, test?})  跑 aider 改代码 → 构建检查 →（可选）测试
 *   ds_status()                     看分支 / 最近提交 / 未提交改动
 *
 * 约定：
 *   - 只允许操作项目根目录（server.mjs 所在仓库的根目录，或 DS_MCP_ROOT）里的文件，越界和禁区一律拒绝；
 *   - DEEPSEEK_API_KEY 只从环境变量读（写在 claude_desktop_config.json 的 env 里），不进仓库；
 *   - 不 push，不碰 GitHub；
 *   - stdout 只留给 MCP 协议，任何日志都走 stderr。
 * ========================================================================== */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ROOT } from './lib.mjs';
import { TOOLS, dsCode, dsStatus } from './tools.mjs';

const log = (...a) => console.error('[deepseek-mcp]', ...a);

const server = new Server(
  { name: 'deepseek-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async req => {
  const name = req.params?.name;
  const args = req.params?.arguments || {};
  try {
    if (name === 'ds_code') return wrap(await dsCode(args));
    if (name === 'ds_status') return wrap(await dsStatus());
    return wrap({ isError: true, text: `没有这个工具：${name}（只有 ds_code / ds_status）` });
  } catch (e) {
    log('工具出错：', e && e.stack ? e.stack : e);
    return wrap({ isError: true, text: `${name} 内部出错：${e && e.message ? e.message : e}` });
  }
});

function wrap({ text, isError }) {
  return { content: [{ type: 'text', text: String(text ?? '') }], isError: !!isError };
}

const transport = new StdioServerTransport();
await server.connect(transport);
log(`已启动，项目根 = ${ROOT}`);
