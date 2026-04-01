import UIKit
import Capacitor

/// Disables the rubber-band bounce effect on the WKWebView
/// so that overscroll doesn't reveal a black background.
class DisableBouncePlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "DisableBouncePlugin"
    let jsName = "DisableBounce"
    let pluginMethods: [CAPPluginMethod] = []

    override func load() {
        DispatchQueue.main.async { [weak self] in
            guard let webView = self?.bridge?.webView else { return }
            webView.scrollView.bounces = false
            webView.scrollView.alwaysBounceVertical = false
            webView.scrollView.alwaysBounceHorizontal = false
        }
    }
}
