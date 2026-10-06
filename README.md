# 宝宝作息计划表（育婴计划表）

一个离线可用的安卓 App，把宝宝作息表做成了可视化、可编辑、可勾选的工具。

## 功能

- **作息表**：时间 / 吃 / 陪玩环节内容 / 睡小觉 四列，每条都可直接点击修改
  - 每行可勾选「已完成」
  - 可「＋ 添加一行」、可删除行
  - 「新的一天」一键清空当天勾选（修改内容保留）
  - 每行可开启「每天到点提醒」（本地通知）
- **早教安排**：大运动 / 精细运动 / 认知能力 / 语言启蒙 / 感统训练
- **带养说明**：12 条带养要点
- 数据保存在手机本地，完全离线，无需联网

## 如何取得 APK

本项目用 GitHub Actions 云端编译，本机无需安装 Android SDK。

1. 把代码推送到 GitHub 仓库（`master` 分支）
2. 打开仓库 → **Actions** 标签 → 选择 **Build APK** 工作流
3. 等构建成功后，在运行记录页底部 **Artifacts** 下载 `baby-schedule-debug-apk`
4. 解压得到 `app-debug.apk`，传到手机安装（需允许「安装未知来源应用」）

也可以在 Actions 页面点 **Run workflow** 手动触发。

## 本地开发

```bash
npm install          # 安装依赖
npx cap sync android # 把 www 同步到 android 工程
```

改动网页部分只需编辑 `www/` 下的文件，然后重新 `npx cap sync android`。

## 目录结构

```
www/                     # 网页应用（真正的界面与逻辑）
android/                 # Capacitor 生成的安卓工程
.github/workflows/       # 云端构建 APK 的工作流
capacitor.config.json    # Capacitor 配置
```

## 通知权限说明

- 首次开启提醒会请求通知权限，请选择「允许」
- Android 14+ 若希望**准点**提醒，可在系统设置 → 应用 → 宝宝作息 → 闹钟和提醒 中开启
- 未开启时通知仍会送达，只是可能有几分钟误差
