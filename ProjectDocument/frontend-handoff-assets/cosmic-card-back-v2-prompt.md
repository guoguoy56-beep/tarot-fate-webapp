# 星空牌背 v2：深色与清晰度修订

日期：2026-11-04。按用户反馈保留 v1 星盘、月相和边框构图，加深底色并提升前景清晰度。通过 imagegen 技能的内置 `image_gen.imagegen` 编辑模式处理 v1 原始 PNG，未使用 CLI/API Key 工作流。

- 输入：v1 原始生成图，962×1635。
- 提示词请求 2176×3712，但工具实际仍输出 962×1635；这是实际交付上限，不能将其称为 4K，也未通过插值放大伪造分辨率。
- 运行素材：`public/assets/cosmic/card-back-v2.webp`，原生 962×1635、1,338,764 字节、RGB。已有 Sharp 只做无损 WebP 编码，取消 v1 的 680×1160 缩小和 quality 90 有损编码。
- 原编辑输出保留在 Codex 生成目录；最终运行素材已存入项目。v1 和旧版素材均保留，可独立回滚。
- 本轮属于生成式编辑，保留主要纹样和布局；不是逐像素无改动的纯调色。

## 完整编辑提示词

```text
Use case: precise-object-edit.
Edit target: the attached local tarot card-back master artwork. This exact star / astrolabe / crescent design is approved. Preserve its geometry, composition and pattern; this is a color-and-clarity correction, not a redesign.
Requested changes:
1. Make the blue-violet base much darker, to near-black midnight navy ink (#070b16 to #11162a). Reduce the brightness and saturation of all purple cloudy nebula regions substantially, about 65 percent less luminous than the source. The navy card silhouette must separate distinctly from a luminous purple nebula webpage background. Keep a very subtle dark violet mottled print texture, never a bright purple cloud patch.
2. Retain the existing champagne-gold linework, eight-point central star, exact orbital curves, paired crescents, tiny dots, corner ornaments and double outer frame in their same positions and proportions. Gold remains clear and softly luminous on the newly dark base. Crisp engraved edges, excellent line definition. No blur, no fuzzy glow, no thick halos, no new symbols.
3. Produce a genuine high-resolution master for a very enlarged foreground card: requested 2176 x 3712 pixels (portrait 17:29, about 4K tall), clean resolved fine lines and crisp foil edges. Preserve all pattern details rather than softening or smoothing them out. No artificial sharpening halos.
Invariants: one flat edge-to-edge opaque rectangle, straight-on, no surrounding mockup, same border layout and same central motif, no text/letters/numbers/logos/watermarks. Do not add, remove, or rearrange decoration. Only darken the base and improve resolved clarity.
```
