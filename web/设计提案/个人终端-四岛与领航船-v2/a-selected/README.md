# 小陌的个人终端 · 已选 A 版预览

2026-10-04。保留小陌已选定的 A 版海域布局：原主岛、故事花园、影像工坊、后期港湾及附近的领航船。本轮用内置 image_gen 重绘四岛细节，保留场景入口与现有预览交互；船舱窗外已换成大海。

预览服务运行时打开：[A 版预览](http://127.0.0.1:8796/a-selected/)。

| 岛屿 | 猫咪角色 | 最终图片 |
| --- | --- | --- |
| 我的主岛 | 英国短毛蓝猫 | [home.png](assets/home.png) |
| 故事花园 | 三花田园猫 | [story.png](assets/story.png) |
| 影像工坊 | 暹罗猫 | [visual.png](assets/visual.png) |
| 后期港湾 | 缅因猫 | [post.png](assets/post.png) |

同一岛的首页与详情展示同一只猫。具体分配是本轮实现选择；识别特征和素材状态见 [cat-cast.json](assets/cat-cast.json)，其中 `finalImagePath` 相对于该文件所在的 `assets/` 目录。四张最终图片已接入并完成视觉检查，且与猫咪局部编辑清单记录的生成原件逐一匹配。

四岛重绘提示词与来源见 [generation-manifest.json](assets/generation-manifest.json)；猫咪局部编辑提示词与最终生成来源见 [cat-edits-manifest.json](assets/cat-edits-manifest.json)。

浏览器验证 16 项通过，结果见 [qa-results.json](output/playwright/qa-results.json)；首页、各岛详情与船舱截图位于 [output/playwright](output/playwright/)。这些检查验证本次前端预览的显示与交互，不代表小陌本人已经体验验收新美术。

当前仍是前端预览，正式 `8787` 终端与业务数据未切换。本轮没有实施四系统业务整合或资料迁移，输入也不写入正式记录。
