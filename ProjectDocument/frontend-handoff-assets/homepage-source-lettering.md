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
