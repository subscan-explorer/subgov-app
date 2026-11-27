---
type: Research
title: SubSquare 调研报告
description: SubSquare 多链治理门户的全面调研报告，涵盖产品定位、已接入链、功能模块清单、技术架构与开源生态。
resource: https://www.subsquare.io/
tags: [subsquare, research, governance, polkadot, substrate, architecture]
---

# SubSquare 调研报告

基于 2026-09-09 对 SubSquare 官网、Polkadot 实例、GitHub 公开仓库和 API 的调研，为 [SubGov 功能规划](/openwiki/subgov-plan.md) 提供产品矩阵基准与架构设计依据。

## 1. SubSquare 产品定位

SubSquare 是 **面向 Substrate / Polkadot 生态的多链治理门户**。

核心能力：将链上治理数据索引、标准化，叠加提案讨论、身份、通知和钱包交互。

官方描述：
> "A platform that scans and normalizes the blockchain governance data. It enables community members to propose, vote proposals and discuss the corresponding topics."

**不是单链 DAO 页面**，而是一套多租户治理数据基础设施 + 社区讨论平台。

## 2. 已接入链

已确认接入或展示过的链（来自官网和代码 `chains.js`）：

| 类别 | 链 |
|------|-----|
| Relay Chain | Polkadot, Kusama |
| System Parachain | Asset Hub (Polkadot/Kusama/Westend), Collectives, Coretime, People |
| Parachain | Acala, Karura, Bifrost, Bifrost Polkadot, Phala, Khala, Hydration (HydraDX), Interlay, Kintsugi, Crust, Centrifuge, Astar, Moonbeam, Moonriver, Vara, Polkadex, Zeitgeist, Litentry, Darwinia, Calamari, Turing, Basilisk, Litmus, Crab |
| 其他 | zkVerify, Laos, HyperBridge, Acurast, Ajuna |
| 测试网 | Rococo, Westend, Paseo, Shibuya, Development |

共计 **50+ 链**，通过配置驱动（每条链一个 settings 文件）。

## 3. 功能模块详细清单

### A. Overview（首页）

首页回答的核心问题：
- 当前有哪些治理事项？
- 哪些正在投票？哪些即将结束？
- Treasury 当前有多少请求？
- 最近有什么值得关注的提案？

数据来源 API（来自 `url.js`）:

```
overview/discussions
overview/referenda
overview/fellowship
overview/democracy-referenda
overview/public-proposals
overview/externals
overview/treasury-proposals
overview/treasury-spends
overview/bounties
overview/child-bounties
overview/tips
overview/motions
overview/tc-motions
overview/financial-motions
overview/alliance-motions
overview/alliance-announcements
overview/advisory-motions
overview/community-motions
overview/community-treasury-proposals
overview/fellowship/treasury-spends
```

### B. OpenGov / Referenda（核心模块）

**列表功能**：
- 全部历史 Referenda
- 活跃 Referenda
- 按 Track 筛选（16 个 Track，见下）
- 按状态筛选：Preparing / Deciding / Confirming / Executed / Rejected / Cancelled / TimedOut
- 分页
- 新建提案
- 统计信息
- 投票入口 / Delegate 入口
- Whales 大户追踪

**Polkadot OpenGov Tracks**（来自实际 API）：

| Track ID | 名称 | 用途 |
|----------|------|------|
| 0 | root | 最高权限 |
| 1 | whitelisted_caller | 白名单调用 |
| 2 | wish_for_change | 意见表达 |
| 10 | staking_admin | 质押管理 |
| 11 | treasurer | 财务 |
| 12 | lease_admin | 租约管理 |
| 13 | fellowship_admin | Fellowship 管理 |
| 14 | general_admin | 通用管理 |
| 15 | auction_admin | 拍卖管理 |
| 20 | referendum_canceller | 取消提案 |
| 21 | referendum_killer | 终止提案 |
| 30 | small_tipper | 小额打赏 |
| 31 | big_tipper | 大额打赏 |
| 32 | small_spender | 小额支出 |
| 33 | medium_spender | 中额支出 |
| 34 | big_spender | 大额支出 |

