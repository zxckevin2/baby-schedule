# 宝宝作息计划表 v2 · 设计文档

日期：2026-10-06
状态：设计已确认（界面 mockup 已通过）

## 1. 目标

把 v1（单一作息表）升级为面向不同月龄、以「磨玻璃卡片 + 可点胶囊」为核心的育婴计划 App，并修复 v1 的若干问题。

成功标准：

- 顶部可切换 2月 / 3月 / 4-5月 三套内置模板，切换后作息、带养、早教整套联动
- 作息每条字段可编辑；陪玩/吃/睡用可点胶囊，陪玩点击画删除线表示完成
- 可量化字段（奶量、睡眠时长）提供滑块
- 「新的一天」清空勾选并恢复被删除的内置条目
- 时间使用系统原生选择器
- 哄睡按钮播放本地音频，可调音量、可定时、可循环
- 页面切换不串滚动位置
- 全部数据本地保存、完全离线

## 2. 范围

### v2 做

- 多模板（2/3/4-5 月龄）+ 月龄切换
- 作息页重构：磨玻璃卡片、可点胶囊、滑块、原生时间选择器
- 早教页：分类胶囊可点（标记今天练过）
- 带养页：卡片列表（沿用）
- 哄睡：悬浮按钮 + 底部播放面板（播放/暂停、音量、定时、循环）
- 每行本地提醒（沿用 v1 的 LocalNotifications）
- 「新的一天」语义修正
- 滚动串页修复
- 代码模块化重构
- 更新应用图标（可选，见 §9）

### v2 不做（二期）

- App 内选择作息表图片自动识别导入（OCR / 表格解析）。二期单独设计，候选：本地 ML Kit 文本识别 + 规则解析，或云端 OCR（需 API Key + 联网）。

## 3. 数据模型

存储键 `baby_schedule_v3`（版本号随结构变化）。

```json
{
  "version": 3,
  "activeTemplate": "m3",
  "templates": {
    "m2":  { "id": "m2",  "name": "2月龄",  "schedule": [Row], "notes": [string], "edu": [EduSection] },
    "m3":  { "id": "m3",  "name": "3月龄",  "schedule": [Row], "notes": [string], "edu": [EduSection] },
    "m45": { "id": "m45", "name": "4-5月龄", "schedule": [Row], "notes": [string], "edu": [EduSection] }
  },
  "day": { "date": "2026-10-06", "done": ["<templateId>:<rowId>", "..."] },
  "settings": { "volume": 0.7, "loop": true, "sleepTimerMin": 30 }
}
```

- `Row`：`{ id: number, time: "HH:MM", feed: FeedSpec, play: PlayItem[], sleep: SleepSpec, remind: boolean, deleted?: true }`
- `FeedSpec`：`{ type: string, amountMl: number|null }`（type 为胶囊选项，如「母乳/瓶喂/AD」）
- `PlayItem`：`{ text: string, done: boolean }`
- `SleepSpec`：`{ label: string, minutes: number|null }`
- `EduSection`：`{ title: string, items: string[] }`（早教页点击状态按 `day.done` 存 `<templateId>:edu:<section>:<item>`）

每日勾选状态统一放在 `day.done`（字符串集合），跨天自动清空。

## 4. 「新的一天」语义

触发（自动跨天 / 手动按钮）时：

1. 清空 `day.done`
2. `day.date` 设为今天
3. **恢复被删除的内置行**：移除所有 `deleted:true` 标记；内置行集合以模板默认为准
4. 保留用户手动新增的行
5. 保留用户对文字/胶囊的编辑

即：删除是「软删除」，跨天自动复原；若要永久改结构，用独立的「编辑模板」入口（v2 可先不做，用软删除 + 新的一天满足需求）。

## 5. 内置模板数据

三套模板内容照录自用户提供的三张图（2 月龄 / 3 月龄 / 4-5 月龄），逐条内置于 `templates.js`。每套含 `schedule`（时间/吃/陪玩/睡）、`notes`（带养说明）、`edu`（5 类早教）。

> 具体条目在实现时按图片原文逐条录入，作为 `templates.js` 的默认数据。

## 6. 界面与交互

### 6.1 视觉

