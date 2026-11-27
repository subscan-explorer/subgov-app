# 条件测试主网样本复核（2026-11-25）

补充 [主网新接口验收](2026-11-25-mainnet-validation.md)。此前把 B02–B05/B07 全部概括为“缺少链上数据”不准确：**两网有大量只读样本；B07 是前端误用 Asset Hub 数据源，已修复并完成本地真实 API/UI 核对。剩余 B02–B05 是实际交易验收条件不足。**

本轮未签名、未提交主网/Paseo 交易、未修改线上数据库或部署。钱包、设备、公投评论继续记录为用户确认完成，不冒充自动重测。F03 按用户要求忽略；F04–F06 不因本轮有效样本而改为通过。

## 各类缺少什么、主网有什么

| 类别 | 缺少的实际测试条件 | Polkadot / Kusama 已核实数据 | 当前结论 |
| --- | --- | --- | --- |
| B02 公投退款、获胜 conviction 到期解锁 | Paseo 自有 #160 尚未终态；没有测试账户持有的、已到期的获胜 conviction 投票。需要在适用状态执行退款或清除投票/解锁，核对事件、押金/冻结余额变化及 UI | 两网当前终态可退押金扫描均为 0；Polkadot #1973 已退款可作为历史结果样本。选定公开投票账户分别有 7/4 条已到期获胜投票，Polkadot 另有 2 条尚未到期，均由 finalized storage 计算，非全链账户总数 | 有历史及到期样本，不能再说两网无数据；本轮未操作他人投票/资金，也未验证实际解锁后的余额和 UI |
| B03 Requested preimage 退 ticket 保留 bytes | 需要测试账户拥有 ticket 的 Requested 预映像，再执行 unnote，核对 ticket 退款、bytes 仍在及 UI 状态变化 | 链上 Requested 总数 94/6，其中带 ticket 为 36/4；各选 1 条核对 API、链上 ticket、bytes 与本地 UI 的作者、状态、长度和押金展示 | 只读样本通过；不是“退 ticket 后仍保留 bytes”的交易验收。API 的 Requested 全量计数不作为权威，F05 仍在 |
| B04 treasury payout/checkStatus/到账 | Paseo spendCount=0；需要有效支付窗口内、测试范围内的 spend，并跟踪付款到账和 checkStatus 清理 | 两网 API 索引 85/18 条；链上现存 spend 283/24 条，含 Pending 21/2 条，但快照时均未进入支付窗口。Polkadot #287、Kusama #25 已支付；#285/#26 尚未生效 | 已支付样本完成事件→API→UI 核对；pending 页面窗口提示正确。没有执行新的 payout/checkStatus；本次两个转账样本都是 Asset Hub 本地到账，不充当跨链目的端验收 |
| B05 特权治理模板执行 | 有效目标和满足 runtime 所需治理 origin 的执行入口；当前测试身份不能完成这些特权调用 | Polkadot 有 cancelled #1940、killed #203；Kusama 有 cancelled #600。当前 whitelist 为 1/0 个；Polkadot 该 hash 缺可解码 preimage（此前只读复核） | 可核对历史状态；编码/预览已有测试，特权执行与新执行后的 UI 仍不能宣称通过。Kusama 本次未找到 killed 样本 |
| B07 非空历史 Tips | 不再缺少条件 | Relay Chain 分别有 593/807 条，Asset Hub 为 0；已核对首页、第二页、末页，末页 13/7 行 | 前端修复：仅历史 tips 使用 Relay API 和 explorer，页面标明 Relay Chain；非空列表、金额、顺序、详情链接和分页已本地通过。尚未合并/部署，不代表线上已修复 |

refund/unlock 的可调用账户规则按具体 runtime 判断，不能笼统写成“必须原账户私钥”。`payout`/`checkStatus` 是普通签名调用，不要求 Root 或受益人签名；本轮保持主网只读。这里缺少的是可控测试目标及实际交易验收，而非要求用户提供主网私钥。

## 可复核样本

- Finalized 快照：Polkadot Asset Hub #23,579,467 / relay #34,028,498；Kusama Asset Hub #24,247,845 / relay #36,244,100。链状态和可用窗口会变化。
- B02：Polkadot 账户 `1bhEH21hmpfDUdBojqH2Buzt4haky2i3x1wWKFmw3wLjEnK`，#1954/1959/1956/1962/1955/1964/1966 已过获胜锁定期，#1971/1973 未到期。Kusama 账户 `H56ErZytjWzRtXLpBZEB3gcNm7k7HhVCvctYMzQHLRibtNP`，#531/536/603/533 已到期。使用 relay clock 与 voteLockingPeriod=100800 计算；本轮没有连接这些账户验证 My votes 的操作结果。
- B03 Polkadot：`0xe71e88e5c8a40cb70f9342e97cb342e1da3c35f664f4b040c44a3e5862b937a6`，12 bytes，ticket 0.40076 DOT，UI 按现有四位精度显示 0.4008 DOT。
- B03 Kusama：`0x92c3f9a6f07a447646735c4453263671ff2f77eb3eb3153f1967d15a882da4ea`，24 bytes，ticket 0.013362666624 KSM，UI 显示 0.0134 KSM。两者 bytes 均存在，API/链状态均 Requested。
- B04 Polkadot #287：`22229537-3` 同一 extrinsic 的 `assets.Transferred`、`treasury.Paid`、`system.ExtrinsicSuccess`，资产 1984、9,796.08 USDt，到账地址 `14WYWTADTSrmijwSxkzznCEz8TSSmkd1d9yBX1HFVUtipDUj`。UI 金额/受益人一致，状态区域提示 attempted 和 Check status；过期区块用当前链值 34,865,595，未误用旧索引值。
- B04 Kusama #25：`24034374-2` 的 `balances.Transfer`、`treasury.Paid`、`system.ExtrinsicSuccess`，4,834.6 KSM 到 `HRkTZWtCKJwDKRtrxzB2wjHthtJhvjps3vznyTRtBAnjQae`，UI 一致。#26 显示 payable from #36,590,765；Polkadot #285 显示 #37,165,333，都没有在未生效时提供 payout。
- B07 Polkadot tip `0x3204d30021076584d793073d2b95d5ce7618b850e4d81448ced6ff11b2e0348c`：Relay #15,759,917 的 `tips.TipClosed` 与 API beneficiary、12 DOT 一致。
- B07 Kusama tip `0x410a4f0a577cac54e6f5fec623f7c07602b0e9668375bd8c8c1922de79952692`：Relay #15,485,385 的 `tips.TipClosed` 与 API beneficiary、8 KSM 一致。

## 验证与剩余状态

新增 24 次只读 API 请求、两网 finalized storage 扫描和 4 个历史事件区块读取；12 条完成加载后的本地页面观察：6 个 Tips 分页、4 个 spend 详情、2 个 Requested 预映像作者页。Tips 校验逐行顺序、数量、金额和 Relay 详情链接，不只检查 HTTP 状态。读到了 Requested 的有效样本不代表 F05 的全量状态索引已经正确。

路由回归覆盖 Polkadot/Kusama 的 Subscan、PubFi、cluster 三种来源，保留当前 OpenGov、spends、burns 的 Asset Hub 路由以及 Paseo 原行为。`pnpm test:subscan`、typecheck、改动源文件 ESLint、生产构建和 diff whitespace 检查通过。

当前：**0 个待用户手测项（按用户确认）；4 类实际交易条件待补；B07 本地修复已验证、待合并部署；F04–F06 仍未修复。** B02–B05 满足测试条件后优先自动测试；本轮没有要求用户在主网代做影响资金/治理的操作。