**详情页**：
- 标题、正文内容（Markdown / 富文本）
- AI Summary、翻译
- 提案人、Track、状态、提案编号
- Proposal Hash、Preimage / Call 信息
- Decision Deposit、Enact 时间
- Decision Period、Confirmation Period
- 投票比例（Aye / Nay / Abstain）
- Support、Issuance
- 阈值曲线、投票曲线
- 投票统计
- 完整时间线
- 评论和回复、点赞 / 点踩
- 分享、钱包投票

**API 端点**（来自 `url.js`）:

```
gov2/referendums                              # 列表
gov2/referendums/{index}                      # 详情
gov2/referendums/{index}/vote-extrinsics      # 投票外交易列表
gov2/referendums/{index}/vote-calls           # 投票调用
gov2/referendums/{index}/vote-stats           # 投票统计
gov2/referendums/{index}/comments             # 评论
gov2/referendums/summary                      # 摘要
gov2/referenda/whales                         # 大户
gov2/referenda/history-whales                 # 历史大户
gov2/referenda/{index}/actions                # 操作记录
gov2/referenda/{index}/appendants             # 附件
gov2/tracks                                   # Track 列表
gov2/tracks/summary                           # Track 摘要
gov2/tracks/{id}/referendums                  # 按 Track 查 Referenda
gov2/tracks/{id}/referendums/summary          # Track 下 Referenda 摘要
```

### C. 旧版治理（已归档）

旧版 Polkadot/Kusama 治理模型，部分链仍在使用：

| 模块 | 说明 | 在 Polkadot 状态 |
|------|------|------------------|
| Democracy Referenda | 旧版公投 | archived |
| Public Proposals | 公开提案 | archived |
| External Proposals | 外部提案 | archived |
| Council Motions | 理事会动议 | archived |
| Technical Committee | 技术委员会 | archived |
| Financial Council | 财务委员会 | 部分链使用 |
| Advisory Committee | 顾问委员会 | 部分链使用 |
| Community Council | 社区委员会 | 部分链使用 |
| Alliance | 联盟 | Collectives 链 |

每类治理差异：提案类型、投票模型、Origin、状态机、阈值算法、成员/席位、执行方式、链上事件格式。

### D. Treasury

**业务对象**：

| 对象 | 说明 |
|------|------|
| Treasury Status | 余额和支出周期 |
| Treasury Spend | Polkadot OpenGov 的直接支出 |
| Treasury Proposal | 旧版支出提案 |
| Bounty | 赏金任务 |
| Child Bounty | 子赏金 |
| Multi-Asset Bounty | 多资产赏金（Polkadot 新增） |
| Multi-Asset Child Bounty | 多资产子赏金 |
| Tip | 打赏（旧版，已归档） |
| Burn | 销毁 |
| Treasury Projects | 项目汇总 |

**统计维度**：
- Beneficiary 统计
- 按标签统计
- 按年度统计
- Treasury 余额和支出周期

**来自 API /summary 的实时数据**（2026-09-09）：

```json
{
  "treasuryProposals":   { "active": 8,  "all": 1042 },
  "treasurySpends":      { "active": 35, "all": 286 },
  "bounties":            { "active": 14, "all": 7209 },
  "childBounties":       { "active": 0,  "all": 6866 },
  "multiAssetBounties":  { "active": 3,  "all": 3 },
  "multiAssetChildBounties": { "active": 0, "all": 75 }
}
```

### E. Fellowship

技术 Fellowship 治理模块：

- Fellowship Referenda（独立投票轨道）
- Fellowship Members（按 Rank 的成员列表）
- Fellowship Core Feeds（活动流）
- Fellowship Core Evidences（证据提交）
- Fellowship Tracks（独立 Track 体系）
- Fellowship Salary（周期性薪资）
  - Salary Cycles
  - Registrations
  - Registered/Unregistered Payments
  - Claimants
  - Feeds
- Fellowship Statistics
  - 按 Cycle 统计
  - 按 Member 统计
  - 按 Rank 统计
  - Membership 时间线
  - Member Rank History

### F. Delegation（委托）