- 背景：浅绿—暖橙—浅蓝的柔和渐变 + 光斑
- 卡片：磨玻璃 `backdrop-filter: blur(16px)` + 半透明白 + 细白描边 + 柔和阴影
- 主色：绿 `#7aa83a`；强调橙 `#e08a3c`
- `backdrop-filter` 不可用时回退为半透明白底

### 6.2 作息页（默认页）

- 顶部：标题、日期、完成进度 `已完成 n/m`、月龄切换胶囊（2月/3月/4-5月）
- 每行一张磨玻璃卡片：
  - 顶行：完成圆勾 · 时间（点击→原生 `<input type="time">`）· 🔔 提醒开关 · 🗑 删除
  - 吃：胶囊（母乳/瓶喂/AD…）单选 + 内联滑块调奶量（显示 `120ml`）
  - 陪玩：多个胶囊，**点击切换完成态**（完成=删除线+变灰），`＋` 新增自定义项
  - 睡：胶囊档位（40-60分/1h/1.5h…），需要精确再拖滑块
- 底部：「＋ 添加一行」、「新的一天」
- 悬浮：右下 🌙 哄睡按钮

### 6.3 早教页

- 5 个分类卡片（大运动/精细运动/认知能力/语言启蒙/感统训练）
- 每项为胶囊，点击切换「今天练过」高亮

### 6.4 带养页

- 编号卡片列表（沿用 v1 展示）

### 6.5 哄睡面板

- 点 🌙 从底部滑出
- 播放/暂停、进度、音量滑块、定时（不定时/15/30/60 分）、循环开关
- 音频文件：用户放入 `www/assets/sleep.mp3`

### 6.6 底部标签栏

作息 / 早教 / 带养

## 7. Bug 修复对照

| # | v1 问题 | v2 方案 |
|---|---------|---------|
| 1 | 删除行后「新的一天」不恢复 | 软删除 + 跨天/手动复原（§4） |
| 2 | 时间手输 | `<input type="time">` 原生选择器 |
| 3 | 滚动位置串页 | 每页独立滚动容器（`overflow:auto; height:100%`），切换回顶 |
| 4 | 陪玩不可点 | 改为可点胶囊，点击=完成（删除线） |

## 8. 通知与音频

- 通知：沿用 `@capacitor/local-notifications`，每行 🔔 → 按该行时间每天提醒；精确闹钟不可用时自动降级为不精确（插件已支持）
- 音频：v2 先用 HTML5 `<audio>`（loop / volume / 定时），零原生依赖
  - 限制：熄屏/后台持续播放 WebView 不保证稳定
  - 若需要锁屏也持续播放，二期评估原生音频插件（如 `@capacitor-community/native-audio`）+ 前台服务
- 音频文件缺失时面板给出提示，不报错

## 9. 应用信息

- appName「宝宝作息」，appId `com.zhuangmingyou.babyschedule`
- 图标：v2 可选做一枚浅绿月亮/婴儿图标替换默认 Capacitor 图标（若做，用 `@capacitor/assets` 生成）

## 10. 架构 / 模块

拆分为 ES 模块（`<script type="module">`，Capacitor https 本地环境支持）：

```
www/
  index.html
  styles.css
  js/
    store.js          # 状态读取/保存/迁移、每日重置
    templates.js      # 三套内置模板默认数据
    notifications.js  # 权限、同步、取消提醒
    audio.js          # 音频播放、音量、定时、循环
    ui/schedule.js    # 作息页渲染与交互
    ui/edu.js         # 早教页
    ui/notes.js       # 带养页
    ui/sleep.js       # 哄睡面板
    util.js           # 时间解析、toast、DOM 助手
  assets/sleep.mp3
```

约束：每个模块单一职责；`store.js` 是唯一写状态出口；UI 模块只读状态 + 调 `store` 的动作。

## 11. 构建与发布

- 沿用 GitHub Actions 云端构建 debug APK（`.github/workflows/build-apk.yml`）
- 改动 `www/` 后 `git push` 自动出包；打 tag 发布 Release 附件

## 12. 验收

- 切月龄，三套数据正确联动
- 陪玩点击出现/取消删除线，刷新后保留
- 时间点开是系统原生选择器
- 删行后点「新的一天」条目恢复
- 页面切换滚动位置不串
- 哄睡面板能播放/暂停/调音量/定时/循环
- 跨天勾选自动清空
- 断网可用
