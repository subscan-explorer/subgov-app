# 主网新接口自动补测（2026-11-25）

本记录更新 [11 月 24 日范围与验收状态](2026-11-24-scope-update.md)。Polkadot/Kusama 新接口已部署；用户确认真实钱包、设备及公投评论均已完成手测；这些记录为用户确认，本轮未独立重复验证。DV 和未上线独立讨论功能已移除，公投评论保留；F03 历史国库时钟继续忽略。

## 证据范围

- 基线 main `4461d7db9de00f9c5be1e88b62801413fb887d3e`，staging 使用真实后端；作者筛选修复使用本地 Next.js、真实公开 Subscan API。
- 104 次只读 API 请求正常返回。53 项数据断言中 48 项通过、5 项失败，失败归为下列 3 类问题；HTTP 成功不等于业务数据正确。
- 50 条 staging 页面观察，包括预期阻塞、已移除路由及中间加载状态，不记作 50 个通过用例。中间状态由后续加载完成的观察替代。
- Polkadot finalized #23,576,517，Kusama #24,245,062；异常样本随后再次通过公开 RPC 复核。
- 本轮未签名、未发链上交易、未发布评论、未修改线上数据库或部署。[机器可读状态](2026-11-25-mainnet-evidence.json)。

## 已通过与修复

| 范围 | 验证 |
| --- | --- |
| 公投统计 | 两网 submission/finalized 两时间轴；月/轨道汇总和终态集合与链匹配。Polkadot 1,972 个已决定、1,069 passed、593 rejected、54.2%；Kusama 680、393、174、57.8%。注意 finalized 轴的 submitted 排除 ongoing |
| 委托与鲸鱼榜 | 金额、精度、账户链接、active/history 排序；委托总量与轨道合计相符。UI 与 API 数值一致 |
| 投票明细与分析 | #1970/#681 的嵌套 self/delegated votes、账户数及 tally 与链交叉核对；UI direct/delegated 为 14/21 和 3/3。全局列表分页、Aye/Nay/Abstain、轨道筛选与 API 行序一致，但“最新”语义失败，见 F04 |
| 国库销毁与日历 | Polkadot 3 条 burns；首条 180,649.48 DOT 与 #11,097,546 的 Treasury.Burnt 原值一致；Kusama 空态。两网真实日历样本的标题、区块、UTC 展示一致 |
| 公投押金 | Polkadot #1973 为 10 DOT refunded，链上 deposit 已清除；Kusama #682 的 0.0333 KSM submission 仍锁定 |
| Fellowship | 全部 24 个 raw-origin API 筛选通过；UI #3/#12/#32 和空轨道 #9、翻页核对。F01 在当天较早复验已通过，不能继续引用 11 月 24 日的旧失败结果 |
| 移除功能 | staging 无 DV/Discussions 导航，旧路由展示不存在页面；公投 Community comments 保留且只读加载正常 |
| 作者筛选修复 | `/preimages/?account=…` 删除永久 pending 分支，传递实际 account 参数。真实 API/UI：Polkadot 同作者 39 条为 20+19 两页；Kusama 1 条。修复已本地验证，尚未合并/部署；预映像 status 本身仍有 F05 |

历史 Tips 修复及主网条件样本的新证据见[后续复核](2026-11-25-conditional-mainnet-validation.md)。

工程验证：Node 24.22.1；`pnpm test` 的全部现有默认套件、`pnpm typecheck`、改动文件 ESLint 和 `pnpm build` 通过。没有为简单接线新增重复实现的测试。

## 新发现的失败（不是未测试）

