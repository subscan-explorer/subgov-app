---
type: Roadmap
title: SubGov 功能规划
description: 基于 SubSquare 调研的 SubGov 多链治理门户功能规划与分阶段交付路线图（P0-P4）。
tags: [subgov, roadmap, planning, governance, substrate, opengov]
---

# SubGov 功能规划

基于 [SubSquare 调研报告](/openwiki/subsquare-research.md)，整理出 SubGov 多链治理门户的待办事项与实施清单。开发规范与自动化维护遵循 [SubGov Operations & Tooling](/openwiki/operations.md)，整体项目入口请参考 [SubGov Quickstart](/openwiki/quickstart.md)。

按模块拆分，每个模块标注优先级和依赖关系。

## 阶段划分

| 阶段 | 目标 | 核心交付 |
|------|------|----------|
| P0 | 治理浏览 | 能看到提案、投票结果、时间线 |
| P1 | 链上参与 | 能投票、创建提案 |
| P2 | 社区讨论 | 能评论、讨论、通知 |
| P3 | 网络数据 | Staking / Identity / Coretime 等 |
| P4 | 增强功能 | AI / 统计 / 跨链 |

---

## P0：治理浏览（最小可行版本）

### 基础设施

| 事项 | 说明 |
|------|------|
| 多链配置系统 | 配置化定义每条链的参数：symbol / decimals / ss58Format / blockTime / RPC endpoints / 启用模块 |
| Chain Adapter | 统一链接口：getBlock / getEvents / getExtrinsics / queryStorage / subscribeNewHeads |
| Runtime Decoder | 解析事件 / extrinsic / call，识别 runtime 版本，处理 OpenGov 和旧版 Democracy |
| Indexer 扫描器 | 按区块顺序扫描，保存进度，解析链上事件，写入业务表，支持断点恢复和 runtime 升级 |
| 数据库 | 链上原始数据 + 标准化业务数据存储 |

### OpenGov Referenda

| 事项 | 说明 |
|------|------|
| Referenda 列表 | 全部 / 活跃 / 按 Track 筛选 / 按状态筛选 / 分页 |
| Track 配置 | 16 个标准 Track 的信息（名称、阈值、周期等） |
| Referendum 详情 | 标题、正文、提案人、Track、状态、编号 |
| Proposal / Call 信息 | Proposal Hash、Preimage 内容、Call 解码 |
| 投票信息 | Aye / Nay / Abstain 票数和金额、Support、Issuance |
| 时间线 | Submitted → Preparing → Deciding → Confirming → Executed/Rejected |
| Referendum 摘要 | Summary API：各 Track 的活跃/总数统计 |

### Treasury

| 事项 | 说明 |
|------|------|
| Treasury Status | 余额、支出周期、Burn 比例 |
| Treasury Spend 列表 | OpenGov 直接支出，关联 Referendum |
| Spend 详情 | 金额、资产类型、Beneficiary、Payout、有效期 |
| Bounty 列表 + 详情 | 赏金任务：金额、Curator、状态、子赏金 |
| Child Bounty 列表 | Child Bounty 详情和状态 |

### 基础页面

| 事项 | 说明 |
|------|------|
| Overview / 首页 | 活跃 Referenda、Treasury 请求、最新提案 |
| 基础搜索 | 按编号 / 关键字搜索 |

---

## P1：链上参与

### 钱包连接

| 事项 | 说明 |
|------|------|
| 钱包框架 | 统一钱包接口，支持扩展 |
| Polkadot.js 扩展 | 最基本的钱包支持 |
| SubWallet | 第二优先级 |
| Talisman | 第三优先级 |
| WalletConnect | 移动端支持 |
| Polkadot Vault | QR 离线签名 |
| Mimir | 多签钱包 |

### 交易操作

| 事项 | 说明 |
|------|------|
| 投票 | Aye / Nay / Abstain + Conviction 选择 |
| 余额检查 | 检查余额和锁定 |
| 交易签名和广播 | 钱包签名 → 广播 → 等待确认 |
| 交易状态跟踪 | 以链上事件为准（不依赖广播成功） |
| 创建提案 | 选择 Track → 提交 Preimage → 提交 Referendum |
| Preimage 管理 | 新建 / 查看 / 关联 Preimage |
| Proxy 支持 | 通过代理账户投票 |
| Multisig 支持 | 多签投票流程 |

### Decision Period 和 Curve

