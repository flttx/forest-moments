# P1 参考图适配修订

日期：2026-10-21。范围：用户批准按参考图审查建议修改。使用内置 image_gen.imagegen，未调用 Lux3D/Tripo 模型生成、未运行 Blender、未修改运行时代码。

## 已完成

共 13 次图像生成，选定 9 张当前专题参考；4 张试稿保留为迭代证据。原 35 张参考图不覆盖，其中 15 张继续用作单体造型依据，20 张标记为历史。当前入口为 [参考图索引](../../../../references/README.md)，所有提示词、实际输入、产物尺寸与 SHA-256 见 [生成记录](generation-record.json)。初始 generation-plan.json 为计划快照，实际执行以 generation-record.json 为准。

| 主题 | 修改前 | 当前产物 | 实际图像复核 |
| --- | --- | --- | --- |
| 瞭望塔 | 封闭石砌底层、较厚重 | [开放主图 v2](../../../../references/lookout/forest-moments-lookout-master-v2.png) | 塔底开放，小石脚独立；取消不可信侧视图，结构以单主图起步 |
| 工坊 | 厚石基、多台阶、多视图关系不明确 | [主图 v2](../../../../references/workshop/forest-moments-workshop-master-v2.png) | 左附棚固定、石基降低、工具减少、烟囱取消；不声称背面尺寸已解决 |
| 种树 | 只有一张细长幼松，与概念种植区不同 | [成长 v2](../../../../references/environment/forest-moments-tree-growth-v2.png) | 同种阔叶树初栽/幼树/成树三阶段清楚 |
| 浣熊 | 手臂贴近身体、鞋和毛发细节多 | [角色 v2](../../../../references/player/forest-moments-raccoon-design-v2.png) | 正背面间隙增大、鞋简化；侧面投影与尾巴差异仍需模型统一 |
| 牧场动物 | 羊毛与羽毛细密 | [动物 v3](../../../../references/farm/forest-moments-farm-animals-v3.png) | 羊毛、鸡翅改大形体，鸡相对缩小；实际比例由建模测量 |
| 码头 | 分离模块、岸接和上船关系未定义 | [码头 v2](../../../../references/waterside/forest-moments-pond-dock-layout-v2.png) | 连续甲板、岸边坡接、靠船开放边可辨；水位和碰撞仍待测 |
| 岸线 | 只有零散石头与整体概念 | [岸线 v2](../../../../references/environment/forest-moments-shore-transitions-v2.png) | 岩岸、沙湾、淡水池岸分别表达，池塘无海浪 |
| 交互 | 缺少接触与尺度参考 | [交互 v3](../../../../references/interaction/forest-moments-interaction-scale-v3.png) | 握桨、持竿、门通路和喂食位置可辨，鸡羊颜色已统一 |
| 环境板 | 图内旧标题、额外地标和布局 | [环境板 v3](../../../../references/style/forest-moments-environment-board-v3.png) | FOREST MOMENTS 标题正确、海上小岛、开放塔；烟囱和船色偏差已修正 |

## 迭代中未采用的结果

- [瞭望塔首稿](lookout-rejected-multiview.png)：标成 FRONT 与 SIDE 的小图过于相似，不能作为准确投影，改用单主图。
- [动物 v2](../../../../references/farm/forest-moments-farm-animals-v2.png)：毛羽仍密、鸡相对偏大，改为 v3。
- [交互 v2](../../../../references/interaction/forest-moments-interaction-scale-v2.png)：鸡羊颜色漂移、门偏高，改为 v3。
- [环境板 v2](../../../../references/style/forest-moments-environment-board-v2.png)：工坊再出现烟囱、船身变成纯木色，定向修正为 v3。

## 验证边界

本轮逐张查看了实际生成图，以上结论仅为二维设计适配复核。没有把图片中的高度、骨骼、握持、楼梯或三维一致性当作已验证。多视图、角色绑定位姿、尾巴与船舱关系、门和楼梯碰撞，需要唯一三维模型和真实运行时验证。

用户尚未对本轮图片作最终视觉确认；不标记用户 Gate A/C PASS。本轮没有新增实机截图，图片均为设计插画，不能写入报告作为已实现玩法截图。

## 文件与项目检查

原 35 张参考图哈希保持不变；新增 13 张解码、尺寸及与工具原图的 SHA-256 校验通过。包括此前两版概念在内的 50 张图片均有清单记录，107 个本地链接检查通过。pnpm lint、pnpm test（3/3）、pnpm build 及 git diff --check 通过；主 JS 1,145.60 kB 的既有体积提示仍在。结构化结果保存于 validation.json。
