# 首页原图字形与按钮素材

日期：2026-11-09。用户要求标题和“开始占卜”的字形、金属效果与最初产品预览一致，并允许采用任何实现方法。最终直接提取原选方案 2 的原始像素，未匹配近似字体或重新绘字。

来源为同目录 `homepage-option-02-nebula-voyage.png`，1484×1060；原文件未修改。

| 文件（位于 public/assets/cosmic） | 尺寸 | 原图裁区（左、上、右、下，右下不含） | 字节 |
| --- | --- | --- | --- |
| home-title-source-v1.png | 462×144 | 154, 251, 616, 395 | 99388 |
| start-button-source-v1.png | 425×115 | 175, 475, 600, 590 | 76042 |

提取仅生成透明通道，RGB 数据原样复制；没有重新上色、改笔画、变形、生成替代文字或改变文字内部纹理。标题去除外围暗背景和装饰轨迹，按钮保留原有文字与金属框体。图片以自然比例显示，并关闭 Next Image 损耗优化；不同桌面尺寸只做等比显示。原生 `h1`、`button` 与 `sr-only` 文本保留语义和可访问名称。

可复现脚本为 `extract_homepage_lettering.py`，需要 Python 与 Pillow 12.1+：

```powershell
python ProjectDocument/frontend-handoff-assets/extract_homepage_lettering.py
```

脚本包含 RGB 逐字节一致性断言。运行校验与 SHA-256 记录在 `output/home-ui-ornate-2026-11-09/source-pixel-verification.json`；整图和细节的浏览器对照分别为 `source-full-comparison.jpg`、`source-type-comparison.jpg`。

标题 SHA-256：`b9d185a7f0473677e3836a8ae9cfd53d414ebd46b961ed50235a341d5940ed29`。

按钮 SHA-256：`3a739af446241a6358b1d543d3c1f9e43a2c8ed48824806b35c7f39648c52869`。

## 金圈与清晰版（2026-11-09）

同一提取脚本新增以下当前使用的素材，旧版继续保留作为来源与对照：

| 文件（位于 public/assets/cosmic） | 尺寸 | 来源／处理 | 字节 |
| --- | --- | --- | --- |
| home-title-emblem-source-v2.png | 462×333 | 原图 (154,118,616,451)，提取金圈、星芒和标题，移除英文；仅改 alpha | 200278 |
| start-button-source-sharp-v2.webp | 1700×460 | 原 425×115 按钮四倍重采样及适度锐化，无损 WebP | 486796 |

前文 RGB 原样复制的约束适用于原始提取版及新版标题。按钮清晰版在保留原字形的基础上改变边缘对比度；缩放采用预乘 alpha，防止透明金边混入暗色，保存后已验证 RGBA 无损往返。没有使用 AI 重绘文字。

新版页面移除了按钮居中的 transform 与悬停模糊阴影，保留轻微亮度反馈。素材自然比例不变，标题周围金圈纳入标题装饰区域，单行介绍留在其下方。

新版校验：`output/home-ui-ring-sharp-2026-11-09/asset-verification.json`。

标题金圈 SHA-256：`496d5fe44b5c5c008ffb793faf5f9c8d5d831ba397a07ed102ee1a1b3732768a`。

按钮清晰版 SHA-256：`c86138248911d2c86d9ad1b7005d977003e940b8145384366ec2b20b770a4d94`。