| ID | 复现与证据 | 影响 / 后续 |
| --- | --- | --- |
| F04 | `/api/scan/referenda/votes`，`{"page":0,"row":20,"valid":"valid","order":"desc"}`。Polkadot 首条 #1780 为 2025-11-04，已知 #1970 有 2026-11-23 有效投票；Kusama 首条 #603 为 2025-10-07，#681 有 2026-11-24 投票。staging 同样错误 | `ReferendumVotesV2` 按 `block_num desc,id desc` 混排 Relay/Asset Hub；HTTP handler 对全局 feed 清空 sort，不能靠前端参数修复。后端应使用跨迁移可比较的时间顺序，并验证索引/查询计划。不要在前端重排当前一页冒充全量最新列表 |
| F05 | Polkadot 预映像 `0xea508ce4278cfc5ced4d74754b46ce3c643c30b77d5ebf7835570f7f1667d598`，API 多次为 Requested；finalized #23,576,979 为 Unrequested，ticket=4,011,200,000、len=48 | 索引 status 滞后。需排查 Requested→Unrequested 同步并修复历史记录。作者和押金字段相符，不将它们与状态验收混为一项 |
| F06 | child `status=active` 首屏 Polkadot 18/20、Kusama 20/20 条的最新时间线为 Cancel/Claimed，列表仍为 Awarded。Polkadot #11-94 在 finalized #23,577,060、Kusama #20-583 在 #24,245,565 的 child storage 都不存在 | 状态过滤参数已生效，但被过滤的索引状态不可靠。子赏金筛选接入试验已撤回，保留现有阻塞。须修复终态写入/历史数据，再核对 Active/History 集合和全量数量；不能据 API code=0 或集合数量相加就宣称通过 |

F04–F06 尚未在本轮修复。它们是 Subscan 数据/查询问题，不是需要用户重新手测的钱包问题。本轮未将其发布为新 GitHub issue，也未把旧 issue 中的历史结论覆盖成通过。

## 当前验收状态

当前人工验收待办为空；F04–F06 仍待上游修复。后续[主网条件样本复核](2026-11-25-conditional-mainnet-validation.md)已找到 B02–B05 的部分真实数据；剩余为实际交易验收条件。B07 是 Relay/Asset Hub 数据源错误，已修复并完成本地验收，待合并部署。

| 分类 | 当前状态及步骤 |
| --- | --- |
| H01/H02 真实钱包与设备 | 用户报告通过；本轮没有独立重复验证，不再列为待用户执行 |
| H03 公投评论 | **用户于 2026-11-25 确认已完成手测**，不再列为待人工验收。原签名、发表、回复、编辑、刷新持久化、删除及权限切换步骤保留在历史报告中作为回归参考；不冒充本轮逐项独立重测。Community comments 数据由 DeGov GraphQL 存储，签名用于认证，不是链上交易；外部论坛只读内容由 Subscan 索引 |
| B02 实际退款/获胜 conviction 到期 | 自有 #160 仍 deciding，submission 10 PAS、decision 1 PAS 仍持有；没有适用自有终态和获胜到期样本。有条件后可自动核对回执、余额和 UI |
| B03 Requested preimage 退 ticket 保留 bytes | 自有预映像仍 Unrequested、39 bytes、ticket 0.40103 PAS；缺少带自有 ticket 的 Requested 样本 |
| B04 payout/checkStatus/目的端到账 | Paseo treasury spendCount=0，无受控可支付记录；不能用源链成功替代目的端到账 |
| B05 特权模板执行 | 缺少治理/白名单执行权限及有效目标；编码/预览已有自动验证，不代表执行通过 |
| B07 非空历史 tips | 更正：Relay Chain 有 Polkadot 593 / Kusama 807 条；已修复误用 Asset Hub 的请求与详情链接，首页/第二页/末页和链上 TipClosed 核对通过。待合并部署，详见条件样本复核 |

Paseo 本轮 finalized #16,194,926、治理 relay #2,091,853；测试账户 nonce=27、frozen=0，余额及押金保持此前状态。B02–B05 实际交易条件满足后优先自动测，无需把这些依赖转成用户“所有功能再点一遍”的清单。搜索的官方当前契约支持编号/标题/地址/身份，不支持 preimage hash 检索；后者应列未实现能力，而非部署故障。
