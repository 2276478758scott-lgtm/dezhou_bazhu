# 本地牌桌音效

用户试听初版后反馈筹码与纸牌缺乏真实感，因此已弃用电子合成音，改用 Kenney Casino Audio 1.1 的实体音效采样。

- 作者：Kenney Vleugels（Kenney.nl）。
- 官方来源：https://kenney.nl/assets/casino-audio
- 下载：https://kenney.nl/media/pages/assets/casino-audio/2472606a04-1721639069/kenney_casino-audio.zip
- 授权：CC0 1.0；原始授权文本见 Kenney-CC0.txt。
- 处理：移除起始静音、裁剪短片段、转单声道 44.1kHz PCM16 WAV；运行时短淡入淡出，保持原始播放速度。用户试听选择筹码 B：对 chips-collide-3 加 160Hz 高通、3.2kHz 提亮 5dB、0.92 限幅，突出清脆碰撞；全下同音色按 0／55／110ms 轻叠加。
- audio-data.js 内嵌这些 WAV 的 PCM，用于浏览器、PWA 和独立 HTML，无需联网取音频，不依赖 OGG 解码支持。

| 本地文件 | 原录音 | 用途 |
|---|---|---|
| chips-collide.wav | chips-collide-3.ogg（用户选 B，提亮处理） | 跟注／加注，筹码碰撞 |
| chips-allin.wav | 处理后的 chips-collide-3 三次轻叠加 | 全下，多枚筹码 |
| chip-tap.wav | chip-lay-1.ogg | 轻按钮／金额刻度／过牌／轮到玩家 |
| chips-stack.wav | chips-stack-1.ogg | 本手净赚，收筹码 |
| card-slide.wav | card-slide-1.ogg | 发底牌，纸牌滑动 |
| card-place.wav | card-place-2.ogg | 公共牌落桌／净亏短反馈 |
| card-fold.wav | card-shove-2.ogg | 弃牌，纸牌推走 |

完整原包保留在 work/kenney-casino-audio.zip，非运行依赖；转换信息和 SHA256 见 work/controls-audio-samples.json。不使用 Supercell 或其他游戏的音频素材。
