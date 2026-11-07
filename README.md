# 简里社区主题

这里保存 Resume One 迁移工具生成的 67 套声明式社区主题。每个 `themes/community-*/` 目录都有主题、许可正文、出处和迁移记录，使用独立字体资源的主题也附有字体许可。`NOTICE.txt` 记录上游的许可声明和所附许可文本来源。Rick Osborne 主题使用 CC BY-NC-SA 4.0，出处和完整许可在对应目录。

从 [Releases](https://github.com/sctb512/resume-one-themes/releases) 下载 ZIP 后，解压并在简里的「管理」中将本地主题目录指向其中的 `themes/`。这批是已做本地排版和导出验收的适配版，逐主题的原版视觉等价仍待核对。

想直接从应用内浏览，可将 `sctb512/resume-one-themes`、`main`、`index.json` 添加为可选在线源。`index.json` 仅列出当前单文件在线协议可加载的主题。完整的 67 套与字体文件在 ZIP 中，`packages.json` 记录全部文件的 SHA-256。使用本地主题包时不依赖在线源。

主题文件格式见 [简里主题规范](https://github.com/sctb512/resume-one/blob/main/resume-one-theme-spec-v2.md)。迁移工具与应用代码位于 [resume-one](https://github.com/sctb512/resume-one)。

## 验证和发布

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python tools/catalog.py
.venv/bin/python tools/catalog.py --pack dist/Resume-One-Community-Themes.zip
```

更新 `themes/` 后运行 `.venv/bin/python tools/catalog.py --write`，一并提交主题包和两份索引。流水线会校验 Schema、许可文件、字体 SHA-256 和索引一致性。推送 `v*` 标签后生成 ZIP、校验文件和索引，并创建 GitHub 预发布。手动运行仅生成流水线制品。
