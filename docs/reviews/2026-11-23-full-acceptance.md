# SubGov 全功能验收清单与手动测试方案（2026-11-23）

> 范围更新：DV 与未上线讨论功能已按用户要求移除，公投评论保留；F03 作为历史问题暂不纳入验收，Polkadot/Kusama 新接口按待部署处理。以下保留当时的测试记录，当前结论以 [2026-11-24 范围更新](2026-11-24-scope-update.md) 为准。

> **2026-11-24 更新：** 当前自动补测、修复、人工项目及阻塞结论以 [自动补测收口报告](2026-11-24-automatic-follow-up.md) 为准。下列 M 用例保留为详细复验步骤，不能再将其中已自动完成的项目统称为待手测。

本清单覆盖当前 `src/app/**/page.tsx` 的 **45 个页面路由**，以及共享的钱包、代理、搜索、网络切换、交易和讨论组件。**覆盖清单完整不代表全部验收通过。** 页面打开、构造交易、最终上链、UI 数据准确、真实钱包兼容是不同层级；下表刻意保留未完成项。

本次自动验证的真实交易、修复和资金清理见 [交易与 UI 报告](2026-11-23-paseo-ui-validation.md)；[30 笔 finalized 回执](2026-11-23-paseo-receipts.json)可复核。第一批修复 #129 已合并；本次后续修复在独立 PR 中，尚未作为部署后验收通过。

## 状态定义与执行顺序

- **自动通过**：只对描述的具体场景有自动证据。
- **部分通过**：已有代码/运行时/页面或代表性数据证据；未覆盖的交互、状态或数据分支仍需执行对应 M 用例。
- **条件阻塞**：缺少后端接口、适用记录或 runtime 状态；人工也不能直接验收，应先满足条件。
- **待人工**：缺少真实钱包/设备/环境，或需用户授权发布测试内容。
- **待部署复验**：本地修复及回归通过，不等于 staging/生产已使用该修复。

优先执行：M01 钱包与身份 → M03 投票、M04 委托代理 → M02 修复后页面 → M05/M06 退款与预映像 → M07 国库支付。M10/M11 先补齐后端，再验业务。M09、M12、M13 可独立做只读检查。所有写链测试只在 Paseo，主网仅只读。

建议验收记录字段：用例 ID、版本/commit、环境 URL、网络及 genesis、签名者/实际账户、输入、交易 hash、finalized block、链上原始值、UI 显示值、刷新前后截图、结果/阻塞原因。测试地址、hash、截图可以保存；不记录助记词、私钥、登录 token。

## 全部页面覆盖矩阵

