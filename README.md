# pi-tools

`pi-tools` 是一个 pi 扩展，注册三个 Exa 驱动的工具：

- `code_search`：调用 Exa Code `POST /context`，获取代码示例、SDK/API 用法和实现上下文。
- `web_search`：调用 `exa.search()`，使用 `type: "auto"` 做快速网页搜索。
- `web_fetch`：调用 `exa.getContents()`，抓取已知 URL 的干净文本内容。
- `answer`：调用 `exa.answer()`，生成带 citations 的 grounded answer。

## 安装

```bash
npm install
```

pi 会读取 `package.json` 中的扩展入口：

```json
{
  "pi": {
    "extensions": ["./src/index.ts"]
  }
}
```

开发时可直接加载：

```bash
pi -e ./src/index.ts
```

## 配置

配置从两个位置读取，project 配置字段级覆盖 global 配置：

1. project：`.pi/settings.json`
2. global：`~/.pi/agent/settings.json`

配置键为 `pi-tools`：

```json
{
  "pi-tools": {
    "exa_api_key": "${EXA_API_KEY}",
    "exa_base_url": "https://api.exa.ai"
  }
}
```

`exa_api_key` 和 `exa_base_url` 都支持 `${VAR}` 环境变量展开。未配置 `exa_base_url` 时默认使用 `https://api.exa.ai`。

推荐把 API key 放在环境变量里：

```bash
export EXA_API_KEY="your-key"
```

避免把明文 API key 提交到仓库。

## 工具

### `code_search`

用于代码相关查询，例如第三方库 API、框架用法、SDK 示例和实现模式。

参数：

- `query`：代码搜索问题，必填，1-2000 字符。
- `tokensNum`：`"dynamic"` 或具体 token 数，默认 `"dynamic"`。

底层调用：

```http
POST https://api.exa.ai/context
```

`code_search` 使用原生 `fetch`，超时或用户取消时会 abort 底层请求。

### `web_search`

用于快速网页搜索和资料发现。

参数：

- `query`：搜索查询，必填。
- `numResults`：结果数量，默认 5。

底层调用：

```ts
exa.search(query, {
  type: 'auto',
  numResults,
  contents: {
    text: { maxCharacters: 500 },
    highlights: { query, maxCharacters: 600 },
  },
});
```

### `answer`

用于直接回答需要来源支撑的问题。

参数：

- `query`：问题，必填。
- `systemPrompt`：可选系统提示。
- `text`：是否在 citations 中包含源文本。
- `outputSchema`：可选 JSON Schema，用于结构化输出。
- `userLocation`：可选用户位置，例如 `US`。

底层调用：

```ts
exa.answer(query, {
  model: 'exa',
  text,
  systemPrompt,
  outputSchema,
  userLocation,
});
```

### `web_fetch`

用于读取已知 URL 的网页正文。

参数：

- `urls`：URL 数组，必填。
- `maxCharacters`：每页最大文本字符数，默认 3000。
- `highlights`：是否请求 highlights。
- `summaryQuery`：可选摘要查询。

底层调用：

```ts
exa.getContents(urls, contents);
```

## 超时和取消

- `code_search` 使用原生 `fetch`，组合用户取消信号和超时信号；超时或取消会 abort 请求。
- `web_search` 和 `web_fetch` 使用 `exa-js`。当前 `exa-js` 的 `search` / `getContents` 不接收 `AbortSignal`，所以超时只会结束 JS 侧等待，底层 Exa 请求仍可能继续并计费。

## 开发命令

```bash
npm run check
npm test
npm run format
```

## 测试覆盖

测试位于 `tests/`，覆盖：

- 配置读取、project/global 合并、`${VAR}` 展开、默认 base URL。
- 超时和取消包装，含 already-aborted 与 timeout abort signal。
- `web_search`、`web_fetch`、`code_search`、`answer` 成功路径、参数映射和错误路径。
- 扩展入口注册三个工具，并透传配置、参数和 signal。
