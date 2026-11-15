// swift-tools-version: 5.8

// 写字岛的 iPadOS App 工程（Swift Playgrounds App 格式）。
// 可以直接用 iPad 上的 Swift Playgrounds 打开，也可以用 Mac 上的 Xcode 打开。

import PackageDescription
import AppleProductTypes

let package = Package(
    name: "WritingIsland",
    platforms: [
        .iOS("16.0")
    ],
    products: [
        .iOSApplication(
            name: "写字岛",
            targets: ["AppModule"],
            bundleIdentifier: "com.example.writingisland",
            teamIdentifier: "",
            displayVersion: "1.0",
            bundleVersion: "1",
            appIcon: .asset("AppIcon"),
            accentColor: .presetColor(.blue),
            supportedDeviceFamilies: [
                .pad,
                .phone
            ],
            supportedInterfaceOrientations: [
                .portrait,
                .landscapeRight,
                .landscapeLeft,
                .portraitUpsideDown(.when(deviceFamilies: [.pad]))
            ]
        )
    ],
    targets: [
        .executableTarget(
            name: "AppModule",
            path: "."
        )
    ]
)