| ID | 路由 | 功能与已完成证据 | 当前结论 / 剩余用例 |
| --- | --- | --- | --- |
| R01 | `/` | 首页、编号跳转、活动数/批准率/国库/待办；staging 浏览及初阶段搜索测试 | 自动路径通过；修复待部署 B06，索引统计 B01 |
| R02 | `/account/deposits` | 查询 #160 明确无可退押金，索引缺失有提示；提前退款 guard 通过 | 退款 guard 通过；实际退款 B02、索引 B01 |
| R03 | `/account` | 测试地址、网络、watch-only 账户识别；错误 signing 文案已修 | watch-only 自动通过；真实钱包/代理 H01 |
| R04 | `/account/votes` | Aye/Split/Abstain、本金/锁定/可解锁及撤票后 0 均对链 | 投票/锁/历史无后续锁自动通过；真实到期 B02，钱包 H01 |
| R05 | `/calendar` | 月视图、非法日期、跨月导航回归 | 日历布局/日期自动通过；真实事件 B01 |
| R06 | `/delegation/[address]` | 委托数据映射、链上读取、目录关联 | 非空目录/详情/received 自动对账；钱包 H01 |
| R07 | `/delegation/mine` | 1.5 PAS/0.1x/目标地址及取消后无委托，UI 与链一致 | 交易及数据自动通过；真实钱包 H01 |
| R08 | `/delegation/mine/received` | 收到的票权/本金读取及索引契约检查 | 非空 received、失败/切人隔离自动通过；索引依赖 B01 |
| R09 | `/delegation` | 真实目录、余额、跳转；watch-only 文案修复 | 目录/详情/普通委托自动通过；钱包 H01，完整搜索 B01 |
| R10 | `/delegation/statistics` | staging 正确显示待数据服务 | 条件阻塞 B01 |
| R11 | `/discussions` | 能力探测、缺失能力提示 | 条件阻塞 B01/H03 |
| R12 | `/fellowship` | Paseo 不支持提示；Polkadot 显示成员和来源统计 | 成员对账通过；索引计数验收失败 F01 |
| R13 | `/fellowship/referenda/[id]` | Polkadot #682 的调用、origin、押金、时间线浏览 | Executed/Timeout 详情和 Collectives 链接自动通过；旧索引 F01 |
| R14 | `/fellowship/referenda` | Polkadot 列表 683 条、页码和轨道选项；Paseo 不支持路径 | 分页/编号自动通过；轨道过滤已修待部署 B06，索引 F01 |
| R15 | `/fellowship/tracks` | Polkadot 轨道/区块周期/押金；Paseo 不支持提示 | 周期/参数自动对账；deciding 聚合 F01 |
| R16 | `/posts/[id]` | schema 能力不足时关闭，不构造不存在的帖子 ID 验收 | 条件阻塞 B01 |
| R17 | `/posts/create` | staging 最终显示 Creating discussion posts 未部署 | 条件阻塞 B01 |
| R18 | `/posts` | 帖子列表能力探测，与 discussions 共用组件 | 条件阻塞 B01 |
| R19 | `/preimages` | 自有 remark Cleared 且不可解码；恢复的 39-byte 提案可正确解码；owner guard | note/unnote/解码及 guard 自动通过；Requested B03、过滤 B01 |
| R20 | `/referenda/[id]` | #160 投票/tally/Call/Metadata/押金；修复列表延迟、状态、周期、弃权/时间口径 | 实时字段/交易/表单回归通过；钱包 H01、评论 H03、部署 B06 |
| R21 | `/referenda/dv/cohorts/[id]` | 路由/契约审查，无有效可用 cohort fixture 的真实业务验收 | 条件阻塞 B01 |
| R22 | `/referenda/dv` | staging 明确 DV cohorts 待接口 | 条件阻塞 B01 |
| R23 | `/referenda/new` | 9 个模板在 Paseo 真实元数据下构造及 staging UI 预览通过；watch-only 均禁止签名；native treasury 实际提交 #160 | 9 模板构造和预览、31 非法输入自动通过；执行 B05，钱包 H01 |
| R24 | `/referenda` | 真实列表、状态/分页映射、编号解析；既有回归通过 | 全部现有状态按钮、三页唯一记录、编号/页码自动通过 |
| R25 | `/referenda/statistics` | overall/month/track 的缺失接口提示 | 条件阻塞 B01 |
| R26 | `/referenda/tracks/[id]` | #30 参数、曲线、活动公投浏览；治理时钟修复 | 参数/曲线回归通过；修复部署 B06，完整聚合 B01 |
| R27 | `/referenda/tracks` | 轨道映射、缺失 active_count 不当 0；时钟修复 | 轨道/周期自动通过；完整聚合 B01 |
| R28 | `/referenda/whales` | staging 未部署提示，不把无数据当零大户 | 条件阻塞 B01 |
| R29 | `/settings` | 填测试值→Previewed→明确未保存→刷新后清空 | Preview 自动通过；真实保存/邮件通知未实现 |
| R30 | `/treasury/bounties/[id]` | Paseo #31 金额10 PAS、角色、时间线、无子赏金；契约测试 | 代表性详情/子赏金及跨页自动通过；上游状态 F02 |
| R31 | `/treasury/bounties` | Paseo 实际列表35条/2页与状态；金额映射 | 分页通过；Active 筛选数据验收失败 F02 |
| R32 | `/treasury/burns` | staging 明确未部署 | 条件阻塞 B01 |
| R33 | `/treasury/child-bounties/[parent]/[index]` | Polkadot #31-218 正确进入详情：500 DOT、受益人；本地跨页回归 | 真实复合 ID 与跨页/50页/错误回归通过 |
| R34 | `/treasury/child-bounties` | Polkadot 真实复合 ID/受益人；Paseo 空状态；分页修复 | 真实列表/分页/错误回归通过；status/parent0 后端 B01 |
| R35 | `/treasury/multiasset-bounties/[id]` | Kusama #1 显示 foreign DOT、金额及 curator；三链 RPC | Kusama #2 三个非空子赏金与原始金额自动对账通过 |
| R36 | `/treasury/multiasset-bounties` | Kusama 两条均为 DOT，符号精度与元数据一致；Paseo 链上为空 | 三链读取/资产精度自动通过；二进制描述修复待部署 B06 |
| R37 | `/treasury` | 三链余额/1337/1984 元数据 RPC；最近五条统计范围文案已修 | 三链 UI 余额对账通过；Paseo 周期异常 F03，修复待部署 B06 |
| R38 | `/treasury/projects` | 重定向 Bounties 并保留 chain | 自动通过 |
| R39 | `/treasury/proposals` | Paseo 历史4条，金额/受益人/状态正常渲染 | 非空历史列表/共享分页回归通过 |
| R40 | `/treasury/spends/[id]` | Polkadot #285：4800 USDC，尚未 validFrom，无付款按钮；到期边界回归 | 只读状态及 guard 通过；真实支付 B04 |
| R41 | `/treasury/spends` | Paseo 无记录，Polkadot 有5页及多资产金额 | 首尾分页/金额样本通过；真实支付 B04 |
| R42 | `/treasury/tips` | Paseo 空状态正确；只读历史组件审查 | 空状态/映射回归通过；非空真实样本 B07 |
| R43 | `/user/[address]` | profile/identity/SS58/公开 tab 代码回归；与本人票据复用读取 | 五 tab/非空 received/数据隔离自动通过；评论 B01/H03 |
| R44 | `/votes` | side/track 控件及 #98 缺失提示 | 控件/缺服务提示通过；全网投票数据 B01 |
| R45 | `/whitelist` | Paseo 当前为空的链上 UI；preimage 解码已有自动验证 | 非空 hash/缺失 bytes/空状态/切链隔离通过；dispatch B05 |

