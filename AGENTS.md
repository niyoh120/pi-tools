# pi-tools

pi 扩展工具集，提供代码搜索、联网搜索、网页抓取等自定义工具。

## 技术栈

- 语言：TypeScript
- 运行方式：Node.js + `tsx`，TypeScript 直接运行
- 包管理器：npm
- pi 扩展 SDK：`@earendil-works/pi-coding-agent`
- 参数 schema：`typebox`
- 测试框架：vitest
- 格式化 / lint：Biome
- 提交规范：Conventional Commits

## 项目结构约定

推荐结构：

```text
pi-tools/
├── src/
│   ├── index.ts              # 扩展入口，导出 default factory function
│   ├── tools/
│   │   ├── code-search.ts    # 代码搜索工具
│   │   ├── web-search.ts     # 联网搜索工具
│   │   └── web-fetch.ts      # 网页抓取工具
│   └── utils/
├── tests/
├── package.json
├── biome.json
├── README.md
└── AGENTS.md
```

## pi 扩展规范

- 扩展入口必须导出 `default function (pi: ExtensionAPI)`，同步或异步均可。
- 工具通过 `pi.registerTool()` 注册。
- 每个工具保持职责单一，优先放在 `src/tools/` 下的独立文件中。
- 工具参数 schema 使用 `typebox` 的 `Type.Object()` 定义。
- 工具名使用 snake_case，例如 `code_search`、`web_search`、`web_fetch`。
- `label` 使用简短可读名称，例如 `Code Search`。
- `description` 说明工具用途、输入语义和适用场景。
- 需要暴露给 agent 的工具添加 `promptSnippet`；需要补充行为约束时添加 `promptGuidelines`。
- 网络请求、外部 API 调用必须支持 `AbortSignal`，优先使用工具执行函数传入的 `signal`。
- 工具返回值使用 pi 约定的 `{ content, details }` 结构；`details` 放结构化数据，`content` 放面向 agent 的文本结果。

## 代码风格

- 使用 Biome 负责格式化和 lint。
- 缩进使用 2 空格。
- 行尾使用 LF。
- 优先使用单引号。
- 保持类型显式，导出的函数、工具参数和工具结果应有清晰类型。
- 避免新增全局状态；确需缓存时说明生命周期和失效策略。
- 避免引入当前需求不需要的抽象、兼容层或依赖。

## 测试规范

- 测试文件放在 `tests/` 目录，命名为 `*.test.ts`。
- 使用 vitest。
- 工具测试优先 mock 网络请求、第三方 API、文件系统和时间相关行为。
- 对工具至少覆盖：参数校验、成功路径、错误路径、取消/超时路径。

## 常用命令

项目初始化后优先使用以下 npm scripts：

```bash
npm run lint
npm run format
npm run test
npm run check
```

若脚本尚未存在，先查看 `package.json` 再决定命令。开发期可用：

```bash
pi -e ./src/index.ts
```

## 提交规范

提交信息遵循 Conventional Commits：

```text
feat: add web search tool
fix: handle fetch timeout correctly
test: add code search tool tests
docs: document extension setup
chore: configure biome
```

常用类型：`feat`、`fix`、`test`、`docs`、`chore`、`refactor`、`style`。

## 工作限制

- 修改前先查看现有文件和项目配置。
- 保持最小完整变更，避免无关重构。
- 新增依赖前说明用途和必要性。
- 不提交 secrets、tokens、API keys 或个人数据。
- 不在日志和测试快照中写入敏感信息。
- 涉及联网能力时，清晰区分用户输入、请求 URL、响应内容和错误信息。
- 涉及网页抓取时，保留合理的大小限制、超时控制和错误提示。

## 验证要求

完成代码变更后运行最相关的检查。通常顺序：

```bash
npm run check
npm test
```

如果脚本尚未配置，运行当前已有的最接近命令，并在回复中说明已运行的检查。