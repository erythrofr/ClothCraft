import AppKit
import WebKit

/// Supplies bundled Vite output to WebKit without a web server, SSH tunnel,
/// internet access or hard-coded machine paths. This is a transitional full-UI
/// workspace while the Qt/C++ native implementation is under development.
final class BundledWorkspaceSchemeHandler: NSObject, WKURLSchemeHandler {
    private let baseURL: URL
    init(baseURL: URL) { self.baseURL = baseURL.standardizedFileURL }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url, url.scheme == "garmentstudio", url.host == "app" else {
            urlSchemeTask.didFailWithError(NSError(domain: "GarmentStudioBundle", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid bundled app URL"]))
            return
        }
        let decoded = url.path.removingPercentEncoding ?? url.path
        let path = (decoded == "/" || decoded.isEmpty) ? "index.html" : String(decoded.drop(while: { $0 == "/" }))
        let resource = baseURL.appendingPathComponent(path).standardizedFileURL
        guard resource.path.hasPrefix(baseURL.path + "/"), !path.contains("\\"),
              FileManager.default.fileExists(atPath: resource.path) else {
            urlSchemeTask.didFailWithError(NSError(domain: "GarmentStudioBundle", code: 404, userInfo: [NSLocalizedDescriptionKey: "Missing resource: \(path)"]))
            return
        }
        let ext = resource.pathExtension.lowercased()
        let mime: String
        switch ext {
        case "html": mime = "text/html"
        case "js", "mjs": mime = "text/javascript"
        case "css": mime = "text/css"
        case "json": mime = "application/json"
        case "svg": mime = "image/svg+xml"
        case "png": mime = "image/png"
        case "jpg", "jpeg": mime = "image/jpeg"
        case "webp": mime = "image/webp"
        case "glb": mime = "model/gltf-binary"
        case "gltf": mime = "model/gltf+json"
        case "obj": mime = "text/plain"
        case "woff2": mime = "font/woff2"
        default: mime = "application/octet-stream"
        }
        do {
            let payload = try Data(contentsOf: resource, options: .mappedIfSafe)
            let response = URLResponse(url: url, mimeType: mime, expectedContentLength: payload.count, textEncodingName: ext == "html" || ext == "js" || ext == "css" ? "utf-8" : nil)
            urlSchemeTask.didReceive(response)
            urlSchemeTask.didReceive(payload)
            urlSchemeTask.didFinish()
        } catch {
            urlSchemeTask.didFailWithError(error)
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}
}

extension NativeApp {
    func createCompleteWorkspace() -> NSView? {
        guard let resourceURL = Bundle.main.resourceURL,
              FileManager.default.fileExists(atPath: resourceURL.appendingPathComponent("web/index.html").path) else { return nil }
        let root = NSView()
        root.wantsLayer = true
        root.layer?.backgroundColor = NSColor(calibratedWhite: 0.055, alpha: 1).cgColor
        let configuration = WKWebViewConfiguration()
        let handler = BundledWorkspaceSchemeHandler(baseURL: resourceURL.appendingPathComponent("web"))
        configuration.setURLSchemeHandler(handler, forURLScheme: "garmentstudio")
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.websiteDataStore = .default()
        let web = WKWebView(frame: .zero, configuration: configuration)
        if #available(macOS 13.3, *) { web.isInspectable = true }
        web.translatesAutoresizingMaskIntoConstraints = false
        web.underPageBackgroundColor = NSColor(calibratedWhite: 0.05, alpha: 1)
        root.addSubview(web)
        NSLayoutConstraint.activate([
            web.topAnchor.constraint(equalTo: root.topAnchor),
            web.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            web.bottomAnchor.constraint(equalTo: root.bottomAnchor)
        ])
        fullWebView = web
        bundledSchemeHandler = handler
        let privateAvatar = FileManager.default.fileExists(atPath: resourceURL.appendingPathComponent("web/avatars/clo-thomas.glb").path)
        let teeTestSession = CommandLine.arguments.contains("--tee-test")
        let startup = "garmentstudio://app/index.html?desktop=1" +
            (privateAvatar ? "&defaultAvatar=clo-thomas" : "") +
            (teeTestSession ? "&testSession=tee" : "")
        web.load(URLRequest(url: URL(string: startup)!))
        return root
    }

    func showCompleteWorkspace() {
        installWorkspaceMenu()
        if fullWorkspaceRoot == nil { fullWorkspaceRoot = createCompleteWorkspace() }
        guard let root = fullWorkspaceRoot else { return }
        window.contentView = root
        window.title = "Garment Studio — Full Workspace"
    }

    @objc func showNativePreview() {
        guard let nativeRoot else { return }
        window.contentView = nativeRoot
        window.title = "Garment Studio — Native XPBD Preview"
        DispatchQueue.main.async {
            nativeRoot.layoutSubtreeIfNeeded()
            if let split = self.nativeSplit, split.bounds.width > 200 {
                split.adjustSubviews()
                split.setPosition(split.bounds.width * 0.55, ofDividerAt: 0)
            }
        }
    }

    @objc func returnToCompleteWorkspace() { showCompleteWorkspace() }

    @objc func reloadCompleteWorkspace() {
        fullWebView?.reload()
    }

    // Mirror real CLO menu headings in the macOS menu bar. Commands are routed
    // into the same React editor handlers as the in-workspace menu buttons.
    @objc func dispatchWebCommand(_ sender: NSMenuItem) {
        guard let command = sender.representedObject as? String,
              let data = try? JSONSerialization.data(withJSONObject: command, options: .fragmentsAllowed),
              let quoted = String(data: data, encoding: .utf8) else { return }
        let script = "window.dispatchEvent(new CustomEvent('garment-studio-native-action', { detail: \(quoted) }))"
        if fullWebView == nil { showCompleteWorkspace() }
        fullWebView?.evaluateJavaScript(script, completionHandler: { _, error in
            if let error { NSLog("Garment Studio menu command error: %@", error.localizedDescription) }
        })
    }

    func installWorkspaceMenu() {
        let mainMenu = NSMenu(title: "Garment Studio")
        let appMenuItem = NSMenuItem()
        let appMenu = NSMenu(title: "Garment Studio")
        appMenu.addItem(withTitle: "About Garment Studio", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Quit Garment Studio", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appMenuItem.submenu = appMenu
        mainMenu.addItem(appMenuItem)

        let editorMenus: [(String, [(String, String?, String)])] = [
            ("File", [("New Garment", "file.new", "n"), ("Open Garment…", "file.open", "o"), ("Save Project", "file.save", "s"), ("Export Garment…", "file.export", "")]),
            ("Edit", [("Undo", "edit.undo", "z"), ("Redo", "edit.redo", ""), ("Delete Selected Pattern", "edit.delete", "")]),
            ("3D Garment", [("Simulate / Pause", "3d.simulate", ""), ("Reset Simulation", "3d.reset", ""), ("Orbit", "3d.orbit", ""), ("Move Garment", "3d.move", ""), ("Rotate Garment", "3d.rotate", ""), ("Fabric Hand", "3d.hand", ""), ("Show Sewing Guides", "3d.seams", ""), ("Fit Map", "3d.fit", "")]),
            ("2D Pattern", [("Transform Pattern", "2d.select", ""), ("Edit Points", "2d.points", ""), ("Split Line", "2d.split", ""), ("Edit Curvature", "2d.curve", ""), ("Internal Line / Dart", "2d.internal", ""), ("Add Notch", "2d.notch", ""), ("Add Pattern", "2d.add", "")]),
            ("Sewing", [("Free Sewing", "sewing.sew", ""), ("Inspect Sewing", "sewing.inspect", ""), ("Fastener", "sewing.fastener", "")]),
            ("Materials", [("Fabric Browser", "materials.fabric", ""), ("Edit Fabric", "materials.edit", ""), ("Add Fabric", "materials.add", ""), ("Graphic / Texture", "materials.graphic", "")]),
            ("Editor", [("Pattern Editor", "2d.select", ""), ("Fabric Editor", "materials.fabric", ""), ("Production", "workspace.production", "")]),
            ("Avatar", [("Avatar Library", "avatar.library", ""), ("Avatar Properties", "avatar.properties", ""), ("Import Avatar…", "avatar.import", "")]),
            ("Animation", [("Animation Workspace (planned)", nil, "")]),
            ("Render", [("Render Workspace", "render.workspace", ""), ("Capture Still", "render.capture", "")]),
            ("Display", [("3D Surface View", "display.surface", ""), ("Wireframe", "display.wireframe", ""), ("Stress / Strain", "display.strain", ""), ("2D Grid", "display.grid", "")]),
            ("Preferences", [("Workspace Settings", "settings.workspace", ""), ("Edit Shortcuts (planned)", nil, "")]),
            ("Settings", [("Simulation Quality", "settings.simulation", ""), ("Fabric Defaults", "materials.fabric", "")]),
            ("Help", [("Control Reference", "help.reference", ""), ("Keyboard Guide", "help.shortcuts", "")]),
        ]
        for (name, commands) in editorMenus {
            let parent = NSMenuItem()
            let submenu = NSMenu(title: name)
            for (label, command, shortcut) in commands {
                let item = NSMenuItem(title: label, action: command == nil ? nil : #selector(dispatchWebCommand(_:)), keyEquivalent: shortcut)
                item.target = self
                item.representedObject = command
                item.isEnabled = command != nil
                submenu.addItem(item)
            }
            parent.submenu = submenu
            mainMenu.addItem(parent)
        }

        let workspaceItem = NSMenuItem()
        let workspaceMenu = NSMenu(title: "Workspace")
        let fullItem = workspaceMenu.addItem(withTitle: "Full 3D + 2D Workspace", action: #selector(returnToCompleteWorkspace), keyEquivalent: "1")
        fullItem.target = self
        let nativeItem = workspaceMenu.addItem(withTitle: "Native XPBD Preview", action: #selector(showNativePreview), keyEquivalent: "2")
        nativeItem.target = self
        workspaceMenu.addItem(NSMenuItem.separator())
        let reloadItem = workspaceMenu.addItem(withTitle: "Reload Interface", action: #selector(reloadCompleteWorkspace), keyEquivalent: "r")
        reloadItem.target = self
        workspaceItem.submenu = workspaceMenu
        mainMenu.addItem(workspaceItem)
        NSApplication.shared.mainMenu = mainMenu
    }
}