45 条仅是页面目录；下列 M01、M13 还覆盖所有页面共用的全局交互。没有用不存在的后台记录假造帖子、DV cohort 或可退款押金来宣称成功。

## M01 — 钱包、切链、账户、代理环境（待人工，P1）

前置：在 Paseo 有测试币的专用钱包；SubWallet 扩展、Nova 内置浏览器、Mimir、WalletConnect 各需对应环境。自动化账户的密钥在本机 Keychain，无需在聊天中发送。可用自己的独立测试钱包进行兼容性验收。

1. 每种钱包分别连接→选择账户→刷新恢复→断开→重新连接，确认地址、链名、token、钱包来源正确；断开后交易/编辑/删除不能继续使用旧身份。
2. 连接 Paseo 后切 Polkadot/Kusama，只验证只读界面和连接提示，再切回 Paseo。签名 payload 的 genesis 必须为 Paseo Asset Hub；不得误用 Relay Chain 或上一次网络。
3. 新开无钱包的浏览器，用 Watch-only 地址进入详情、账户、委托、评论；写操作应禁用或明确要求连接签名钱包，不能沿用旧讨论 token。
4. 用测试钱包对 #160 提交一笔小额无 conviction 投票，检查钱包显示的调用、网络、账户与 UI 一致，完成后按 M03 清理。拒绝一次签名，应该保留输入、显示可恢复的拒绝结果，不出现 Finalized。
5. Mimir 额外核对实际 multisig/proxy 账户与 signer 的区分；Nova 验证返回 DApp、刷新和恢复；WalletConnect 验证断连、错误链、二维码过期后重连。

证据：每个钱包的版本/平台、连接截图、拒签截图、一次有效 Paseo tx、刷新后 UI。自动 signer 通过不能代替此项。

## M02 — 九种提案模板、预览与修复后详情（部分自动，P1）

前置：部署本次修复到可访问环境；一笔只读核对可使用 #160。默认不新增治理提案，先完成 unsigned preview。

