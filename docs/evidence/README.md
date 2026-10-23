# 证据保留与仓库范围

更新：2026-10-23。

仓库保留阶段说明、数值审计、来源与哈希、复现脚本、视频，以及文档明确引用和当前玩法/场景的精选图片。截图采集批次产生的全部 PNG 不自动加入 Git；`.gitignore` 排除批量输出，精选图片经核对后显式加入。

本轮选择清单见 [2026-10-23-repository-selection.json](maintenance/2026-10-23-repository-selection.json)。未入库图片仍保留在本机，不代表删除成功。此前的 [图片清理清单](maintenance/2026-10-23-image-cleanup.json) 记录的是本地候选与执行阻塞，其 `retainedImages` 表示本地保留图片，不是 Git 收录清单。

历史 `headless-validation.json` 的 `screenshots`、`videoFrames` 及阶段文字中的图片总数记录当时实际采集情况，不保证全部图片随本仓库发布。历史 JSON 保持原始内容；克隆仓库后查看图片请以本轮选择清单及 Markdown 图片链接为准。数值审计不因图片精选而变成新的验证结果。

`review-loop.mp4` 保留完整划桨循环；视频逐帧 PNG、冗余左右采样和失败试稿整批图片留在本机。模型输入、报告链接的前后对比、缺陷说明和当前场景关键视图优先保留。

`assets/` 下原始 GLB、ZIP、Blender 工作文件和试稿不纳入本轮提交；它们在报告中出现的路径是本地制作过程记录。当前运行版本的 GLB 与轨迹保存在 `public/assets/models/`，前者使用 Git LFS。敏感的生成响应、凭据及账本保持本地忽略。

这次提交是版本归档，不是 ModelScope 部署，也不代表完成素材商业授权或全场景视觉验收。
