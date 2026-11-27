# SubGov 自动补测收口与剩余验收（2026-11-24）

> 范围更新：DV 与未上线讨论功能已按用户要求移除，公投评论保留；F03 作为历史问题暂不纳入验收，Polkadot/Kusama 新接口按待部署处理。以下保留当时的测试记录，当前结论以 [2026-11-24 范围更新](2026-11-24-scope-update.md) 为准。

本报告更新 [45 路由验收清单](2026-11-23-full-acceptance.md)。可在当前环境执行的补测已完成；真实钱包/设备、缺失服务和所需链状态分别列在下面。**这不是“全部业务验收通过”或“已部署”的声明。** 修复在 [PR #130](https://github.com/subscan-explorer/subgov/pull/130)，仍待合并和部署。

证据分层：staging 使用真实后端；本地 production build 使用当前修复、真实 RPC 和明确标注的本地索引 fixture；组件测试只替换钱包/RPC/索引边界。后两种不能冒充真实钱包或后端上线验收。[本轮公开证据](2026-11-24-automatic-evidence.json)保存原始链值及 64 条页面/环境观察，包含发现的问题，不是 64 个全部通过的用例。瞬时 loading 快照未用来判定通过。

## 已补齐的自动验证

| 范围 | 本轮结果与证据 | 对应原清单 |
| --- | --- | --- |
| 交易表单 | 实际 TxDialog、VoteDialog、DelegateDialog、UndelegateDialog、NewProposalPage：同一事件批次重复提交只调用一次；拒签后可重试；广播/InBlock 不误报完成；切账户/网络不接收旧回执；主网确认、watch-only、错误 WC 链保护。两轨批量取消表单传递 `[30,31]` | M01–M04 |
| 读取隔离与失败恢复 | 实际账户 hook、ReceivedDelegations、WhitelistList：换人/切链立即隐藏旧数据、丢弃迟到响应；RPC 失败显示错误，reload 恢复；索引失败与空列表分开 | M08/M09 |
| 提案 | 9 种模板在真实 Paseo metadata 下构造；31 组非法金额/地址/精度/origin/资产元数据/batch/ID/enactment/hash/length/bytes 在签名前拒绝。staging 额外验证精度、无效收款人、250 PAS 轨道上限；本地 UI 验证尾部多余字节。正常 9 模板 UI 预览沿用前轮已完成证据 | M02 |
| 公投列表 | Paseo 所有现有状态按钮，包括非空与空结果；SmallTipper 41 条的首/中/末页分别 20/20/1 条且无重复；从末页筛选重置页码；编号及非法数字回归 | M09 |
| 收到的委托与个人页 | 公开地址 `5GLFK…Kz4w` 的五个 tab、委托目录/详情；链上 Root 票权 0.1 PAS、本金 1 PAS 与 UI 相同，索引委托人 `5CXZn…7C` 显示 1 PAS/0.1x。他人页面没有本人签名操作；评论 tab 明确缺服务 | M04/M08 |
| 历史锁 | 真实公开账户的 #96–#99；修复前 UI 把 killed/timed-out 历史结束区块解释为未来约 405–413 天的锁。修复后 4 条显示 lock expired，可释放估计从 1000 PAS 改为 1350 PAS；真实 RPC、运行时规则与本地 UI 一致。未替他人执行解锁 | M05/M08 |
| 国库余额和资产 | Polkadot/Kusama/Paseo 所有展示余额按原始整数与 decimals 独立换算，对账到 UI 的两位小数；Kusama 1337 为 TIP/10、foreign DOT 为 DOT/10；Kusama 多资产赏金 #2 的三个子赏金为 10/10/5 DOT，金额与状态一致 | M09 |
| 国库列表 | Paseo 35 条赏金首尾页、Active/Historical；Polkadot spends 首尾页（尾页 #207–#203）；Kusama 历史 proposals 非空、tips 空。发现的 Active 筛选遗漏列为 F02，不算通过。共有分页参数新增 NaN/Infinity/小数/负数/不安全整数验证 | M09 |
| 子赏金边界 | 复用已通过的真实 #31-218；跨页 lookup、parent=0 防串记录、50 页上限、接口错误与不存在的区别都有自动回归 | M09 |
| 白名单 | Polkadot 非空 hash `0xef74…e282` 与链存储一致；点击 Decode 明确提示链上没有预映像。Paseo/Kusama 空状态；切链隔离有组件回归。不能将“未存储”判为解码成功 | M06 |
| Fellowship | Collectives 独立 RPC：collective members=100，referendum count=685 与 UI 相同；原始轨道参数、12 秒本链周期、#679 Executed 和 #671 Timeout 详情、rank-weighted 单位、Collectives 外链、尾页与编号跳转。筛选值已修；索引状态不一致列为 F01 | M12 |
| 全局 UI | 编号和地址快捷搜索、Esc、明暗切换及刷新保持；title/hash 搜索仍依赖未开放能力。Settings 仅 preview 的既有自动验收继续有效；不存在的保存/邮件通知或系统主题选项不作为已实现功能 | M13 |
| 能力阻塞页 | 本轮重新打开统计、whales、DV、vote feed、delegation statistics、burns、calendar、create post，最终均给出具体未部署提示；没有把提示页作为真实业务通过 | M10/M11 |
| #160 最终页面 | 本地空/滞后索引 fixture + 真实 RPC：Deciding、decision deposit=1 PAS、submission=10 PAS、7d/confirm 10m；Place decision deposit 消失。0/0/0 tally 与链一致 | M02/M03 |

工程验证：Node 24.22.1；lint、TypeScript、全部 **10 组默认测试**、production build 通过。新增 `test:interactions` 已纳入 `pnpm test`，回归会随 CI 执行。真实 RPC 与提案测试仅只读。本轮没有新增签名交易；前轮 [30 笔 finalized 回执](2026-11-23-paseo-receipts.json)继续保留。

## 本轮修复

- 五类交易表单增加同步提交锁及钱包/网络作用域隔离，避免重复签名、旧账户回执和旧预览串入新会话；补齐批量取消委托 handler 的签名网络/主网确认检查。
- 账户投票、ReceivedDelegations、WhitelistList 在切换上下文时清除旧数据。
- 只有获胜的有 conviction 的 Standard vote 延续锁；已结束且没有后续锁的票用立即可移除状态，不再依赖可能来自旧时钟的 end 值。
- 拒绝编码后不能完整还原输入的预映像 call，避免静默丢弃尾部字节。
- 编号跳转拒绝不安全整数；9 个列表路由共享严格页码解析，错误页码回到第一页。
- Fellowship 筛选保留 API 的原始轨道名（可能是 hex）；显示名称单独解码。若返回其它轨道记录则显示错误，不伪装筛选成功。Active 改为过去一个月的 active voters，未知指标不写成 0，注明索引可能滞后。
- 国库历史周期高于当前治理区块时停止给出误导性倒计时和负数进度；周期计算改为常数时间。
- 二进制预映像不再拼成乱码赏金标题；个人页空资产符号显示 Unknown token。

锁规则核对了 [Paseo governance 配置](https://github.com/paseo-network/runtimes/blob/main/system-parachains/asset-hub-paseo/src/governance/mod.rs)、[SDK remove_vote](https://github.com/paritytech/polkadot-sdk/blob/master/substrate/frame/conviction-voting/src/lib.rs) 和 [Referenda PollStatus 映射](https://github.com/paritytech/polkadot-sdk/blob/master/substrate/frame/referenda/src/lib.rs)。Paseo snapshot runtime 为 `asset-hub-paseo/2005006`；此次没有运行时升级。

## 需要你手动执行的项目

这些是当前环境不能替代的真实钱包/设备和公共内容操作。其余自动回归无需你重复执行。

| ID | 必须人工覆盖 | 操作与通过标准 |
| --- | --- | --- |
| H01 | SubWallet 扩展、Nova、Mimir、WalletConnect 的真实连接/签名 | 每种环境：连接→选专用测试账户→刷新恢复→拒签一次→Paseo #160 小额 None 投票→确认钱包显示的 genesis/账户/call 与页面一致→等待 Finalized→不刷新核对本人票/tally，再刷新复核→Remove/Unlock 清理→断连。切主网只读后切回；WC 验证错误链/断连/二维码过期重连；Mimir 额外确认 real/proxy 与 signer、手续费归属。不要签主网测试交易 |
| H02 | 真实移动端、Safari/Chrome 的设备兼容性 | 390px 左右实际窄屏：导航开关、长地址、表格横向滚动、弹窗可滚到底、软键盘后按钮可点击、Esc/返回/焦点；Nova 从钱包返回 DApp 后不丢状态。本轮 viewport API 请求 390×844，但实际 DOM 始终 1280px，已记环境限制，未冒充移动验收 |
| H03 | 消息签名登录与真实评论持久化 | 用测试身份在自己的 #160 发一条明确 QA 内容→回复→编辑→刷新核对→复制评论锚点新开→删除自有评论；拒绝消息签名不能登入，换人/断连/watch-only 后旧身份不能编辑。自动测试已覆盖评论权限/状态/请求，真实公共发布未执行。Posts/polls/reactions 等缺能力的项目先等 B01，不能靠此操作验收 |

H01 的真实 UI 自动刷新需看到最终票/锁/委托数据正确；只看到 ExtrinsicSuccess 不足以通过。更完整的金额、步骤和回执字段沿用原清单 M01/M03/M04/M11/M13。

## 当前无法完成真实状态验收的项目

| ID | 阻塞项 | 当前证据 / 解除条件 | 解除后谁测 |
| --- | --- | --- | --- |
| B01 | 缺失后端/讨论能力 | 原清单 M10 的 #90/#91/#94/#95/#96/#97/#98/#100/#103/#106/#108/#119；描述/公告/作者评论及 posts/polls/reactions 的 #101/#111/#112/#113；搜索 #118。本轮真实 staging 提示仍存在，hash 输入也没有可用结果。需要对应接口部署和真实记录 | 主要可自动；真实消息签名/公开发布按 H03 |
| B02 | 已结束公投的实际退款、获胜票 conviction 到期 | 自有 #160 仍 Deciding，10+1 PAS 公投押金仍持有。无适用自有结束记录，不能提前退款或替他人验证。纯函数、提前退款、重复/归属 guard 已测试 | 到期后可自动，与 UI 对账 |
| B03 | Requested preimage 的 ticket 退还而 bytes 保留 | 自有 #160 预映像仍 Unrequested，ticket=0.40103 PAS、39 bytes；Lookup 本身不保证 Requested。需一个真实 Requested 且 ticket 属于测试账户的样本 | 有样本后可自动 |
| B04 | treasury payout/checkStatus 和目的端到账 | Paseo 没有已获批、可支付到受控账户的 spend。源链成功不足以证明跨链到账；需治理批准、validFrom 和目的端记录 | 有条件后可自动 |
| B05 | 其它模板实际执行、白名单新增/dispatch 后移除 | 九种模板已做编码/预览；Cancel/Kill/whitelist 等需要治理权限和有效目标。普通测试账户无法缩短治理周期或获得 Root/Fellowship 权限 | 具备权限/周期后可自动 |
| B06 | 修复部署后的真实后端复验 | #130 未合并/部署；本地 fixture 不代表真实索引/API 验收。尤其 Fellowship 的原始 origin 过滤要在部署后用真实 provider 再核对 | 可自动，不要求你手工点所有页面 |
| B07 | 非空历史 tips 等当前没有样本的分支 | Paseo、Kusama Asset Hub 实测 tips 为空；不能用不存在的记录宣称历史详情/分页数据准确。映射和分页逻辑已有自动回归 | 有真实样本后可自动 |

## 已测出、仍需上游修复的问题

这些不是“没测”，也不是已通过。

| ID | 结果 | 原因与后续 |
| --- | --- | --- |
| F01 | Fellowship 索引与 Collectives 不一致 | UI Voting=6、Confirming=3；同轮 RPC 只有 #675/#678/#682/#683/#684 共5个 ongoing，confirming=0；UI 老记录 #4 为 Confirm，链上已经 Approved。轨道 deciding 聚合也含旧状态。成员100与链一致；Active=30 是过去一个月的去重投票人数，不能与 core `isActive` 混为一个指标。需要索引方修复历史终态与聚合；前端已说明数据来源/延迟，不能验收实时计数准确 |
| F02 | Bounties Active 筛选漏记录 | Paseo All 中 #32/#31/#7/#5 为 Became active；Active 筛选只返回 proposed 等记录，遗漏这些。本地后端 `internal/service/scan/governance.go` 的 active 条件枚举包含 `active`，当前事件处理也写入 `active`；这不能证明线上旧记录使用相同值。需上游核查实际返回值、历史状态映射和部署版本，修复遗漏后再对 All/Active/History 集合关系验收；前端没有靠过滤当前一页伪造正确全量结果 |
| F03 | Paseo treasury 历史时钟数据异常 | RPC `lastSpendPeriod=12,355,200`，当前治理 relay block≈2,075,431，spendPeriod=43,200。旧页面给出约717天和负进度；本地已改为 Schedule unavailable。恢复正常周期需要链上历史数据/时钟问题解决，不能从 UI 自行推算一个假日期 |

## 测试账户与回收状态

本轮只读快照：`5GpePZ…YPvi` free **4988.5605839922 PAS**、reserved **11.40103 PAS**、frozen **0**，nonce=27。与前轮结束一致；本轮没有新增链上费用或押金。#160 保留 10 PAS submission、1 PAS decision 和 0.40103 PAS preimage ticket。不要为了清理而误将 Unrequested preimage 删除，治理记录仍需要其 bytes。

已实现功能的自动路径、边界与失败路径已经有具体证据；只有 H01–H03 留给人工。B/F 条件解除及 #130 部署后可以继续自动复验，不把这些依赖项转嫁为一份“全部再手测”的清单。