1. 在 New proposal 逐个选择：Native treasury、USDx、Batch treasury、Multi-asset bounty、Remark、Cancel、Kill、New preimage、Existing preimage。
2. 填入合法样例并 Preview：核对函数名、内层 batch 顺序、资产 ID/decimals、收款人或 curator、origin、encoded bytes/hash/length、enactment。Existing preimage 用 #160 的 `0x6ec548af963080dde0364fcf0ea85e720b7b9577bd11cd0bf2cba148f1081d1d`、39 bytes。
3. 分别输入空值、非法地址、负数、超过精度金额、超 track 上限、错误 origin、错误 hash/length。错误必须在签名前显示；切换模板/链后旧 preview 必须失效。Batch 添加/删除/改顺序，验证预览随之变化。
4. 需要实际提交时只创建一笔自有 SmallTipper 小额提案。自动化已完成 native treasury 提交；其它模板的实际提交/执行不能仅凭构造成功判定。Cancel/Kill 的执行会影响目标公投及押金，只能针对明确可丢弃的自有测试记录。
5. #160 详情刷新后检查 Deciding、1 PAS decision deposit、10 PAS submission deposit、39-byte call、10-block enactment；Decision period 约7天，confirm约10分钟，不能再显示2.4天/3分钟。两个面板必须一致，不能再次出现 Place decision deposit。
6. 查看 Call/Metadata/Proposal/Votes 并复制直链重开；切链/换公投不能闪回旧 tally、旧状态或旧押金。已执行记录不能被链上 Approved 存储降级显示为仅 Approved。

证据：9种 preview/错误样例检查表、修复前后截图、实际提交若有则附 tx 与 referendum ID。九种构造和 UI 正常输入预览已通过，并验证切模板/编辑使旧预览失效；模板 execution 需治理权限与周期，仍是条件项。

## M03 — 投票、页面实时变化、移票与锁（链上已自动，钱包 UI 待人工，P1）

前置：自有测试账户，#160 仍 ongoing；初始无委托，记录初始 tally 和锁。如果有其他人投票，应比对本次增量而非照抄绝对数。

1. Aye 1.25 PAS、2x：本人票本金1.25、权重2.5、support增加1.25。签名中→广播→InBlock→Finalized 每一步文案准确；不要手动刷新，先确认页面实时变化，再刷新复核。
2. 改为 Split Aye0.3/Nay0.2：权重0.03/0.02，support贡献0.3。旧锁仍可能是1.25，可解锁0.75，不能把余额0.5误写为已锁0.5。
3. 改为 SplitAbstain Aye0.2/Nay0.1/Abstain0.7：权重0.02/0.01，support贡献0.9。弃权列为 Support only；列表合计不得冒充全网弃权总额；未有投票时间时显示未知。
4. 改为 Nay 1 PAS、0.1x：本人 Nay 权重0.1、support贡献0。索引未追上时，自己的实时票仍应出现，索引总数标明可能延迟。
5. Remove + Unlock：等待 finalized，My votes 数量、锁和可解锁均回到基线；tally 减去本人贡献。浏览器重开仍一致。
6. 测试拒签、可用余额不足、重复点击和切换账户后旧交易回调；不得重复签名、错误成功或串账户数据。不要为制造错误在主网操作。

已结束但 conviction 尚未到期的获胜票不能通过此 ongoing 样例覆盖；转 M05。自动交易及 reload UI 已通过1–5的主要数据，浏览器签名事件驱动的即时刷新仍需本项。

## M04 — 委托、替换、批量取消与 Governance proxy（部分自动，P1）

1. 账户 A 在轨道30委托1.5 PAS/0.1x给测试账户B：My delegations 应显示目标B、轨道、金额与conviction；B的 Received delegations 应显示相应原始本金和加权权重。
2. 替换目标为C/金额2 PAS，确认B减少、C增加，A只保留一条。轨道31再委托0.5，使用批量取消；两轨都清空，Unlock后锁为0。对比本人、目标公开profile及索引列表，索引滞后要明确。
3. B添加A为零延迟 Governance proxy，钱包UI选择“代表B”；投票后链上 voter和列表是B，手续费由A承担。操作完成取消B的票、解锁，再删除代理权限。
4. 切换 signer/chain 或断开时旧 proxy 立即失效。使用已撤销权限、延迟代理或非治理权限时，签名前应失败，不应尝试用其他权限发送。

自动链上测试已覆盖替换、两轨批量取消、代理全余额投票及内层结果；本次 UI 逐值核对覆盖普通委托/取消。剩余为真实钱包代理选择、非空接收列表和这些批量动作的 UI。

## M05 — 已结束投票与押金退款（条件阻塞，P1）

前置：#160结束，或提供另一个归属明确、已结束且仍有可退deposit的Paseo记录。没有该状态时标 BLOCKED，不尝试将ongoing伪装成可退。

