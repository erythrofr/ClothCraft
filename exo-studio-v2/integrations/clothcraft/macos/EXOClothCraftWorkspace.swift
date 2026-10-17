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
    private let pageURL = URL(string: "http://127.0.0.1:5286/?desktop=1&engine=clothcraft")!
    private var startupLabel: NSTextField!
    private var logs: FileHandle?

    private func traceStartup(_ message: String) {
        let directory = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Logs/EXO-ClothCraft-Studio", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let file = directory.appendingPathComponent("startup-trace.log")
        if !FileManager.default.fileExists(atPath: file.path) {
            FileManager.default.createFile(atPath: file.path, contents: Data())
        }
        if let handle = try? FileHandle(forWritingTo: file) {
            _ = try? handle.seekToEnd()
            try? handle.write(contentsOf: Data("\(Date()) \(message)\n".utf8))
            try? handle.close()
        }
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        traceStartup("applicationDidFinishLaunching")
        NSApp.setActivationPolicy(.regular)
        installMenu()
        window = NSWindow(contentRect: NSRect(x: 70, y: 60, width: 1510, height: 965),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable],
                          backing: .buffered, defer: false)
        window.title = "EXO ClothCraft Studio"
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
        startupLabel = NSTextField(labelWithString: "Starting EXO ClothCraft Studio…")
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
        traceStartup("window prepared; starting services")
        do {
            try startServices()
            traceStartup("services spawned; awaiting web page")
            awaitPage()
        } catch {
            traceStartup("startup error: \(error.localizedDescription)")
            startupLabel.stringValue = "Could not start local ClothCraft services: \(error.localizedDescription)"
            NSLog("EXO startup error: %@", error.localizedDescription)
        }
    }

    private func startServices() throws {
        guard let resources = Bundle.main.resourceURL else {
            throw NSError(domain: "EXO", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "App resources are missing"])
        }
        let bundledNode = resources.appendingPathComponent("bin/node")
        // Some macOS installations terminate a signed Node executable when it
        // lives inside this app's Resources directory (SIGKILL/137), even though
        // that same official Node binary and signature run correctly elsewhere.
        // Clone our bundled runtime to user Application Support once, retaining
        // the Node Foundation signature and keeping the app fully offline.
        let runtimeFolder = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/EXO-ClothCraft-Studio/Runtime", isDirectory: true)
        try FileManager.default.createDirectory(at: runtimeFolder, withIntermediateDirectories: true)
        let node = runtimeFolder.appendingPathComponent("node")
        let sourceInfo = try FileManager.default.attributesOfItem(atPath: bundledNode.path)
        let cachedInfo = try? FileManager.default.attributesOfItem(atPath: node.path)
        let sizeMatches = (cachedInfo?[.size] as? NSNumber) == (sourceInfo[.size] as? NSNumber)
        let timeMatches = (cachedInfo?[.modificationDate] as? Date) == (sourceInfo[.modificationDate] as? Date)
        if !sizeMatches || !timeMatches {
            if FileManager.default.fileExists(atPath: node.path) {
                try FileManager.default.removeItem(at: node)
            }
            try FileManager.default.copyItem(at: bundledNode, to: node)
        }
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
            .appendingPathComponent("Library/Logs/EXO-ClothCraft-Studio", isDirectory: true)
        try FileManager.default.createDirectory(at: logsDir, withIntermediateDirectories: true)
        let outputsDir = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/EXO-ClothCraft-Studio/Output", isDirectory: true)
        try FileManager.default.createDirectory(at: outputsDir, withIntermediateDirectories: true)
        let log = logsDir.appendingPathComponent("desktop.log")
        if !FileManager.default.fileExists(atPath: log.path) {
            FileManager.default.createFile(atPath: log.path, contents: Data())
        }
        logs = try FileHandle(forWritingTo: log)
        try logs?.seekToEnd()
        let configurations: [(String, [String: String])] = [
            ("static.mjs", ["EXO_WEB_PORT": "5286"]),
            ("server.mjs", ["EXO_CLOTHCRAFT_PORT": "5285"]),
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
            environment["EXO_CLOTHCRAFT_GPU"] = "1"
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
                    self.startupLabel.stringValue = "The EXO app service did not start; check ~/Library/Logs/EXO-ClothCraft-Studio/desktop.log"
                }
            }
        }.resume()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        startupLabel.removeFromSuperview()
        window.title = "EXO ClothCraft Studio"
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
        let appMenu = NSMenu(title: "EXO ClothCraft Studio")
        appMenu.addItem(withTitle: "About EXO ClothCraft Studio", action: #selector(NSApp.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Quit EXO ClothCraft Studio", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
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
        // NSApplication.delegate is weak. Keep our delegate strongly alive
        // for the entire event loop, including optimized (-O) release builds.
        // Otherwise the window can restore without startup services running.
        withExtendedLifetime(delegate) { app.run() }
    }
}