- Delegate 列表 + 描述
- 最大被委托票数
- Delegator 数量
- Participation 参与率
- Delegation Announcement
- 用户自己的委托
- 收到的委托
- 按 Track 委托
- Delegation 统计

**API 端点**：

```
delegation/referenda/delegates/{address}
delegation/democracy/delegates/{address}
```

数据存储需区分链上委托关系和平台展示的 Delegate 资料。

### G. 投票

钱包支持：
- Polkadot.js
- SubWallet
- Talisman
- PolkaGate / PolkaGate Snap
- Nova
- WalletConnect
- Polkadot Vault（QR 离线签名）
- Mimir（多签钱包）
- Signet
- Coinbase Wallet（EVM 链）

投票流程：
```
选择钱包 → 选择账户 → 选择 Aye/Nay/Abstain → 选择 Conviction
→ 检查余额和锁定 → 钱包签名 → 广播交易 → 等待区块确认 → 更新投票状态
```

需支持：SingleSig、Multisig、Proxy、WalletConnect、不同链不同交易格式。

### H. Staking（Polkadot）

#### Validators
- Active / Total Validators
- 平均佣金、提名人数、自持仓、总质押量
- 搜索、筛选、排序
- Validator 详情

#### Nomination Pools
- Active Pools
- Pool ID / 名称 / 状态
- 成员数 / 质押量 / 奖励
- 加入 / 退出

### I. People（身份）

- On-chain Identity（链上身份）
- Identity 详情（Display Name / Email / Web / Twitter / Matrix / GitHub / Legal Name）
- Registrars（注册商列表）
- Judgement Requests（身份审核请求）
- Usernames（链上用户名系统）
- Identity Verification（身份验证）

### J. Proxy / Multisig / Recovery

- 代理：Pure Proxy、Any / Governance / Staking / NominationPools Proxy
- 多签：导入已有多签 / 创建新多签 / Mimir 集成
- 恢复：Social Recovery

### K. 基础设施模块

#### Preimage
- Preimage 列表
- Preimage Hash、Call 参数、Depositor、长度、Deposit
- Requested / Unrequested
- 新建 Preimage

#### Scheduler
- 计划执行时间、间隔、Origin、Call、执行状态、下次执行时间

#### Whitelist
- Whitelisted Call、Hash、关联 Preimage

#### Vesting
- Vesting Schedule、总额、已解锁、可解锁、开始/结束时间、Unlock 操作

### L. Coretime

- Coretime Sales（当前 Sale、价格、Floor Price、Revenue）
- Cores（Core 编号、Task/Parachain、类型：Reservation / On Demand / Bulk）

### M. Calendar

把链上治理事件按时间展示：Referendum 开始、Decision 开始、Confirmation、Enact、Treasury 过期等。

**API**：
```
events/summary
events/user-events/summary
events
events/user-events
```

### N. 讨论 / 内容

- 独立讨论帖（Discussions）
- Polkassembly 讨论导入
- 富文本编辑器
- 评论和回复
- 点赞 / 点踩
- @Mention
- AI Summary （标记 `translations.referenda: true`）
- 翻译
- 举报
- 标记为 Spam
- Link Post（关联帖子）
- Appendant（附件/追加内容）
- Eco News（生态新闻）

### O. 登录和账户

#### 登录方式
- 用户名 + 密码 + 邮箱
- Web3 钱包签名登录（SiMa 模式）

#### 账户设置
- Account / Key Account
- Linked Address
- Proxy
- Notification / Subscription
- Delegation
- Votes / Deposits / Multisigs / Been Delegated

#### 通知
- 新评论、被 Mention、新支持者
- 订阅对象的状态变化
- 链上治理事件提醒
- Email 通知

## 4. 技术架构分析

### 代码仓库结构