1. 对一个已结束的获胜 Standard conviction 票，核对锁到期区块/剩余时间；到期前不能显示可解锁，到期后执行removeVote/unlock，余额变化扣除手续费后匹配，UI刷新后清除。
2. 查询submission和decision deposit，分别核对归属、金额与可退状态。各退一次；资金返回原depositor，而不一定是提交退款的人。
3. 第二次退款、错误账户认领、ongoing记录应在签名前拒绝。退款后按钮消失、列表标已退、reserved按准确金额减少。
4. #160当前预留11 PAS公投押金，尚不可退；另有0.40103 PAS预映像ticket，不能与公投押金混为一笔。

## M06 — 预映像与白名单（部分自动，P1/P2）

1. 独立备注preimage：note→列表/owner/length/hash/解码→unnote→ticket释放、字节不可读；已自动完成。
2. 找到自有、真实 `Requested` 且有ticket的预映像：unnote后ticket应清除而bytes继续存在；owner之外不能退款。**Lookup referendum本身不保证Requested**，本次误设前提已纠正，未将其计为通过。
3. 对错误长度、未存储hash、迁移后不能用当前metadata解码的记录，页面显示明确原因、不崩溃、不伪称已解码。
4. 白名单在有记录网络核对call hash与链存储，展开解码并跟随Whitelisted Caller链接；dispatch后重新读取应移除。Paseo当前只有空状态证据。
5. 账户预映像过滤需#100支持后测试；目前提示缺失是正确行为。

## M07 — 国库 payout / checkStatus 与跨链到账（条件阻塞，P1）

前置：一个已批准、可支付、beneficiary为受控测试账户的Paseo `treasury.spends`，记录目的链/资产。不要使用主网 #285 作为付款实验；它只做只读“尚未validFrom”验证。

1. 原始存储与UI逐项对照asset location、symbol、decimals、amount、beneficiary、validFrom、expireAt和当前治理区块。
2. validFrom之前不显示Pay；到期边界不错误允许payout或过早checkStatus。可支付时提交payout，最终事件成功后读取支付状态。
3. 如果是XCM，必须查目的链接收事件和beneficiary余额增量；源端extrinsic成功并不等于到账。
4. 到允许的状态调用checkStatus，核对成功/失败的状态更新、押金释放或可重试行为。重复提交或状态在签名前变化应被拦截。

没有可控spend/目的端证据，本项保持BLOCKED。创建spend所需治理通过无法在本轮凭普通测试账户完成。

## M08 — 公开个人页、身份与受托数据（部分通过，P2）

1. 测试账户、另一个有identity账户、无活动账户各检查Overview/Votes/Delegations/Deposits/Comments五个tab；直链重开、前进后退应保留chain/tab。
2. 比对余额单位、身份、SS58等价地址；更换profile或网络时不能显示前一个人的锁/委托/评论。
3. 对非空Received delegations，逐轨比较链上capital/votes，并与Subscan列表核对委托人；列表和总额缺失时不能显示假零。
4. 访问他人profile不应显示自己的改投/编辑权限；任何人可触发的退款必须明确资金仍退给原depositor。
5. Comments by author、delegate announcement的能力未部署时保持提示；开放后并入M11。

## M09 — 全部只读列表、分页、统计口径与资产（部分通过，P2）

覆盖：首页、referenda/tracks、delegates、treasury/spends/bounties/children/multiasset、legacy proposals/tips、public profile。

1. 在Polkadot/Kusama/Paseo各选非空和空样例，比较API或链上原始字段→UI；金额用精确decimals换算，时间用UTC；缺值应是未知，不是0。Kusama local1337是TIP/10，foreign DOT是10decimals，不能当作USDC/6或KSM/12。
2. 首/中/末页、无效页、page=0/负数、筛选后总页数减少；无重复/遗漏，返回按钮和URL保留chain、track、status。缺少后端支持的status或parent0筛选应明确禁用/提示。
3. 子赏金 #31-218 进入parent31/child218；第一页以外记录可查，超50页搜索上限显示受限而非不存在；parent页分页及beneficiary正确。
4. 首页/国库计数标明样本或全量；最近5条不能声称所有treasury deciding；approval数据存在不能推断实际有投票。
5. 曲线开头/中间/末尾、0/100%、空tally、极大余额、小额和未知资产；图表与表格使用相同单位，弃权支持与Aye/Nay票权明确分开。
6. 失败接口/RPC断开后应显示错误并能重试；不能把请求失败归类为不存在或无记录。主网所有这类检查只读。

当前自动证据为代表性样本和契约/边界测试，不是对全量历史数据的扫描。

## M10 — 后端依赖功能（条件阻塞，P2）

