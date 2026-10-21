# ModelScope 国际站 Static 创空间部署指南

目标站点：**https://www.modelscope.ai**（国际站）；本项目明确不部署到 modelscope.cn。
状态：准备文档；尚未建 Studio、未获取 Token、未推送代码、未消耗积分。

官方资料：
- https://github.com/modelscope/modelscope-skills
- https://github.com/modelscope/modelscope-skills/blob/main/skills/ms-studio-deploy/SKILL.md
- https://www.modelscope.ai/studios
- https://www.modelscope.ai/my/myaccesstoken

## 1. 架构与成本边界
React / Vite / Three.js 在本地构建为 dist 静态资源，在访问者浏览器 WebGL 渲染。官方 Skill 对 static SDK 的描述是「index.html 预构建、无平台构建步骤、不选择硬件」；不需要购买云 GPU。
官方未保证所有上传、流量、存储和免费配额永远零成本；创建前确认国际站当时的资源和积分政策，不启用付费实例/API。

## 2. 预部署检查（无需账号）
Windows PowerShell 在项目目录执行：

~~~powershell
cd E:\Projects\forest-moments
pnpm install
pnpm lint
pnpm test
pnpm build
pnpm preview
~~~

确认：
- dist/index.html 存在，dist/assets/ 的 JS/CSS/GLB/纹理均可访问。
- vite.config.ts 的 base 为 './'，模型使用相对资源路径且在部署路径真实可访问；浏览器控制台无 404。
- 没有服务端 API、Prisma、环境秘密、调试服务器依赖。
- 确认资源来源许可（尤其 AI 生成的资产）、体积和真实运行 FPS。
- 当前版本移动端触控操作未完成；比赛主推 PC。

## 3. 准备官方 Skill / SDK
仓库内 .agents/skills/ms-hub、ms-studio-deploy 为官方快照；并见 docs/SKILLS.md。
需要操作线上时在自己的终端额外安装 SDK：

~~~powershell
python -m pip install --upgrade modelscope
$env:MODELSCOPE_ENDPOINT = 'https://www.modelscope.ai'
~~~

请去国际站的 Token 页面申请凭据。不要在文档、Git、命令行历史或聊天消息中写 Token。
可以用 Windows 安全凭据管理器或本次进程中的临时环境变量安全传递令牌，不要用在 Git remote URL 里明文嵌入 Token。
在具备凭据的终端先核对 SDK/CLI 的实际版本和命令帮助，再执行读取身份的命令（如 ms whoami），务必确认身份属于国际站。

## 4. 创建国际站 Static Studio
取得单独授权后：
1. 在 https://www.modelscope.ai/studios 创建空间，SDK 类型选择 Static，名称建议 forest-moments。
2. 创建时先设为 Private；确认所有素材和流程通过后，再经用户批准设为 Public。
3. 若用 API / CLI 创建，必须把 MODELSCOPE_ENDPOINT 固定为 https://www.modelscope.ai 并使用国际站签发的 Token；sdk_type 选择 static。不要给 static 配置 GPU 或 Docker 环境。
4. 记录最终的 owner/repo，以国际站实际 URL 为准。

**注意**：官方 Skill 默认 Endpoint 可能是国内站。本项目所有部署脚本都应在执行之前校验 Endpoint 为国际站，失败就停止而不是回退。

## 5. 只上传 dist（隔离部署仓库）
- 在项目外或临时目录创建仅含 dist 内容的 Git 仓库；根目录应直接是 index.html。
- 上传时不包含 src、.env、node_modules、原始 .blend、报告草稿或其他无关私密文件。
- 使用安全的 Git Credential Manager 或由 SDK 管理的身份验证，避免把 Token 拼进 remote URL；切勿在日志中输出 token。
- 更新静态资源后推送到国际站对应 Studio 的仓库，按其 UI 或官方 ms-studio-deploy 流程触发部署。
- 如官方 API 有变更，以现时 UI/Skills 对 sdk_type、仓库默认分支和部署动作的说明为准。

建议发布隔离目录结构：

~~~text
publish/
  index.html
  assets/
    *.js
    *.css
    *.glb
    *.webp
~~~

不会把原开发 Git 仓库直接公开。

## 6. 验收与比赛提交
- 打开国际站 Studio 页面，确认 Running/Ready；使用无痕浏览器验证不用登录也能体验。
- 验证 F 互动、WASD/Shift、种树存档、资产 404、渲染帧率、声音权限、全屏和刷新。
- 截取最终实机画面与模型迭代对比；同步 docs/report/PROJECT_REPORT.md，写入实测版本、浏览器、日期和公开链接。
- 将 Studio 公开 URL 填在比赛的 Demo/视频栏目；项目报告书建议以 PDF 单独提交或放在长期可访问的报告链接中。
- 评审期准备本地录屏备用，以防平台限流或资源异常。

## 7. 安全、故障与回滚
- 不能向任何模型或公开内容提供真实 Token。官方 Skill 中读取 Git remote 或打印环境变量的便利步骤，**不得在本项目照做**。
- 若 URL 包含 modelscope.cn、需要付费硬件/魔粒服务、试图上传源码或需要公开敏感内容：立即停下并征得用户同意。
- 空间部署失败：检查资源 404、SDK 类型、默认分支、目录根、国际站 Token 权限和构建日志；不要盲目转 Docker。
- 新版异常：重新部署上一份已验证的 dist 发布快照。更新过程记录到报告书。
