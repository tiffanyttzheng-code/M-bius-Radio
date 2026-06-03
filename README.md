# Möbius Radio — GitHub Pages 部署版

## 文件结构

```
github-pages/
├── index.html          ← 必须在根目录
├── script.js
├── .nojekyll           ← 禁止 Jekyll 处理（必须保留）
├── .gitignore
├── assets/             ← 专辑封面(JPG) + 音乐(MP3)
│   ├── 1/ … 30/
│   ├── intro_radio.png
│   └── intro_title.png
├── css/
│   ├── style.css
│   └── ring-generator.css
└── js/
    ├── audio-manager.js
    ├── data.js
    ├── memory-cards.js
    └── …
```

## 上传方式（GitHub Desktop 推荐）

1. 在 GitHub 新建一个 **公开（Public）** 仓库，不要勾选初始化选项。
2. 打开 **GitHub Desktop** → File → Add Local Repository → 选择本文件夹。
3. Publish repository → 确认仓库名称 → Publish。
4. 在 GitHub 网页仓库里进入 `Settings` → `Pages`。
5. Source 选 `Deploy from a branch`，Branch 选 `main`，目录选 `/ (root)` → Save。
6. 等待 1-2 分钟，访问 `https://<你的用户名>.github.io/<仓库名>/`。

## 注意事项

- **直接双击 index.html 无法打开**（浏览器 ES Module 安全限制），
  必须通过 GitHub Pages URL 或本地 Web 服务器访问。
- 用户账号和记忆卡片数据存储在 **各自浏览器的 localStorage**，
  不同用户之间不共享（这是设计限制）。
- 共鸣次数最多 10 次/专辑/用户，数据同上，不跨设备同步。
- 仓库总大小约 420 MB（主要是 MP3），首次推送会较慢，属正常现象。
- 上传前请确认专辑封面和音乐文件具备公开展示授权。
