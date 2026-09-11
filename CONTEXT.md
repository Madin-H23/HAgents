# HAgents

Craft Agents（lukilabs fork）的高阶 Agent 工程架构位：多后端执行、会话隔离、工具与权限、多端协议。家族内与 HCode（Harness）、HClaw（工作台）互补，不重复造面。

## Language

**家族共享（与 HCode 用词必须一致）**

**Harness**:
装配模型、工具、权限、上下文与会话策略的组合单元；所有用户面共用同一 Harness，面之间不复制策略。
_Avoid_: 引擎、后端、core

**面 (Surface)**:
同一系统呈现给用户的界面形态。本仓现有 Electron 桌面端、WebUI、CLI、viewer。
_Avoid_: 前端、客户端、壳（口语指桌面端时用「桌面端」）

**工作区 (Workspace)**:
Agent 被授权读写的项目根目录；所有取路径的工具调用都不得越出此边界。
_Avoid_: 项目（泛指仓库时可用）、cwd（仅指进程工作目录时可用）

**会话 (Session)**:
一次持续对话的完整落盘历史，可被恢复继续；会话绑定工作区与模型连接。
_Avoid_: 聊天记录、对话、chat

**权限闸门 (Permission Gate)**:
对每次工具调用的判定；本仓固定模式为 `safe` / `ask` / `allow-all`。
_Avoid_: 审批流、授权、鉴权

## Craft 专有

**AgentBackend**:
后端抽象接口：`chat()` 产出 `AgentEvent` 流，并提供 abort / 中断 / 后台事件 sink；UI 不感知具体 SDK。
_Avoid_: provider、厂商、模型驱动（口语可用「后端」指实现类）

**AgentEvent**:
`@craft-agent/core` 定义的 provider 无关流式事件（文本增量、工具起止、权限请求、错误、完成等）。单一事实来源在 core types，禁止在面层另造平行事件类型。
_Avoid_: 消息流、token 流、stream payload

**BaseAgent**:
所有后端的模板基类：模型/思考档、PermissionManager、SourceManager、PromptBuilder、UsageTracker 等横切能力；子类只实现 provider 差异。
_Avoid_: 基类引擎、抽象执行器

**后端实现 (Backend implementation)**:
`ClaudeAgent`（Claude Agent SDK）与 `PiAgent`（进程外 Pi SDK）等 `BaseAgent` 子类。
_Avoid_: 驱动、适配器（指事件映射时可用 adapter）

**Source**:
外部能力接入单元，类型固定 `mcp` / `api` / `local`；经凭据与 ServerBuilder 暴露为 Agent 可调工具。
_Avoid_: 数据源、插件、连接器

**Skill**:
可发现、可按需读取的指令包；与 Source 并列注册进会话工具面。
_Avoid_: 技能插件、prompt 包

**会话工具上下文 (Session tool context)**:
注入工具处理器的会话作用域能力（sessionId、工作区、回调、凭据等），工具不得直接摸全局状态。
_Avoid_: 工具环境、runtime ctx

**硬中止 vs 交接中断 (Hard abort vs handoff interrupt)**:
硬中止用于真取消/拆除；交接中断用于控制权移交 UI（如计划提交、鉴权请求）。
_Avoid_: 停止、打断（未区分语义时）
