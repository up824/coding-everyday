import SwiftUI
import WebKit
import AVFoundation

// 显示网页的视图。Apple Pencil 的笔迹由网页里的 Pointer Events 处理（有压感），这里不需要额外代码。
struct WebScreen: UIViewRepresentable {
    func makeCoordinator() -> Bridge {
        Bridge()
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        // 不要文字选择、放大镜这些，写字时会碍事
        config.preferences.isTextInteractionEnabled = false
        config.userContentController.add(context.coordinator, name: "wi")
        config.userContentController.addUserScript(
            WKUserScript(
                source: context.coordinator.bootScript(),
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
        )

        let web = WKWebView(frame: .zero, configuration: config)
        let sky = UIColor(red: 0.894, green: 0.953, blue: 1.0, alpha: 1.0)
        web.isOpaque = false
        web.backgroundColor = sky
        web.scrollView.backgroundColor = sky
        // 整页不滚动、不回弹；页面内部的列表自己会滚
        web.scrollView.isScrollEnabled = false
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.allowsLinkPreview = false
        web.allowsBackForwardNavigationGestures = false
        // 页面内容是 Page.swift 里的字符串；给它一个固定的地址，网页自己的本地存储才有地方放
        web.loadHTMLString(pageHTML, baseURL: URL(string: "https://writing-island.invalid/"))
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {
    }
}

// 网页和原生之间的桥：存档、朗读、屏幕常亮。
// 网页那一侧见 src/store.js 里的 native()，消息格式是 {type: "save" | "speak" | "awake", ...}。
final class Bridge: NSObject, WKScriptMessageHandler {
    private let speaker = AVSpeechSynthesizer()

    // 进度存成 App 自己的文件，比网页的本地存储牢靠，也会跟着设备备份走
    private let saveURL: URL = {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("progress.json")
    }()

    // 页面加载前执行：告诉网页它在 App 里，并把上次保存的进度交给它
    func bootScript() -> String {
        var literal = "[\"\"]"
        if let saved = try? String(contentsOf: saveURL, encoding: .utf8),
           let data = try? JSONSerialization.data(withJSONObject: [saved]),
           let text = String(data: data, encoding: .utf8) {
            literal = text
        }
        return "window.WI_NATIVE = true; window.__WI_SAVE__ = (" + literal + ")[0];"
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else {
            return
        }
        if type == "save" {
            if let json = body["data"] as? String {
                try? json.write(to: saveURL, atomically: true, encoding: .utf8)
            }
        } else if type == "speak" {
            guard let text = body["text"] as? String else {
                return
            }
            let language = (body["lang"] as? String) ?? "zh-CN"
            let utterance = AVSpeechUtterance(string: text)
            utterance.voice = AVSpeechSynthesisVoice(language: language)
            utterance.rate = AVSpeechUtteranceDefaultSpeechRate * 0.9
            speaker.stopSpeaking(at: .immediate)
            speaker.speak(utterance)
        } else if type == "awake" {
            // 练字时不让屏幕自动熄灭，离开练字页就恢复
            UIApplication.shared.isIdleTimerDisabled = (body["on"] as? Bool) ?? false
        }
    }
}
