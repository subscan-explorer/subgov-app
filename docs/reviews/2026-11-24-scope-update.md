# SubGov 验收范围更新（2026-11-24）

> 最新状态见 [11 月 25 日主网补测](2026-11-25-mainnet-validation.md)：新接口已部署；F01 已复验通过；钱包/设备/公投评论均由用户确认已完成手测；当前无剩余人工验收项。[主网条件样本复核](2026-11-25-conditional-mainnet-validation.md)更正 B07：历史 Tips 在 Relay Chain，前端路由已本地修复；剩余 4 类实际交易条件待补。下文保留当时快照。

本记录更新 [自动补测清单](2026-11-24-automatic-follow-up.md) 和 [完整验收清单](2026-11-23-full-acceptance.md)。用户已明确确认：**移除未上线项，保留公投评论及回复**。旧报告中的路由数量和缺能力项目属于历史快照，不再直接代表当前范围。

## 本次移除

- DV 列表、cohort 详情及委托目录入口。
- 独立讨论、帖子列表、创建页、详情页，以及对应导航与快捷搜索入口。
- Poll、评论点赞/点踩及按点赞排序。
- 委托人公告、按作者聚合的个人页 Comments tab。
- 提案正文的站内编辑、附言和版本历史；保留索引提供的只读正文与来源。
- 上述功能的 GraphQL 查询、写入、能力探测和未使用的组件、类型、样例数据。

公投评论及回复、评论编辑/删除、排序、引用、提及、锚点和消息签名会话均保留。编辑/删除仍根据服务支持情况开放；基础评论读取不再等待可选能力探测完成。未执行公共评论写入或新链上交易。

## 本次验证

| 项目 | 结果 |
| --- | --- |
| 工程检查 | Node 24.22.1；lint、独立 typecheck、10 组默认测试及 production build 通过 |
| 公投正文和评论 | 本地生产构建使用明确标记的 Subscan/DeGov fixture：正文、3 条评论、父子回复关系正确显示；Newest 切换顺序正确；Reply 选中正确父评论，Cancel reply 清除目标 |
| 钱包权限 | 未连接钱包时输入和 Sign & post 禁用；既有自动测试继续覆盖 watch-only 会话不可写、账户隔离和签名权限。真实钱包消息签名和公共持久化仍属 H03 |
| 导航与委托 | 无 DV/Discussions 入口；委托目录、详情和收到的委托页面正常呈现，公告已移除 |
| 个人页和搜索 | 仅 Overview/Votes/Delegations/Deposits；旧 `tab=comments` 回退 Overview；搜索 discussions 不再推荐已删除页面 |
| 旧链接 | `/discussions/`、`/posts/`、`/posts/create/`、`/posts/old-post/`、`/referenda/dv/cohorts/1/` 返回 HTTP 404；`/referenda/dv/` 匹配动态 `[id]` 后呈现不存在页面，Next.js 流式响应为 HTTP 200，不误记为 HTTP 404 |

本地 fixture 用于验证移除范围及保留交互，不代表线上评论服务或主网新接口验收。生产构建的评论公开地址仅在本机验证命令中覆盖，未写入仓库或部署配置。

## 当前验收分类

| 项目 | 当前处理 |
| --- | --- |
| DV、独立讨论、Poll、点赞、公告、正文编辑、作者评论聚合 | 已移出产品和验收范围，不再作为后端阻塞或人工测试项 |
| F03 国库历史时钟 | 按用户要求暂时忽略；保留安全的 schedule unavailable 提示及历史修复说明。没有宣称已在线执行 sudo 修复 |
| Polkadot/Kusama 新接口 | 用户确认尚未部署。当前缺接口按待部署记录，不归类为新回归；部署后可继续自动做 API、链和 UI 对账 |
| F02 Active 赏金遗漏 | 11 月 24 日只读复查已验证 Paseo API 和 staging 两页的 35 个唯一 ID 一致，#32/#31/#7/#5 已恢复 |
| F01 Fellowship 历史终态 | 上一轮只读复查仍不一致：API/UI Voting=8、Confirming=3，Collectives 链为 ongoing=5、confirming=0；11 条旧 active 记录在链上已终态。保留上游数据修复后的复验，不因本次范围调整改为通过 |
| 两处前端筛选接入 | 上一轮发现的按作者筛选 preimages、按状态筛选 child bounties 仍有硬编码阻塞；本次功能移除不包含这两处接入。Paseo preimage API 已验证有效；Polkadot/Kusama 旧 API 可能忽略过滤参数，不能在所有网络直接去掉保护 |
| 原 B06 | PR #130 已合并，原“未合并”状态过期；本次移除变更仍需经自身合并和部署后复验 |

## 保留的手动与条件测试

- **H01，真实钱包签名**：沿用自动补测清单中的 SubWallet/Nova/Mimir/WalletConnect 流程；连接、拒签、Paseo 小额投票、Finalized 后 UI 对账、清理；主网保持只读。
- **H02，真实设备**：真实手机与 Safari/Chrome，检查导航、弹窗、软键盘、钱包返回和状态恢复。
- **H03，公投评论签名与持久化**：测试身份在自己的公投发表明确 QA 内容→回复→编辑→刷新核对→重开评论锚点→删除自有评论；拒签、切账户、断连和 watch-only 不得沿用旧编辑权限。已移除的帖子/Poll/点赞/公告无需再测。
- **B02–B05、B07，条件不足**：已结束自有公投的押金退款及 conviction 到期、带自有 ticket 的 Requested preimage、受控可支付 spend 与目的端到账、需治理权限的执行、非空历史 tips 样本，仍按原清单保留；具备条件后优先自动核对。
