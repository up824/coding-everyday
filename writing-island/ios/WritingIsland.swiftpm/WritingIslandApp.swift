import SwiftUI

// 写字岛：整个界面是一张编进 App 里的网页（见 Page.swift），这里只负责把它全屏显示出来。
@main
struct WritingIslandApp: App {
    var body: some Scene {
        WindowGroup {
            WebScreen()
                .ignoresSafeArea()
                .statusBarHidden(true)
                // 孩子写到屏幕边缘时，不要一下子就触发系统手势、弹出底部横条
                .persistentSystemOverlays(.hidden)
                .defersSystemGestures(on: .all)
        }
    }
}
