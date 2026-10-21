import Cocoa
import WebKit

final class KiratApp: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var web: WKWebView!
    var project = ""
    let base = URL(string: "http://127.0.0.1:4173/")!
    var starting = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        let menu = NSMenu()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About Kirat Lead Desk", action: #selector(about), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Restart Local Service", action: #selector(restart), keyEquivalent: "r")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Quit Kirat Lead Desk", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        let appItem = NSMenuItem(); appItem.submenu = appMenu; menu.addItem(appItem)
        let edit = NSMenu(title: "Edit")
        for (title, action, key) in [("Undo", "undo:", "z"), ("Cut", "cut:", "x"), ("Copy", "copy:", "c"), ("Paste", "paste:", "v"), ("Select All", "selectAll:", "a")] {
            edit.addItem(withTitle: title, action: Selector(action), keyEquivalent: key)
        }
        let editItem = NSMenuItem(); editItem.submenu = edit; menu.addItem(editItem)
        NSApp.mainMenu = menu
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1280, height: 840), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "Kirat Lead Desk"
        window.minSize = NSSize(width: 820, height: 600)
        window.delegate = self
        window.center()
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.userContentController.add(self, name: "kiratLog")
        config.userContentController.addUserScript(WKUserScript(source: "window.KiratNative=true;", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        config.userContentController.addUserScript(WKUserScript(source: "window.addEventListener('error',e=>window.webkit.messageHandlers.kiratLog.postMessage(String(e.message)+' at '+String(e.lineno)));", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        web = WKWebView(frame: window.contentView!.bounds, configuration: config)
        web.autoresizingMask = [.width, .height]
        web.navigationDelegate = self; web.uiDelegate = self
        window.contentView!.addSubview(web)
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        do {
            guard let file = Bundle.main.url(forResource: "project-path", withExtension: "txt") else { throw NSError(domain:"Kirat",code:1,userInfo:[NSLocalizedDescriptionKey:"Project path is missing. Reinstall the launcher."]) }
            project = try String(contentsOf: file, encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines)
            startBackend()
        } catch { showError(error.localizedDescription) }
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard !project.isEmpty else { return }
        let url = URL(fileURLWithPath: project + "/.local/native-error.log")
        try? String(describing: message.body).write(to: url, atomically: true, encoding: .utf8)
    }
    @objc func about() {
        let alert = NSAlert(); alert.messageText = "Kirat Lead Desk"
        alert.informativeText = "Local lead research for Kirat Creations. Your register stays on this Mac. Research uses your local Codex login."
        alert.runModal()
    }
    @objc func restart() { startBackend() }
    func startBackend() {
        guard !starting else { return }; starting = true
        web.loadHTMLString("<html><body style='font:20px -apple-system;padding:70px;background:#fffcf5;color:#24211d'><h1>Kirat Lead Desk</h1><p>Starting your local app…</p></body></html>", baseURL: nil)
        let task = Process(); task.executableURL = URL(fileURLWithPath: "/bin/zsh")
        task.arguments = [project + "/scripts/launch-mac.sh", "--no-open"]
        let pipe = Pipe(); task.standardOutput = pipe; task.standardError = pipe
        task.terminationHandler = { [weak self] process in
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            DispatchQueue.main.async {
                guard let self = self else { return }; self.starting = false
                if process.terminationStatus == 0 { self.web.load(URLRequest(url: self.base)) }
                else { self.showError(String(data:data,encoding:.utf8) ?? "Could not start the local service.") }
            }
        }
        do { try task.run() } catch { starting = false; showError(error.localizedDescription) }
    }
    func showError(_ text: String) {
        let alert = NSAlert(); alert.messageText = "Kirat could not start"
        alert.informativeText = text; alert.addButton(withTitle:"OK"); alert.runModal()
    }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        window.makeKeyAndOrderFront(nil); return true
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        guard web != nil else { return .terminateNow }
        web.configuration.websiteDataStore.httpCookieStore.getAllCookies { cookies in
            var request = URLRequest(url:self.base.appendingPathComponent("api/quit"))
            request.httpMethod = "POST"; request.timeoutInterval = 3
            request.setValue("application/json",forHTTPHeaderField:"Content-Type")
            request.setValue("1",forHTTPHeaderField:"X-Kirat-Local")
            request.setValue("http://127.0.0.1:4173",forHTTPHeaderField:"Origin")
            request.setValue(cookies.filter{$0.name == "kirat_session"}.map{"\($0.name)=\($0.value)"}.joined(separator:"; "),forHTTPHeaderField:"Cookie")
            request.httpBody = Data("{}".utf8)
            URLSession.shared.dataTask(with:request) { _,_,_ in DispatchQueue.main.async { sender.reply(toApplicationShouldTerminate:true) } }.resume()
        }
        return .terminateLater
    }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if action.shouldPerformDownload { decisionHandler(.download); return }
        if let url = action.request.url, action.navigationType == .linkActivated, url.scheme != "blob", url.host != "127.0.0.1" {
            NSWorkspace.shared.open(url); decisionHandler(.cancel); return
        }
        decisionHandler(.allow)
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url { NSWorkspace.shared.open(url) }; return nil
    }
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { download.delegate = self }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let panel = NSSavePanel(); panel.nameFieldStringValue = suggestedFilename
        panel.beginSheetModal(for:window) { response in completionHandler(response == .OK ? panel.url : nil) }
    }
    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) { showError("Download failed: " + error.localizedDescription) }
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel=NSOpenPanel();panel.allowsMultipleSelection=parameters.allowsMultipleSelection;panel.canChooseDirectories=false
        panel.beginSheetModal(for:window) { response in completionHandler(response == .OK ? panel.urls : nil) }
    }
}
let application = NSApplication.shared
let delegate = KiratApp()
application.delegate = delegate
application.run()