| 事项 | 说明 |
|------|------|
| 阈值曲线 | Approval / Support 曲线渲染 |
| 投票进度 | 实时投票进度 vs 阈值曲线 |

---

## P2：社区讨论

### 用户系统

| 事项 | 说明 |
|------|------|
| Web3 登录 | 钱包签名登录（SiMa 模式） |
| Web2 登录 | 用户名 + 密码 + 邮箱（可选） |
| 账户设置 | Linked Address、Notification 配置 |
| 用户 Profile | 头像、简介、地址、投票历史 |

### 讨论功能

| 事项 | 说明 |
|------|------|
| 提案评论 | Referendum / Treasury / Bounty 的评论 |
| 回复 | 评论的回复 |
| 富文本编辑器 | Markdown 编辑器 |
| 点赞 / 点踩 | Up/Down Vote |
| @Mention | 提及用户 |
| 独立讨论帖 | Discussions 模块 |

### 通知

| 事项 | 说明 |
|------|------|
| 站内通知 | 新评论、被 Mention、状态变化 |
| 邮件通知 | Email 推送 |
| 订阅 | 订阅特定 Referendum / Track |

### Delegation

| 事项 | 说明 |
|------|------|
| Delegate 列表 | 委托人列表、简介、参与率 |
| 委托操作 | 按 Track 委托 / 取消委托 |
| 我的委托 | 用户自己的委托关系 |
| 委托统计 | 委托总量、Delegator 数 |
| Delegate Profile | 委托人自我介绍 / Announcement |

---

## P3：网络数据门户

### Staking

| 事项 | 说明 |
|------|------|
| Validators 列表 | Active / Total、佣金、自持仓、提名人 |
| Validator 详情 | 详细信息 |
| Nomination Pools | Pool 列表、加入/退出 |

### People / Identity

| 事项 | 说明 |
|------|------|
| Identity 列表 | 链上身份列表  |
| Identity 详情 | Display Name / Email / Web / Twitter / Matrix / GitHub |
| Registrars | 注册商列表 |
| Judgement Requests | 身份审核请求 |
| Usernames | 链上用户名 |

### 基础设施模块

| 事项 | 说明 |
|------|------|
| Preimage 列表 | Hash、Call、Depositor、状态 |
| Scheduler | 计划任务列表 |
| Whitelist | 白名单 Call |
| Vesting | 锁仓列表和解锁操作 |
| Proxy 管理 | 查看和管理代理关系 |
| Multisig 管理 | 查看和管理多签 |
| Recovery | Social Recovery |

### Coretime

| 事项 | 说明 |
|------|------|
| Sales 列表 | 当前 Sale、价格、Revenue |
| Cores 列表 | Core 编号、Task、类型 |

### Calendar

| 事项 | 说明 |
|------|------|
| 日历视图 | 链上事件按时间展示 |
| 事件类型 | Referendum / Decision / Confirmation / Enact / Treasury 到期 |

---

## P4：增强功能

| 事项 | 说明 |
|------|------|
| AI Summary | 提案自动摘要 |
| 翻译 | 提案内容翻译 |
| Whales 追踪 | 大户投票追踪 |
| 高级统计 | Treasury 年度分析、投票参与率趋势 |
| 多资产 Bounty | Multi-Asset Bounty / Child Bounty |
| Eco News | 生态新闻聚合 |
| 外部论坛 | Polkassembly 讨论导入 |
| 跨链 Profile | cross-chain 身份聚合 |
| Fellowship Salary | 薪资周期和支付 |
| Ambassador | 大使项目 |
| Secretary | 秘书模块 |

---

## 架构原则（来自调研）

以下原则直接源自 [SubSquare 调研报告](/openwiki/subsquare-research.md) 对开源架构与扫描器分包实践的分析：

1. **数据源隔离** — Chain Adapter 统一接口，不同链差异只留在 Adapter 内部
2. **四层数据** — 原始链上 / 标准化业务 / 平台内容 / 派生展示，分开存储
3. **配置驱动多链** — 新增链 = Chain Adapter + Runtime Mapping + 配置，不复制项目
4. **链上事实为准** — 投票结果以 Indexer 观察的链上事件为准，不依赖交易广播
5. **前后端分离** — Next.js 前端 + 独立后端 API + 独立扫描器
6. **SiMa 优先** — 讨论、评论通过钱包签名验证，Web3 原生
