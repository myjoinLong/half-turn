# 再翻半圈

本地候选版为 0.9.0-rc.2。交付包在 release/half-turn-0.9.0-rc.2.zip。上一版发布包和验收记录保留在 release/。本机私测事件可用 [私测看板](release/私测看板.html) 离线查看。

竖屏单指滑雪。首次进入极光大跳台，按住起飞并抓板，看到「现在松手」就展开落地。两跳分别体验 Indy 360° 和 Tailgrab 720°。开场有落地辅助，表演分只在开场显示。随后从松林山零分起步。菜单可以重玩开场或直接入山。

正式雪道第一跳自动离台，腾空时按住向后翻，提前松手减速。第二跳开始，在橙色区松手蹬伸，腾空后再次按住转体。第三跳加入 Indy 抓板练习。按住画面或底部按钮操作，键盘空格等效。摔倒后点一下回到台前，每日赛则消耗本跳。

## 运行与打包

在本目录执行 `npm ci`、`npm run dev`。手机与电脑连同一局域网，打开 Vite 输出的 Network 地址。正式静态包执行 `npm run build`、`python tools/package.py`，使用 `npm run preview` 检查。压缩包根目录为 index.html，以 HTTP(S) 静态托管。开发和预览服务器通过不同端口隔离本地存档。Phaser 和素材随包分发。

`npm test` 验证确定性模拟、评分和事务。浏览器触控回归先以 `npm run preview -- --port 4187` 启动预览，再执行 `node tests/mobile.mjs`，默认使用 Windows Edge，可用 BROWSER_EXE 指定 Chromium。访问 `/?editor` 可看橙色起跳区与两条弹道。滑行设置可导出最近的本机事件。

`node tests/opening.mjs` 检查全新存档的开场失误重试、两次触摸抓板与松手、零分入山和刷新后的开场状态。

## 源码与素材

- src/sim/ski.ts 包含每秒 60 步的模拟和按距离细分的碰撞检测。录像按跳台记录按键变化的模拟步、起跳配置和连段。
- src/content/routes.ts 定义三座山、15 条线路、练习与北京时间轮换题，以及纯外观收藏。个人最佳保存在本机，每日同题使用固定装扮和初始连段。
- Indy、Nosegrab 和 Tailgrab 按单板赛事的抓板部位绘制。开场以侧视投影表现横向转体，正式雪道用原有的侧视翻转与对坡判定。参考 [FIS 单板动作表](https://www.fis-ski.com/DB/v2/tricks?discipline=SB&event=HP) 和 [大跳台世界杯赛例](https://www.fis-ski.com/snowboard-park-and-pipe/news/2022-23/first-timer-fukada-and-one-of-a-kind-kleveland-claim-big-air-wins)。
- src/scenes/art.ts 为本作原创程序绘制的雪山、松林、滑手骨架、雪板与雪粉。音效由 tools/sounds.py 在本地合成，渲染使用系统字体。Phaser 和构建工具许可证见各自包内 LICENSE。
- src/platform 独占 half-turn.ski.v1 存档和本作广告位配置。开通后填写 .env.production.local 重新构建。预览环境无可用广告时返回原入口。真实宿主完播回调才发奖，记录在同笔存档写入中。
- 首发候选必须补录 Android/iOS 支持入口的触控、后台恢复、20 分钟稳定性、10 Mbps 冷热启动，以及私有二维码验证。平台曝光、收入、认证状态和审核结果取开发者后台。

## 商店资料草稿

**再翻半圈** · 单指花式滑雪

再多翻半圈就能破纪录。你敢在哪一刻松手？沿松林、峡谷与极夜山脊滑行，在跳台前屈膝、松手起跳，空中收腿多转半圈。正滑和倒滑都能漂亮落地。三座山共十五条线路，另有三个自由练习台与北京时间轮换的每日表演赛。

内容为风格化体育竞技，失误表现为滑手跌入雪中。实际适龄分级、客服联系方式及主体资料由发行账号填写。成绩、装扮、票券和诊断事件保存在当前浏览器，清除网站数据会清除进度。事件导出由玩家主动触发。选择广告时由 TapTap 宿主提供视频服务，正式接入后按实际广告 SDK 和主体补全隐私政策。

