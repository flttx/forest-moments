# 音频素材来源（2026-10-26）

- 来源：本机 my-blog 项目（提交 `520c6bb`）的 `public/assets/world/audio/`，46 个 MP3 与 `audio.json` 原样复制到 `public/assets/audio/`，只把列表中的路径前缀改为 `/assets/audio/`。复制后逐个比对 SHA-256，全部一致。
- 许可：均为 CC0 1.0。Kenney 的 impact-sounds、rpg-audio、interface-sounds 三个音效包，以及 20 条 Freesound 录音（my-blog 当时逐条在 Freesound 页面上核验过 CC0）。逐条来源、作者、页面链接和哈希见同目录 `sources.json`（从 my-blog 的 `assets/audio/sources.json` 照搬）。
- 本轮没有重新联网核验许可页面，许可结论沿用 my-blog 2026-10-19 的核验记录。
- 加工：my-blog 的 `assets/audio/build_audio.py` 当时完成了裁切、响度统一和编码（32 kHz MP3），本项目没有再加工。
- 体积：1,056,222 B（约 1.0 MiB）。
- 篝火噼啪声、风声、室内底噪由 WebAudio 运行时用噪声合成，不是录音素材。
