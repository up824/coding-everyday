# 写字岛 iPadOS App

`WritingIsland.swiftpm` 是一个 Swift Playgrounds App 工程：把写字岛的网页整个编进 App 里，用系统的网页视图全屏显示。
App 不联网也能用，Apple Pencil 的压感和防误触和网页版一样。

和网页版相比，App 多了三件事：

- 进度另外存成 App 自己的文件（`Application Support/progress.json`），比浏览器存储牢靠，也会跟着设备备份走
- 朗读题目用系统的语音
- 练字时屏幕不会自动熄灭

> 状态：这个工程是在没有 Xcode 的环境里写的，**还没有实际编译和上机运行过**。网页一侧（包括和 App 通信的部分）
> 有自动测试，Swift 一侧没有。第一次打开如果报错，把报错信息原样贴出来就能对症修。

## 在 iPad 上直接运行（不需要 Mac）

1. 在 iPad 上从 App Store 安装 **Swift Playgrounds**（免费）。
2. 把 `WritingIsland.swiftpm` 这个文件夹放进 iPad 的「文件」App（比如下载压缩包后解压）。
3. 在「文件」里点 `WritingIsland.swiftpm`，它会在 Swift Playgrounds 里打开。
4. 点运行按钮，App 就全屏跑起来了。

工程里的 `Page.swift` 是自动生成的一整张网页（很长），不需要打开它。

## 在 Mac 上用 Xcode

1. 用 Xcode 打开 `WritingIsland.swiftpm`。
2. 在工程设置的 Signing 里选自己的 Team，并把 Bundle Identifier 从 `com.example.writingisland` 改成自己的（要全球唯一）。
3. 用数据线连上 iPad，选它作为运行目标，点 Run。

用免费的 Apple ID 也能装到自己的 iPad 上，但 7 天后需要重新安装；加入 Apple Developer Program 后没有这个限制。

## 发给别人用

要让别人安装，只有 TestFlight 或 App Store 这两条路，都需要加入 Apple Developer Program（每年 99 美元），
上架还要通过审核。Swift Playgrounds 和 Xcode 都可以把 App 上传到 App Store Connect。

这个 App 不收集任何数据、不联网、没有广告和第三方代码。如果放在「儿童」类别，苹果还要求提供隐私政策页面。

## 网页改了以后

App 里的页面来自 `Page.swift`，由构建脚本生成。改完 `src/` 里的文件后，在上一级目录运行：

```
node build.mjs
```