SubSquare 的前端代码在 [opensquare-network/subsquare](https://github.com/opensquare-network/subsquare)。

**Monorepo 结构**（yarn workspaces）：

| 包 | 说明 |
|----|------|
| `packages/next` | Polkadot 主站前端（Next.js） |
| `packages/next-common` | 共享组件/服务/工具库 |
| `packages/collectives-next` | Collectives 链专用前端 |
| `packages/kintsugi-next` | Kintsugi/Interlay 链专用前端 |

**后端不在此仓库**。前端通过 `NEXT_PUBLIC_BACKEND_API_END_POINT`（默认 `http://127.0.0.1:7071/`）连接独立后端服务。Next.js API Routes（`pages/api/[...slug].js`）做代理转发。

### next-common 内部结构

| 目录 | 说明 |
|------|------|
| `components/` | 150+ UI 组件目录 |
| `services/` | API 调用和数据获取 |
| `hooks/` | React hooks |
| `context/` | React Context |
| `store/` | 状态管理 |
| `utils/` | 工具函数和常量 |
| `lib/` | 底层库 |
| `sima/` | SiMa 签名聚合系统（链下讨论的链上签名） |
| `noSima/` | 非 SiMa 的传统 API 调用 |
| `styles/` | 样式 |
| `assets/` | 静态资源 |
| `pages/` | 共享页面逻辑 |

### SiMa 系统

SiMa（Signature Aggregation）是 SubSquare 的关键创新：

- 用钱包签名替代传统用户名密码登录
- 讨论、评论、投票等操作都通过链上签名验证
- 操作列表（从代码 `sima/actions/` 推断）：
  - comment：评论
  - upVote / downVote / cancelUpVote / cancelDownVote：投票
  - appendant：追加内容
  - deleteComment：删除评论
  - linkPost：关联帖子
  - provideContext：提供上下文

### 关联开源仓库

| 仓库 | 用途 |
|------|------|
| [statescan-v2](https://github.com/opensquare-network/statescan-v2) | 区块链浏览器（Block/Account/Asset/Identity/Proxy/Recovery/Vesting/Multisig/Staking 扫描） |
| [scan-common](https://github.com/opensquare-network/scan-common) | 扫描器公共库（Chain API / Block Fetch / Event Decode / MongoDB 存储） |
| [gov-tracker](https://github.com/opensquare-network/gov-tracker) | 治理数据追踪脚本 + GraphQL Server |
| [dotreasury](https://github.com/opensquare-network/dotreasury) | Treasury 专项（Scan + Server + Site） |
| [collaboration](https://github.com/opensquare-network/collaboration) | Off-chain 投票（Backend + Next.js + MongoDB + IPFS） |
| [polkadot-api-container](https://github.com/opensquare-network/polkadot-api-container) | Polkadot API 实例管理 |
| [ipfs-server](https://github.com/opensquare-network/ipfs-server) | IPFS 数据上传服务 |

### statescan-v2 的扫描器分包

这些代表了索引链上数据需要的完整扫描器集合：

```
account-scan         # 账户扫描
asset-scan           # 资产扫描
block-scan           # 区块扫描
foreign-assets-scan  # 外部资产扫描
identity-scan        # 身份扫描
identity-server      # 身份查询服务
multisig-scan        # 多签扫描
multisig-server      # 多签查询服务
pallet-assets-scan   # Pallet Assets 扫描
pallet-assets-server # Pallet Assets 查询
pallet-proxy-scan    # Proxy 扫描
pallet-recovery-scan # Recovery 扫描
pallet-staking-scan  # Staking 扫描
runtime-scan         # Runtime 扫描
uniques-scan         # NFT (Uniques) 扫描
vesting-scan         # Vesting 扫描
graphql-server       # GraphQL 查询层
server               # REST 查询层
mongo                # MongoDB 公共层
common               # 公共工具
```

### scan-common 的核心能力

```
src/
├── chain/          # 链连接管理（API 实例、区块获取、最新头部、链设置）
├── consts/         # 常量
├── env/            # 环境配置
├── extrinsic/      # Extrinsic 解析
├── mongo/          # MongoDB 连接和操作
├── scan/           # 扫描主循环（区块 by 区块）
├── type/           # 类型定义
└── utils/          # 工具函数
```

### 数据库

- **链上数据**：MongoDB（来自 scan-common 和 statescan-v2）
- **Off-chain 内容**：MongoDB + IPFS
- **查询层**：REST API + GraphQL

## 5. 多链配置系统

每条链通过 settings 配置文件定义功能：

```javascript
// 以 Polkadot 为例（简化）
{
  value: "polkadot",
  symbol: "DOT",
  decimals: 10,
  ss58Format: 0,
  blockTime: 6000,
  hasElections: true,
  hasIdentity: true,
  hasMultisig: true,
  sima: true,                        // 启用签名聚合
  allowWeb2Login: true,              // 允许 Web2 登录
  supportWalletconnect: true,
  supportPolkadotVault: true,
  enablePapi: true,                  // 新版 Polkadot API
  modules: {
    discussions: true,
    whales: true,
    scheduler: true,
    democracy: { archived: true },   // 旧版已归档
    referenda: { displayTreasuryRequesting: true },
    treasury: {
      status: true,
      spends: true,
      childBounties: true,
      multiAssetBounties: true,
      tips: { archived: true },
      burn: true,
    },
    council: { archived: true },
    technicalCommittee: { archived: true },
    coretime: true,
    assethub: true,
    people: true,
    vesting: true,
    whitelist: true,
    staking: true,
  },
  integrations: {
    doTreasury: true,
    statescan: true,
    subscan: true,
    discourseForum: { link: "https://forum.polkadot.network" },
    polkassembly: { discussions: true },
  },
  newProposalQuickStart: {
    usdxTreasuryProposal: true,
    batchUsdxTreasurySpendsProposal: true,
    cancelReferendum: true,
    killReferendum: true,
  },
}
```

新增一条链 = 添加 Chain Settings + 配置后端 Indexer。

## 6. 四类数据模型

### 第一类：链上原始数据

不可人为修改的事实：

```
Block / BlockHash / Timestamp
Runtime Metadata / SpecVersion
Extrinsic / ExtrinsicIndex
Event / EventIndex
Call
Storage Snapshot
Account / Balance / Asset
Governance State / Vote
Treasury State / Identity
Staking State / Proxy / Multisig
Vesting / Coretime
```

### 第二类：标准化业务数据

统一结构化的治理数据：

```
Referendum         # 提案
Track              # 投票轨道
Vote / VoteTally   # 投票和统计
TreasurySpend      # 支出
TreasuryProposal   # 旧版提案
Bounty / ChildBounty
CouncilMotion
CollectiveMember
Delegation
Preimage
ScheduledCall
CalendarEvent
```

### 第三类：平台内容数据

链上不存在的内容：

```
Post / Comment / Reply
AI Summary / Translation
Tags / Labels
Delegate Profile
User Account / Avatar / Email
Follow / Subscription / Notification
Admin Configuration
Project Logo / Branding
External Links
```

### 第四类：派生/展示数据

可重新计算：

```
USD Price / DOT 折算
Treasury 年度统计
投票参与率 / Support 百分比
阈值曲线 / 投票曲线
排名 / 搜索索引
缓存摘要
```

## 7. 事实与推断边界

### 已确认事实

- SubSquare 扫描并标准化区块链治理数据
- 支持 50+ 条 Substrate / Polkadot 生态链
- 前端为 Next.js monorepo，后端为独立服务（端口 7071）
- 使用 MongoDB 存储 + IPFS
- 支持 OpenGov（16 Track）、Treasury（含 Multi-Asset Bounty）、Fellowship（含 Salary）、Delegation
- 支持 SiMa 签名聚合（讨论/评论通过钱包签名）
- 支持 10+ 种钱包
- 支持 Staking、Identity、Proxy、Multisig、Vesting、Scheduler、Preimage、Coretime
- 使用配置驱动的多链架构
- 相关开源仓库包括 statescan-v2（浏览器）、scan-common（扫描器公共库）、gov-tracker、dotreasury、collaboration

### 不确定 / 未公开

- 后端业务服务代码未公开（只有扫描器和前端公开）
- 后端 API 的完整实现细节
- 多链部署的运维架构
- 数据库具体 Schema
- AI Summary 和翻译功能的具体实现
- 通知系统的具体实现

## 8. 下一步规划

本调研的分析结论直接输入至 [SubGov 功能规划](/openwiki/subgov-plan.md)，作为其 P0-P4 分阶段路线图与架构原则的技术基准。整体项目背景与治理维护说明请参考 [SubGov Quickstart](/openwiki/quickstart.md)。
