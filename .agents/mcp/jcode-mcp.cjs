#!/usr/bin/env node
/**
 * jcode-mcp.cjs - Micro-layer AST Code Intelligence MCP Server
 * Provides AST-level symbol lookup, outlines, call sites, and exact line ranges.
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const ts = require("typescript");
const { execSync } = require("child_process");

const SERVER_NAME = "jcode";
const SERVER_VERSION = "0.81.6";

function getLineAndChar(sourceFile, pos) {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
  return { line: line + 1, character: character + 1 };
}

function getNodeText(sourceFile, node) {
  return sourceFile.text.substring(node.pos, node.end).trim();
}

function extractSymbolsFromFile(filePath) {
  const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const code = fs.readFileSync(absPath, "utf8");
  const sf = ts.createSourceFile(absPath, code, ts.ScriptTarget.Latest, true);
  const symbols = [];

  function visit(node) {
    let name = null;
    let kind = null;

    if (ts.isClassDeclaration(node)) {
      name = node.name ? node.name.text : "<anonymous_class>";
      kind = "class";
    } else if (ts.isFunctionDeclaration(node)) {
      name = node.name ? node.name.text : "<anonymous_function>";
      kind = "function";
    } else if (ts.isInterfaceDeclaration(node)) {
      name = node.name.text;
      kind = "interface";
    } else if (ts.isTypeAliasDeclaration(node)) {
      name = node.name.text;
      kind = "type";
    } else if (ts.isEnumDeclaration(node)) {
      name = node.name.text;
      kind = "enum";
    } else if (ts.isMethodDeclaration(node)) {
      name = node.name ? node.name.getText(sf) : "<method>";
      kind = "method";
    } else if (ts.isVariableStatement(node)) {
      node.declarationList.declarations.forEach((decl) => {
        if (decl.name) {
          const start = getLineAndChar(sf, decl.getStart(sf));
          const end = getLineAndChar(sf, decl.getEnd());
          symbols.push({
            name: decl.name.getText(sf),
            kind: "variable",
            startLine: start.line,
            endLine: end.line,
          });
        }
      });
      return;
    }

    if (name && kind) {
      const start = getLineAndChar(sf, node.getStart(sf));
      const end = getLineAndChar(sf, node.getEnd());
      symbols.push({
        name,
        kind,
        startLine: start.line,
        endLine: end.line,
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sf);
  return { filePath: absPath, totalLines: code.split("\n").length, symbols };
}

function findSymbolAST(filePath, symbolName) {
  const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const code = fs.readFileSync(absPath, "utf8");
  const sf = ts.createSourceFile(absPath, code, ts.ScriptTarget.Latest, true);
  let match = null;

  function visit(node) {
    if (match) return;

    let name = null;
    let kind = null;

    if (ts.isClassDeclaration(node) && node.name && node.name.text === symbolName) {
      name = node.name.text;
      kind = "class";
    } else if (ts.isFunctionDeclaration(node) && node.name && node.name.text === symbolName) {
      name = node.name.text;
      kind = "function";
    } else if (ts.isInterfaceDeclaration(node) && node.name.text === symbolName) {
      name = node.name.text;
      kind = "interface";
    } else if (ts.isTypeAliasDeclaration(node) && node.name.text === symbolName) {
      name = node.name.text;
      kind = "type";
    } else if (ts.isMethodDeclaration(node) && node.name && node.name.getText(sf) === symbolName) {
      name = node.name.getText(sf);
      kind = "method";
    } else if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (decl.name && decl.name.getText(sf) === symbolName) {
          name = decl.name.getText(sf);
          kind = "variable";
          const start = getLineAndChar(sf, node.getStart(sf));
          const end = getLineAndChar(sf, node.getEnd());
          match = {
            name,
            kind,
            startLine: start.line,
            endLine: end.line,
            code: code.substring(node.getStart(sf), node.getEnd()).trim(),
          };
          return;
        }
      }
    }

    if (name && kind) {
      const start = getLineAndChar(sf, node.getStart(sf));
      const end = getLineAndChar(sf, node.getEnd());
      match = {
        name,
        kind,
        startLine: start.line,
        endLine: end.line,
        code: code.substring(node.getStart(sf), node.getEnd()).trim(),
      };
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(sf);
  return match;
}

function findCallSites(symbolName, searchDir = "src") {
  const absDir = path.isAbsolute(searchDir) ? searchDir : path.resolve(process.cwd(), searchDir);
  if (!fs.existsSync(absDir)) return [];

  const results = [];
  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".")) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") || entry.name.endsWith(".js"))) {
        const content = fs.readFileSync(fullPath, "utf8");
        if (!content.includes(symbolName)) continue;
        const sf = ts.createSourceFile(fullPath, content, ts.ScriptTarget.Latest, true);
        function findCalls(node) {
          if (ts.isCallExpression(node)) {
            const exprText = node.expression.getText(sf);
            if (exprText === symbolName || exprText.endsWith("." + symbolName)) {
              const start = getLineAndChar(sf, node.getStart(sf));
              results.push({
                file: path.relative(process.cwd(), fullPath),
                line: start.line,
                call: node.getText(sf),
              });
            }
          }
          ts.forEachChild(node, findCalls);
        }
        findCalls(sf);
      }
    }
  }
  scanDir(absDir);
  return results.slice(0, 50);
}

const TOOLS = [
  {
    name: "jcode_get_symbol",
    description: "Retrieve exact symbol definition AST chunk, kind, and precise start/end line numbers without loading entire files.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Relative or absolute path to the TypeScript/JavaScript file." },
        symbolName: { type: "string", description: "Name of the class, function, method, interface, or variable." },
      },
      required: ["filePath", "symbolName"],
    },
  },
  {
    name: "jcode_get_outline",
    description: "Get a token-lean AST outline of all symbols (functions, classes, methods, types) and their exact line ranges in a file.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the file to inspect." },
      },
      required: ["filePath"],
    },
  },
  {
    name: "jcode_find_call_sites",
    description: "Find call sites and usages of a specific function or method across the codebase using AST parsing.",
    inputSchema: {
      type: "object",
      properties: {
        symbolName: { type: "string", description: "The function or method name to search." },
        searchDir: { type: "string", description: "Subdirectory to search in (defaults to 'src')." },
      },
      required: ["symbolName"],
    },
  },
  {
    name: "jcode_cli",
    description: "Execute a command on the local jcode CLI harness (e.g. memory list, memory search).",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Command arguments to pass to jcode (e.g. 'memory stats' or 'version')." },
      },
      required: ["command"],
    },
  },
];

function handleToolCall(name, args) {
  switch (name) {
    case "jcode_get_symbol": {
      const res = findSymbolAST(args.filePath, args.symbolName);
      if (!res) {
        return { content: [{ type: "text", text: `Symbol '${args.symbolName}' not found in ${args.filePath}` }] };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(res, null, 2),
          },
        ],
      };
    }
    case "jcode_get_outline": {
      const outline = extractSymbolsFromFile(args.filePath);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(outline, null, 2),
          },
        ],
      };
    }
    case "jcode_find_call_sites": {
      const calls = findCallSites(args.symbolName, args.searchDir || "src");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ count: calls.length, callSites: calls }, null, 2),
          },
        ],
      };
    }
    case "jcode_cli": {
      try {
        const out = execSync(`jcode ${args.command}`, { encoding: "utf8", timeout: 10000 });
        return { content: [{ type: "text", text: out }] };
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: err.message || String(err) }] };
      }
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// JSON-RPC stdio protocol loop
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const msg = JSON.parse(trimmed);
    if (!msg.id && msg.method) {
      // Notification
      return;
    }
    if (msg.method === "initialize") {
      const response = {
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        },
      };
      process.stdout.write(JSON.stringify(response) + "\n");
    } else if (msg.method === "tools/list") {
      const response = {
        jsonrpc: "2.0",
        id: msg.id,
        result: { tools: TOOLS },
      };
      process.stdout.write(JSON.stringify(response) + "\n");
    } else if (msg.method === "tools/call") {
      const { name, arguments: args } = msg.params || {};
      const result = handleToolCall(name, args || {});
      const response = {
        jsonrpc: "2.0",
        id: msg.id,
        result,
      };
      process.stdout.write(JSON.stringify(response) + "\n");
    } else if (msg.method === "ping") {
      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: {} }) + "\n");
    } else {
      process.stdout.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: msg.id,
          error: { code: -32601, message: `Method not found: ${msg.method}` },
        }) + "\n"
      );
    }
  } catch (err) {
    // Ignore invalid JSON lines
  }
});
