# outcomes.xyz 上线清单

基于 Hyperliquid HIP-4 的预测市场前端，通过 builder code 收费。
技术栈：React + TypeScript + Vite + Tailwind + shadcn/ui + @nktkas/hyperliquid。

---

## 一、上线前必做（按顺序）

### 1. 准备 builder 地址
- 选一个**专用钱包**作为 builder 地址（费用都进这里，别用主钱包）
- 在 Hyperliquid 上给该地址的 **perps 账户存入 ≥ 100 USDC**
- 确认账户抽象模式为 **standard**（默认就是，没改过不用管）

### 2. 测试网实测一笔（强烈建议）
```bash
cp .env.example .env
# 编辑 .env：填入 VITE_BUILDER_ADDRESS，设 VITE_IS_TESTNET=true
npm run dev
```
- 连接钱包 → 签名 ApproveBuilderFee 授权
- 在测试网下一个单，到 `https://app.hyperliquid-testnet.xyz` 确认订单成交且带 builder fee
- 测平仓（IOC 卖出）和撤单

### 3. 配置生产环境变量
Vercel → Project Settings → Environment Variables：

| 变量 | 值 | 说明 |
|---|---|---|
| `VITE_BUILDER_ADDRESS` | `0x你的地址` | **必填**，收费用 |
| `VITE_BUILDER_FEE_TENTHS_BPS` | `100` | 0.1%，上限 1000（1%） |
| `VITE_BUILDER_MAX_FEE_RATE` | `0.1%` | ≥ 实际收费率 |
| `VITE_IS_TESTNET` | `false` | 主网 |
| `VITE_USE_MOCK_FALLBACK` | `false` | 生产环境关闭演示数据 |

### 4. 部署到 Vercel
```bash
npm i -g vercel
vercel          # 预览部署，先检查
vercel --prod   # 正式部署
```
- 仓库已带 `vercel.json`（SPA 路由重写 + 静态资源缓存），零配置可跑
- 构建命令 `npm run build`，输出目录 `dist`（Vercel 对 Vite 自动识别）

### 5. 绑定域名
- Vercel → Domains → 添加 `outcomes.xyz` 和 `www.outcomes.xyz`
- 到域名注册商处把 DNS 的 A 记录指向 `76.76.21.21`（或按 Vercel 提示配 CNAME）
- 等证书签发（通常几分钟）

---

## 二、上线后验证

- [ ] 首页能加载真实市场（没有"演示数据"黄字）
- [ ] 市场卡片价格在动（有"实时"绿灯）
- [ ] 内页走势图 / 盘口 / 成交流正常
- [ ] 连接钱包 → 授权弹窗里的 builder 地址是你的
- [ ] 下一个最小单，到 Hyperliquid 官网仓位里确认成交
- [ ] 次日查收入：`https://stats-data.hyperliquid.xyz/Mainnet/builder_fills/{你的地址}/{YYYYMMDD}.csv.lz4`（地址全小写）

## 三、收入对账

- 累计费用：info 接口 `{"type": "referral", "user": "你的地址"}`
- 逐笔成交：上面的 `builder_fills` CSV（LZ4 压缩，每日一个文件）
- 领取：走 Hyperliquid 的 referral reward claim 流程

## 四、合规提醒

- 预测市场在美国等多地受监管限制，Hyperliquid 本身对美国 IP 有地理封锁；
  你的前端是否额外做地区限制，建议咨询法律意见
- 页脚已放风险提示文案，不要删

## 五、后续迭代方向（按价值排序）

1. 持仓估值覆盖全部持仓市场（目前只订阅当前页的价格）
2. 市场按成交量/到期时间排序（需要额外数据源）
3. SEO：内页服务端渲染或预渲染（react-router 的 SSR 模式）
4. 移动端适配细节打磨
