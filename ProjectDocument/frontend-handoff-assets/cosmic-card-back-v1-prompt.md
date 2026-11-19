# 星空新版牌背 v1 生成记录

日期：2026-11-04。使用内置 `image_gen.imagegen`，按 imagegen 技能的默认内置工具模式生成，无 CLI/API Key 工作流。

运行素材：`public/assets/cosmic/card-back-v1.webp`，680×1160。原生成图为 962×1635 PNG，通过项目已有 Sharp 进行尺寸归一与 WebP 编码；未新增依赖。原图保留在 Codex 本地生成目录，工程使用的最终素材已保存到仓库。

这是新牌背，而非旧素材重绘覆盖。旧版继续引用 `public/assets/tarot-card-back.webp`。生成结果采用上下成对的星盘／月相构图；纹理及微小星点并非像素级旋转对称。背面始终以相同朝向显示，抽到的正逆位仅由正面图像表达。

## 完整生成提示词

```text
Use case: stylized-concept.
Asset type: final production tarot card BACK texture for the existing "命运回廊 / Corridor of Fate" desktop web app, a single flat printed rectangle, not a presentation mockup.
Create an elegant mysterious celestial tarot card back that belongs in a deep indigo and muted violet nebula scene with delicate champagne-gold orbital lines. Tall portrait aspect ratio 17:29 (the actual card is 68 by 116). Fill the entire image with the flat card artwork, edge to edge; viewed perfectly straight on, no perspective, no table, no external margins, no drop shadow or surrounding scene.
Design: luxurious midnight-indigo ink, softly mottled violet-blue nebular pigment resembling satin-finish printed paper rather than leather; sparse tiny stars; an exquisitely balanced central celestial compass / astrolabe medallion with one clear eight-point star, fine nested gold orbital ellipses and discreet crescent shapes arranged in opposing pairs. A restrained double-line champagne-gold frame and small elegant corner ornaments. Use a clear strong central silhouette that still reads when reduced to 68px wide; detail subordinate to the main motif. Broad breathing room between the central medallion and the frame. Gold should be luminous etched foil with modest contrast, not blazing yellow.
The ENTIRE design, including celestial speckles and ornaments, should have 180-degree rotational symmetry so the back does not reveal upright or reversed orientation; balanced matching top and bottom. No single upward-only symbol.
Mood: occult celestial, quiet, refined, mystical, precious. Blue-violet is visibly present and brighter than pure black while remaining dark enough to stand apart from the glowing background. Avoid rough brown leather, grunge scratches, sci-fi circuitry, holograms, bright neon, flames, figures, faces, text, letters, numerals, borders outside the card, logos, signatures, watermarks. No card FRONT imagery. Opaque image, not transparent.
```
