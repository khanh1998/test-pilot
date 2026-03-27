#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createTestPilotMcpServer } from './app';

async function main() {
  const server = createTestPilotMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Test-Pilot MCP server running on stdio');
}

main().catch((error) => {
  console.error('Test-Pilot MCP server failed:', error);
  process.exit(1);
});
