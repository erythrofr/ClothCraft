import AppKit
import Foundation
import WebKit

/// Native AppKit application window. Its interface and tools are bundled inside
/// the signed app, not opened in Safari, Chrome, or an external browser window.
final class EXOClothCraftApp: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKDownloadDelegate {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var processes: [Process] = []
    private var startupAttempts = 0
    private let pageURL = URL(string: "http://127.0.0.1:5284/?desktop=1")!
    private var startupLabel: NSTextField!
    private var logs: FileHandle?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        installMenu()
        window = NSWindow(contentRect: NSRect(x: 70, y: 60, width: 1510, height: 965),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable],
                          backing: .buffered, defer: false)
        window.title = "EXO Sample 3D × ClothCraft"
        window.minSize = NSSize(width: 970, height: 650)
        window.center()

        let root = NSView(frame: window.contentView!.bounds)
        root.autoresizingMask = [.width, .height]
        root.wantsLayer = true
        root.layer?.backgroundColor = NSColor(calibratedWhite: 0.10, alpha: 1).cgColor
        window.contentView = root

        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.websiteDataStore = .default()
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.navigationDelegate = self
        webView.underPageBackgroundColor = NSColor(calibratedWhite: 0.10, alpha: 1)
        if #available(macOS 13.3, *) { webView.isInspectable = true }
        root.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: root.topAnchor),
            webView.bottomAnchor.constraint(equalTo: root.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: root.trailingAnchor),
        ])
        startupLabel = NSTextField(labelWithString: "Starting EXO Sample 3D and ClothCraft Rust…")
        startupLabel.textColor = .white
        startupLabel.font = .systemFont(ofSize: 19, weight: .medium)
        startupLabel.alignment = .center
        startupLabel.translatesAutoresizingMaskIntoConstraints = false
        root.addSubview(startupLabel)
        NSLayoutConstraint.activate([
            startupLabel.centerXAnchor.constraint(equalTo: root.centerXAnchor),
            startupLabel.centerYAnchor.constraint(equalTo: root.centerYAnchor),
        ])

        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        do {
            try startServices()
            awaitPage()
        } catch {
            startupLabel.stringValue = "Could not start local ClothCraft services: \(error.localizedDescription)"
            NSLog("EXO startup error: %@", error.localizedDescription)
        }
    }

    private func startServices() throws {
        guard let resources = Bundle.main.resourceURL else {
            throw NSError(domain: "EXO", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "App resources are missing"])
        }
        let node = resources.appendingPathComponent("bin/node")
        let scripts = resources.appendingPathComponent("integrations/clothcraft")
        let clothCraft = resources.appendingPathComponent("research/oss/clothcraft")
        let template = clothCraft.appendingPathComponent("target/debug/cloth-template")
        let fitting = clothCraft.appendingPathComponent("target/debug/cloth-fit")
        let native = resources.appendingPathComponent("native_cpp/build-cmake/garment_cad_cli")
        for required in [node, template, fitting, native,
                         resources.appendingPathComponent("web/index.html")] {
            if !FileManager.default.fileExists(atPath: required.path) {
                throw NSError(domain: "EXO", code: 2,
                              userInfo: [NSLocalizedDescriptionKey: "Missing bundled resource: \(required.lastPathComponent)"])
            }
        }
        let logsDir = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Logs/EXO-Sample-3D-ClothCraft", isDirectory: true)
        try FileManager.default.createDirectory(at: logsDir, withIntermediateDirectories: true)
        let outputsDir = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/EXO-Sample-3D-ClothCraft/Output", isDirectory: true)
        try FileManager.default.createDirectory(at: outputsDir, withIntermediateDirectories: true)
        let log = logsDir.appendingPathComponent("desktop.log")
        if !FileManager.default.fileExists(atPath: log.path) {
            FileManager.default.createFile(atPath: log.path, contents: Data())
        }
        logs = try FileHandle(forWritingTo: log)
        try logs?.seekToEnd()
        let configurations: [(String, [String: String])] = [
            ("static.mjs", ["EXO_WEB_PORT": "5284"]),
            ("server.mjs", ["EXO_CLOTHCRAFT_PORT": "5283"]),
        ]
        for (script, extra) in configurations {
            let p = Process()
            p.executableURL = node
            p.arguments = [scripts.appendingPathComponent(script).path]
            p.currentDirectoryURL = resources
            var environment = ProcessInfo.processInfo.environment
            environment["EXO_CLOTHCRAFT_REPO"] = clothCraft.path
            environment["EXO_CLOTHCRAFT_TEMPLATE_BIN"] = template.path
            environment["EXO_CLOTHCRAFT_FIT_BIN"] = fitting.path
            environment["EXO_NATIVE_CLI"] = native.path
            environment["EXO_CLOTHCRAFT_OUTPUT_DIR"] = outputsDir.path
            environment["EXO_CLOTHCRAFT_AVATAR_THOMAS_OBJ"] = resources.appendingPathComponent("collision-avatars/thomas-body.obj").path
            environment["EXO_CLOTHCRAFT_AVATAR_MAKEHUMAN_OBJ"] = resources.appendingPathComponent("collision-avatars/makehuman-body.obj").path
            extra.forEach { environment[$0.key] = $0.value }
            p.environment = environment
            p.standardOutput = logs
            p.standardError = logs
            try p.run()
            processes.append(p)
        }
    }

    private func awaitPage() {
        startupAttempts += 1
        let request = URLRequest(url: pageURL, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 2)
        URLSession.shared.dataTask(with: request) { [weak self] _, response, _ in
            guard let self else { return }
            let good = (response as? HTTPURLResponse)?.statusCode == 200
            DispatchQueue.main.async {
                if good {
                    self.webView.load(URLRequest(url: self.pageURL))
                } else if self.startupAttempts < 80 {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { self.awaitPage() }
                } else {
                    self.startupLabel.stringValue = "The EXO app service did not start; check ~/Library/Logs/EXO-Sample-3D-ClothCraft/desktop.log"
                }
            }
        }.resume()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        startupLabel.removeFromSuperview()
        window.title = "EXO Sample 3D × ClothCraft"
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        decisionHandler(navigationAction.shouldPerformDownload ? .download : .allow)
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse,
                  suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let folder = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Downloads", isDirectory: true)
        let name = (suggestedFilename as NSString).lastPathComponent
        let base = URL(fileURLWithPath: name).deletingPathExtension().lastPathComponent
        let ext = URL(fileURLWithPath: name).pathExtension
        var candidate = folder.appendingPathComponent(name)
        var i = 1
        while FileManager.default.fileExists(atPath: candidate.path) {
            let variant = ext.isEmpty ? "\(base)-\(i)" : "\(base)-\(i).\(ext)"
            candidate = folder.appendingPathComponent(variant)
            i += 1
        }
        completionHandler(candidate)
    }

    @objc private func reloadWorkspace(_ sender: Any?) {
        webView?.reload()
    }

    private func installMenu() {
        let main = NSMenu()
        let appItem = NSMenuItem()
        let appMenu = NSMenu(title: "EXO Sample 3D")
        appMenu.addItem(withTitle: "About EXO Sample 3D", action: #selector(NSApp.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Quit EXO Sample 3D", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        main.addItem(appItem)
        let viewItem = NSMenuItem()
        let viewMenu = NSMenu(title: "View")
        viewMenu.addItem(withTitle: "Reload Workspace", action: #selector(reloadWorkspace(_:)), keyEquivalent: "r")
        viewItem.submenu = viewMenu
        main.addItem(viewItem)
        NSApp.mainMenu = main
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    func applicationWillTerminate(_ notification: Notification) {
        processes.forEach { process in if process.isRunning { process.terminate() } }
        try? logs?.close()
    }
}

@main
enum EXOClothCraftEntry {
    static func main() {
        let app = NSApplication.shared
        let delegate = EXOClothCraftApp()
        app.delegate = delegate
        app.run()
    }
}
