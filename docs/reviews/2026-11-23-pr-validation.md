# 2026-11-23 SubGov PR review and validation

> 第一阶段记录：以下“仍需手动/未签名”描述的是专用 Paseo 账户获授权之前的验收状态，并非这些交易只能人工完成。后续已使用用户授权的测试账户自动签名真实交易，并核对浏览器 UI；最新结果和剩余边界见 [Paseo transaction and UI validation](2026-11-23-paseo-ui-validation.md)。本阶段修复 PR #129 已由外部合并，非本次代理执行合并。

范围：按 Asia/Shanghai 日期检查今天更新的 #121–#128，共 8 个 PR，均已合并；其中 #124、#126、#127 经堆叠分支进入 main。审查基线为 `b325b711078ea63c3642be5db9625be1194d48e8`。修复在独立 worktree / `codex/subgov-review-20261123`，不改变已部署版本。

## 结论与手动验收

现有 CI 通过不等于这些新功能已经完成验收。只读显示、数据契约、交易构造和异步状态可自动检查；真实钱包授权、签名后的最终状态和移动钱包环境仍需人工。以下按功能合并验证，避免逐 PR 重复操作。

| PR | 已自动验证 | 仍需手动验证 / 阻塞 |
| --- | --- | --- |
| [#121](https://github.com/subscan-explorer/subgov/pull/121) 投票与委托 | Standard / Split / SplitAbstain 构造、精度及余额边界、取消/替换委托、最终性与失败路径回归；三条链元数据编码 | **必要**：Paseo 用小额测试余额完成三种投票及改投；做一次委托→替换→取消，确认链上委托与锁定余额。批量取消需有至少两轨委托。 |
| [#128](https://github.com/subscan-explorer/subgov/pull/128) 实时 tally | 真实 RPC tally 读取；切链/切公投隔离、乱序响应、结束状态、SS58 去重和分页计数回归 | 与 #121 **同一笔改投合并验收**：InBlock / Finalized 后无需强刷，投票权重、原始 support 和本人列表正确；刷新后仍正确。 |
| [#122](https://github.com/subscan-explorer/subgov/pull/122) My votes / unlock / deposits | 锁期计算、可退款归属和签名前复查、removeVote/unlock/refund 编码、真实账户存储读取 | **必要**：Paseo 找已结束且可解锁投票，执行移票+解锁并核对余额；用可退 submission / decision deposit 各验证一次退款。没有合适记录时保持未验收。 |
| [#123](https://github.com/subscan-explorer/subgov/pull/123) tracks / statistics / whales / DV | 映射、缺字段、空状态；staging 统计页待后端提示；不把缺失 active_count 当 0 | **无须专门手动签名**。新统计等依赖后端的模块仍未完成数据验收，需接口上线后做 API 与页面对照，不能因页面能打开就视为完成。 |
| [#124](https://github.com/subscan-explorer/subgov/pull/124) call / preimages | 嵌套调用树、真实元数据编码；预映像 ticket 归属、已退款/不存在、requested / unrequested 回归 | **必要**：Paseo 用自己的测试预映像 unnote，确认押金释放。若预映像仍被请求，字节应保留；未请求时可移除。账户预映像筛选待后端。 |
| [#125](https://github.com/subscan-explorer/subgov/pull/125) treasury / bounties / calendar | 三条链余额/资产元数据/多资产赏金读取；payout/checkStatus 构造及到期边界；子赏金跨页、受益人和日期异常；本地浏览器路径验证 | **必要**：有合适的 Paseo spend 时，验证 payout→支付结果→checkStatus。XCM 支付发起成功不代表受益人到账；需核对目的端。没有可用测试记录则待验，不应为了测试触发主网付款。事件日历等仍待后端。 |
| [#126](https://github.com/subscan-explorer/subgov/pull/126) DeGov | 实时 schema introspection：评论编辑/删除存在；其他可选字段缺失时关闭；缓存身份/切链/watch-only 回归 | **必要**：以自己的测试评论完成消息签名→编辑→删除，验证回复保留与复制锚点重开。未创建或修改线上评论。帖子、反应、投票、公告等未开放能力不能验收。 |
| [#127](https://github.com/subscan-explorer/subgov/pull/127) wallets / proxy / search | injected 检测函数；真实 React 账户切换与断连；proxy 权限复查、明确类型及内部失败处理；watch-only 禁用交易；键盘编号跳转保留链 | **必要**：SubWallet、Nova 内置浏览器、Mimir 各连接/恢复一次并验证 Paseo 签名；Governance proxy 投一票，链上 voter 应是 real，手续费由 signer 支付。watch-only、搜索基本流程已自动跑，不需重复。 |

建议按四组做：①投票/委托/tally；②解锁/退款/unnote；③钱包兼容性与代理；④DeGov。Treasury payout 另待合适的测试 spend。每组记录网络、账户角色、交易 hash、Finalized 及预期状态；测试金额尽量小且使用 Paseo。

## 已修复的问题

1. **P1 — 跨链资产误标和精度错误（#125）**。硬编码 `1337 = USDC / 6 decimals`，但 Kusama AH 实际是 TIP / 10 decimals；Kusama 多资产赏金的跨共识 DOT 因没有 GeneralIndex 被误当作 KSM / 12 decimals。现按完整 location 区分本地与外部资产，通过 `assets.metadata` / `foreignAssets.metadata` 读取符号和精度。未知或远端未解析资产明确显示 base units，不猜测币种。链上复查已确认修复。
2. **P1 — 代理选择和身份残留（#127）**。切换 signer/chain 或断连时，旧 proxy 曾可能继续作为当前账户。现按 signer+chain 同步隔离；签名前重新读取权限并指定零延迟、支持治理的 proxy type。原先 `force_proxy_type = None` 会让 runtime 选择第一条匹配 delegate 的权限，可能选中延迟或不支持治理的权限。代理投票也不再从 real 的投票余额扣除 signer 应付的手续费。
3. **P1 — watch-only 可能复用讨论登录（#126/#127）**。现有缓存 token 在切换为只读模式后不可用于修改内容；校验当前 signer、链与 canSign，并在异步认证各阶段防止旧账户结果写回。编辑/删除及通用交易按钮同时禁用只读操作。
4. **P2 — 实时票数串公投/串链及计数错误（#128）**。隔离读取作用域、丢弃旧/乱序响应、清除已结束公投的 ongoing tally，SS58 等价地址替换不重复添加。只加载一页时不再推断总票数应 +1。账户投票组件也按链/账户重挂载。
5. **P2 — 子赏金详情不可用（#125）**。真实 Subscan 返回 `index: "31-218"`，原页面生成 `/undefined/31-218/`；受益人还藏在旧接口的 proposer 字段中。现解析复合 ID、兼容字段、分页查找详情，并为父赏金增加分页。staging 已复现旧链接；本地契约 fixture 已验证第二页详情与受益人。查找超过 50 页明确报受限，不伪报不存在。
6. **P2 — 不支持的筛选与缺失计数被当成有效结果（#123/#124/#125）**。当前 Subscan 后端忽略 preimage `account` 和 child bounty `status`；parent #0 还会变成全局查询。现明确显示待支持，避免展示错误归属的数据。缺失 active_count 保持未知，不再显示“没有进行中的公投”。这些限制需后端支持后才能开放。
7. **P2 — 支出到期和预映像退款校验（#124/#125）**。`checkStatus` 要求超过 expiry，而 payout 必须在 expiry 之前；等于 expiry 时不展示错误操作。签名前重读 spend 状态。unnote 也重读链上 deposit ticket，拒绝错误账户、已退款和不存在的预映像；说明文字明确 requested preimage 退款后仍保留字节。
8. **P2 — 日历异常日期及跨月查询（#125）**。拒绝 `2026-99-99`、非闰年 2/29 等，避免格式化异常；点击相邻月份日期时同时更新查询月份。
9. **P2 — 其他状态与覆盖缺口**。不支持 multiAssetBounties 时显示明确结果，避免无限 loading；国库读取按链/记录隔离。CI 移除只运行 main 目标 PR 的限制，使堆叠 PR 也执行检查。新增回归纳入默认 `pnpm test`。

## 自动验证证据与边界

- Node 24.22.1 / pnpm 11.24.0；`pnpm lint`、`pnpm typecheck`、全部 9 组 `pnpm test`、`pnpm build` 通过。React renderer 提示弃用，但无失败；测试用于真实 hooks 的异步状态回归。
- 将新增 client-state 回归复制到隔离的旧基线运行，切换公投后的 live 状态断言失败；修复版本通过，确认测试能检测原缺陷。
- `pnpm test:proposal` 通过：真实 Paseo 提案准备，无签名/广播。
- `pnpm test:governance-rpc` 通过：每条链验证 genesis、编码 15 个调用/组合、读取治理与国库存储。运行时版本：Polkadot AH 2005003、Kusama AH 2005001、Paseo AH 2005006。抽样时最新公投分别 1973 / 680 / 159，多资产赏金分别 4 / 2 / 0。这些是抽样读取，不是所有记录扫描，也不证明 dispatch 成功。
- 实时 Kusama 元数据核对：local asset 1337 为 TIP / 10，1984 为 USDt / 6；两个多资产赏金使用 foreignAssets 注册的 DOT / 10。Polkadot 和 Paseo 的 1337 为 USDC / 6。
- staging 只读浏览复现子赏金错误 URL、首页活动计数错误，并确认统计页明确待后端。本地无 Subscan API key，直接公共 API 请求被拒；没有把鉴权失败当成接口缺失。
- 修复后的生产构建在本地运行，使用明确的合成 Subscan 契约数据验证：子赏金第二页→详情、父赏金第二页、受益人；观察地址模式下 Unnote 禁用；非法日期不崩溃、跨月日期导航；搜索 151 按 Enter 跳到正确网络公投。fixture 验证不替代部署后真实数据验收。
- DeGov 实时 introspection 确认 `updateDiscussionComment` / `deleteDiscussionComment` 及当前 input 字段；帖子、reactions、polls、announcements、referendumContent、commentsByAuthor 等可选能力尚未开放。未发送签名消息或内容 mutation。
- 本次没有签名、广播链上交易、部署、合并修复 PR，也未声称生产验收完成。

## 契约依据与剩余边界

- 当前 Subscan owning source：`internal/service/scan/governance.go` 的 ChildBounties、`internal/server/http/governance.go` 的 child 参数、`internal/server/http/preimage.go` 的 list 参数、`libs/substrate/storage/default.go` 的 track 字段；结合 staging 返回形态交叉核对。
- Runtime 规则参考：[pallet-proxy](https://github.com/paritytech/polkadot-sdk/blob/master/substrate/frame/proxy/src/lib.rs)、[pallet-treasury](https://github.com/paritytech/polkadot-sdk/blob/master/substrate/frame/treasury/src/lib.rs)、[pallet-preimage](https://github.com/paritytech/polkadot-sdk/blob/master/substrate/frame/preimage/src/lib.rs)。公开 master 源码不是各部署 runtime 的逐字证明；实际网络元数据/存储读取已补充，但最终执行语义仍以测试交易为准。
- Treasury 概览目前除原生资产外只抽取 1337 / 1984 这两个候选本地资产，现显示它们的真实元数据；这不是完整跨链资产盘点。多资产赏金按自身 location 解析。
- 子赏金详情暂时通过列表分页查找；更旧记录超过上限时仍需 Subscan 查看或后端提供单条详情接口。
- 后端依赖项与真实钱包流程是剩余验收工作，不应把它们勾为已完成。
