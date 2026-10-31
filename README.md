# 个人主页（GitHub Pages）

纯 HTML / CSS 手写的像素风单页，零依赖、零构建。内容为张军的公开 GitHub 项目。

```
site/
├── index.html   主页
├── style.css    全部样式（像素风 + 简约模式 + 深色 + 响应式 + 打印）
├── favicon.svg  像素小图标
├── .nojekyll    关掉 Jekyll，防止下划线开头的路径被吞
└── fonts/       Departure Mono / Ark Pixel（SIL OFL 1.1，随字体附许可证）
```

## 本地预览

直接双击 `index.html`，或：

```powershell
# 需要 Node（任意版本）
npx serve E:\works\myResume\site
```

## 发布到 GitHub Pages

仓库名必须是 `<用户名>.github.io`，一个账号只有一个：

```powershell
cd E:\works\myResume\site
git init -b main
git add .
git commit -m "init: pixel personal homepage"
git remote add origin https://github.com/zhangjun005/zhangjun005.github.io.git
git push -u origin main
```

然后仓库 **Settings → Pages → Build and deployment**：

- Source：`Deploy from a branch`
- Branch：`main` + `/ (root)`
- Save

等 1–2 分钟，访问 <https://zhangjun005.github.io>。

## 改内容

- 文字都在 `index.html` 里，`<section>` 按区块分开，中文直接改。
- 颜色/字号全部是 `style.css` 顶部的 CSS 变量，改 `:root` 一处即可。
- 加项目：复制一个 `<article class="card">` 块，改标题、描述、chips 和链接。
- 邮箱、GitHub 用户名出现的位置：搜索 `zhangjun005` 和 `368357@whut.edu.cn`。

## 更新贡献图

首页「贡献」区块是**静态烘进 HTML 的**（不依赖任何第三方图片服务，离线也能看）：
53 周 × 7 天的像素贡献图（含每日 tooltip），以及当月 Contribution activity 列表。
更新时在 `site/` 下运行：

```powershell
node scripts/update-contrib.mjs
```

脚本会抓 GitHub 的 contributions 片段（`?action=show&controller=profiles&tab=contributions`），
重写 `index.html` 里 `<!-- contrib:start -->`…`<!-- contrib:end -->` 和
`<!-- activity:start -->`…`<!-- activity:end -->` 之间的内容。
只依赖 Node 18+ 自带的 fetch，无需安装包。

注意：GitHub 的 contribution activity 时间线**不包含 release**，所以脚本会额外调用
Releases API，把本月的发布补进列表（前面是蓝点的条目）。

## 每天自动更新（GitHub Actions）

`.github/workflows/update-contrib.yml` 每天 **北京时间 08:30** 自动跑一次：

- 重新生成贡献图 + 最近活动
- 只有内容真的变了才会提交，不会产生空 commit
- 自动提交后会触发 Pages 重新构建，约 1 分钟后线上生效
- 用的是仓库自带的 `GITHUB_TOKEN`（`contents: write`），**不需要配置任何 secret**
- 想立刻跑一次：仓库 **Actions** 页面 → 左侧 `update contributions` → 右侧 **Run workflow**

## 字体许可

- Departure Mono — Copyright 2022–2024 Helena Zhang，SIL OFL 1.1
- Ark Pixel 12px — Copyright TakWolf，SIL OFL 1.1
- 许可证全文见 `fonts/DepartureMono-OFL.txt` 与 `fonts/ArkPixel-OFL.txt`