| 条件 | 开放后必须验证 |
| --- | --- |
| #90 deposits index | owner、submission/decision、refund状态、金额、分页；与M05链存储一致 |
| #91 track aggregates | active_count/全部outcomes、未知值；sum与全量查询对应 |
| #94 nested votes/statistics/tags | direct与delegated去重、按conviction统计、bubble/nested/statistics一致；弃权口径 |
| #95 referendum statistics | submission/final-outcome两种时间口径、UTC月边界、每轨和overall分母/分子 |
| #96 whale votes | active/history范围、权重排序、委托合并、分页 |
| #97 DV cohorts | cohort→detail→delegate、period、资金/委托额、统计及空cohort |
| #98 global vote feed | Aye/Nay/Abstain、track筛选、最新排序、UTC时间、分页 |
| #100 preimage fields/filter | account过滤确实生效、押金/owner/length、Requested和Cleared |
| #103 delegation statistics | track与全网总额、delegator/delegate人数、0/缺失区别 |
| #106 child filters | status及parent0不返回全局错误记录 |
| #108 burns | Treasury.Burnt事件、amount/decimals/区块、分页 |
| #119 calendar events | UTC日界线、跨月、事件类型过滤、estimated标记、详情跳转 |

先确认接口已部署且返回真实非空样本，再核对UI。人工打开提示页无法解除这些阻塞。

## M11 — 评论、回复、帖子和消息签名（待人工/条件阻塞，P1/P2）

前置：自己的测试身份和一条可公开的测试内容；本轮没有发布评论或帖子。链上测试授权不自动视为向公共讨论发送内容的授权。

1. 现有评论：消息签名登录→在自有#160贴一条明确QA评论→回复→编辑→复制锚点新页打开→删除自己的根评论。检查编辑内容持久化、回复保留、删除态与anchor正确；签名不是链上交易。
2. 切账户/切链/断连/watch-only后旧token不可编辑/删除；其他账户无作者权限。拒绝消息签名不会假装登录成功。
3. 有能力后才测posts列表/create/detail/edit/delete、tags、poll单选/多选、结束时间、重复投票/改票、reactions；各在刷新后核对服务端持久化，不能以乐观UI认定成功。
4. 委托公告、referendum描述编辑、作者评论列表同样先确认schema能力。当前缺失的#101/#111/#112/#113相关功能保持BLOCKED。

## M12 — Fellowship（部分只读通过，P2）

1. Polkadot使用Collectives数据源，对overview成员数、active、voting/confirming与origins逐项对账；核对各轨道原始block周期和本链时间，不套Asset Hub的2秒。
2. 列表按track筛选、翻页、编号跳转；详情核对rank-weighted votes、普通counts、origin、call args、押金、preimage和timeline。
3. Subscan链接必须指向承载Fellowship的网络；覆盖一笔Executed及失败/结束记录。Paseo不支持页必须明确说明。

当前Fellowship功能是只读展示；不存在的Fellowship投票按钮不算待测功能。

## M13 — 全局导航、搜索、错误与设备（部分自动/待人工，P2）

1. 逐个导航入口、面包屑、返回、外链；`/treasury/projects`应保留chain重定向bounties。404和Data unavailable要可区分；无效地址/ID不能白屏。
2. ⌘K/键盘焦点、编号160、hash、地址；Enter正确跳转并保留网络。title search未开放时明确提示，不假装没结果。
3. 明/暗/跟随系统主题及刷新保持；长标题/长地址、水平表格、空/加载/错误状态。
4. 桌面Chrome/Safari、窄屏和Nova内置浏览器：检查导航抽屉、弹窗滚动、输入、按钮可达性、软键盘、wallet返回、焦点和Esc；本轮未覆盖真实移动设备，保留待人工。
5. Settings仅preview：输入值→Previewed和“未保存”→刷新清空。已自动通过；不得把未实现的email通知或profile持久化当作功能通过。

## 本轮结束条件与遗留

自动链上操作已经清理：无测试投票、委托、proxy和辅助账户余额；仅保留#160的公投押金和必需preimage，详细余额见回执报告。未等待约一周治理周期，也未触发主网写操作。

不能标“全部功能验收通过”，直到上述钱包/设备用例、所需runtime状态和后端能力齐备，并在实际部署commit上完成复验。可自动执行的测试已经保留为脚本/证据；其余不是默默跳过，而是逐条关联了前置条件、手动步骤和通过标准。
