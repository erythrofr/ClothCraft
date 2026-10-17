import AppKit
import SceneKit
import WebKit

// Native macOS proof-of-foundation. Reads the existing native XPBD payload
// without changing the garment schema, physics or any original project files.
struct Panel {
    let id: String
    let name: String
    let indices: [Int]
    let flat: [SIMD3<Double>]
    let faces: [[Int]]
}

final class GarmentDocument {
    var panels: [Panel] = []
    var particles: [SIMD3<Double>] = []
    var seamPairs: [(Int, Int)] = []
    var seamNames: [String] = []
    var title = "Untitled Garment"

    init(url: URL) throws {
        let root = try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any] ?? [:]
        guard root["protocol"] as? String == "garment-studio.native-xpbd",
              let rawPanels = root["pieces"] as? [[String: Any]],
              let rawParticles = root["particles"] as? [[String: Any]] else {
            throw NSError(domain: "GarmentStudio", code: 1, userInfo: [NSLocalizedDescriptionKey: "Select a Garment Studio native XPBD JSON fixture."])
        }
        func vec(_ value: Any?) -> SIMD3<Double> {
            let a = value as? [NSNumber] ?? []
            return SIMD3(a.count > 0 ? a[0].doubleValue : 0, a.count > 1 ? a[1].doubleValue : 0, a.count > 2 ? a[2].doubleValue : 0)
        }
        particles = rawParticles.map { vec($0["position"]) }
        panels = rawPanels.map { item in
            Panel(id: item["id"] as? String ?? "panel", name: item["name"] as? String ?? "Panel",
                  indices: item["particleIndices"] as? [Int] ?? [],
                  flat: (item["flatVerticesM"] as? [[NSNumber]] ?? []).map { vec($0) },
                  faces: item["faces"] as? [[Int]] ?? [])
        }
        for item in root["constraints"] as? [[String: Any]] ?? [] {
            guard item["type"] as? String == "seam", let a = item["a"] as? Int, let b = item["b"] as? Int,
                  a >= 0, b >= 0, a < particles.count, b < particles.count else { continue }
            seamPairs.append((a,b))
            seamNames.append(item["seamId"] as? String ?? "unnamed-seam")
        }
        title = (root["project"] as? [String: Any])?["name"] as? String ?? url.deletingPathExtension().lastPathComponent
    }
}

final class PatternCanvas: NSView {
    var document: GarmentDocument? { didSet { needsDisplay = true } }
    var showSewing = true { didSet { needsDisplay = true } }
    var spread = 1.0 { didSet { needsDisplay = true } }
    var selectedPanel = -1 { didSet { needsDisplay = true } }
    var selectedSeam: String? { didSet { needsDisplay = true } }
    var onSelect: ((Int) -> Void)?
    override var isFlipped: Bool { true }

    override func mouseDown(with event: NSEvent) {
        guard let document, !document.panels.isEmpty, bounds.width > 0, bounds.height > 0 else { return }
        let columns = min(2, document.panels.count)
        let rows = (document.panels.count + columns - 1) / columns
        let point = convert(event.locationInWindow, from: nil)
        let col = min(columns - 1, max(0, Int(point.x / (bounds.width / CGFloat(columns)))))
        let row = min(rows - 1, max(0, Int(point.y / (bounds.height / CGFloat(rows)))))
        let index = row * columns + col
        if index < document.panels.count { selectedPanel = index; onSelect?(index) }
    }

    override func draw(_ dirtyRect: NSRect) {
        NSColor(calibratedWhite: 0.085, alpha: 1).setFill()
        bounds.fill()
        guard let doc = document, !doc.panels.isEmpty else {
            let text = "Open an XPBD fixture to inspect the native pattern geometry"
            (text as NSString).draw(at: NSPoint(x: 24, y: 32), withAttributes: [.foregroundColor: NSColor.lightGray, .font: NSFont.systemFont(ofSize: 13)])
            return
        }
        let columns = min(2, doc.panels.count)
        let rows = (doc.panels.count + columns - 1) / columns
        let cellWidth = bounds.width / CGFloat(columns)
        let cellHeight = bounds.height / CGFloat(rows)
        var centers: [Int: NSPoint] = [:]
        for (i, panel) in doc.panels.enumerated() {
            let cellX = CGFloat(i % columns) * cellWidth
            let cellY = CGFloat(i / columns) * cellHeight
            let minX = panel.flat.map(\.x).min() ?? 0
            let maxX = panel.flat.map(\.x).max() ?? 0
            let minY = panel.flat.map(\.y).min() ?? 0
            let maxY = panel.flat.map(\.y).max() ?? 0
            let widthM = max(0.01, maxX - minX)
            let heightM = max(0.01, maxY - minY)
            let scale = max(1.0, min((cellWidth - 48) / widthM, (cellHeight - 78) / heightM))
            let offset = NSPoint(x: cellX + (cellWidth - widthM * scale) * 0.5,
                                 y: cellY + 45 + max(0, (cellHeight - 75 - heightM * scale) * 0.5))
            let project: (SIMD3<Double>) -> NSPoint = { v in
                NSPoint(x: offset.x + (v.x - minX) * scale, y: offset.y + (maxY - v.y) * scale)
            }
            let boundary = NSBezierPath(rect: NSRect(x: cellX + 6, y: cellY + 6, width: max(1, cellWidth - 12), height: max(1, cellHeight - 12)))
            NSColor(calibratedWhite: 0.31, alpha: 0.4).setStroke()
            boundary.lineWidth = 0.6
            boundary.stroke()
            let fill = NSColor(calibratedRed: 0.20 + Double(i % 3) * 0.07, green: 0.23, blue: 0.29, alpha: 0.8)
            for face in panel.faces where face.count == 3 && face.allSatisfy({ $0 >= 0 && $0 < panel.flat.count }) {
                let path = NSBezierPath()
                let a = project(panel.flat[face[0]]), b = project(panel.flat[face[1]]), c = project(panel.flat[face[2]])
                path.move(to: a); path.line(to: b); path.line(to: c); path.close()
                fill.setFill(); path.fill()
                NSColor(calibratedWhite: 0.65, alpha: 0.18).setStroke(); path.lineWidth = 0.25; path.stroke()
            }
            if i == selectedPanel {
                let border = NSBezierPath()
                let pts = panel.flat.map(project)
                if let minX = pts.map(\.x).min(), let maxX = pts.map(\.x).max(), let minY = pts.map(\.y).min(), let maxY = pts.map(\.y).max() {
                    border.appendRoundedRect(NSRect(x: minX - 8, y: minY - 8, width: maxX - minX + 16, height: maxY - minY + 16), xRadius: 4, yRadius: 4)
                    NSColor.systemOrange.setStroke(); border.lineWidth = 1.5; border.stroke()
                }
            }
            for (local, global) in panel.indices.enumerated() where local < panel.flat.count { centers[global] = project(panel.flat[local]) }
            (panel.name as NSString).draw(at: NSPoint(x: cellX + 17, y: cellY + 15), withAttributes: [.foregroundColor: NSColor.white, .font: NSFont.boldSystemFont(ofSize: 13)])
        }
        if showSewing {
            let path = NSBezierPath()
            var drawnPerSeam: [String: Int] = [:]
            for (i, pair) in doc.seamPairs.enumerated() {
                let seam = doc.seamNames[i]
                if let selectedSeam, seam != selectedSeam { continue }
                if selectedSeam == nil && (drawnPerSeam[seam] ?? 0) >= 2 { continue }
                guard let a = centers[pair.0], let b = centers[pair.1] else { continue }
                path.move(to: a); path.line(to: b)
                drawnPerSeam[seam, default: 0] += 1
            }
            NSColor.systemOrange.withAlphaComponent(0.55).setStroke()
            path.lineWidth = 0.75; path.setLineDash([3, 3], count: 2, phase: 0); path.stroke()
        }
    }
}

final class NativeApp: NSObject, NSApplicationDelegate, NSTableViewDataSource, NSTableViewDelegate {
    var window: NSWindow!
    var canvas: PatternCanvas!
    var sceneView: SCNView!
    var scene = SCNScene()
    var document: GarmentDocument?
    var showSewing = true
    var spread = 0.0
    var panelNodes: [SCNNode] = []
    var seamNode: SCNNode?
    var particlePanel: [Int: Int] = [:]
    var status: NSTextField!
    var avatarNode: SCNNode?
    var avatarVisible = true
    var wireframe = false
    var list: NSOutlineView!
    var fixtureMenu: NSPopUpButton!
    var currentFixture: URL?
    var panelTable: NSTableView!
    var details: NSTextField!
    var panelVisibility: [Bool] = []
    var selectedPanel = -1
    var toolbarStatus: NSTextField!
    var sewingPreviewTimer: Timer?
    var explodeSlider: NSSlider!
    var fitProgress: NSSlider!
    var solverStatus: NSTextField!
    var solvedSnapshot: NativeSolvedSnapshot?
    var fitAmount = 0.0
    var fitTimer: Timer?
    var selectedSeam: String?
    var seamMenu: NSPopUpButton!
    var nativeRoot: NSView?
    var fullWorkspaceRoot: NSView?
    var fullWebView: WKWebView?
    var bundledSchemeHandler: BundledWorkspaceSchemeHandler?
    var nativeSplit: NSSplitView?

    func applicationDidFinishLaunching(_ notification: Notification) {
        window = NSWindow(contentRect: NSRect(x: 80, y: 80, width: 1420, height: 860), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "Garment Studio — Native Preview"
        window.minSize = NSSize(width: 1260, height: 660)
        let root = NSView(frame: window.contentView!.bounds)
        root.autoresizingMask = [.width, .height]
        window.contentView = root
        nativeRoot = root
        let bar = NSStackView()
        bar.orientation = .horizontal; bar.spacing = 9; bar.alignment = .centerY
        bar.translatesAutoresizingMaskIntoConstraints = false
        let tools = NSStackView()
        tools.orientation = .horizontal; tools.spacing = 9; tools.alignment = .centerY
        tools.translatesAutoresizingMaskIntoConstraints = false
        let open = NSButton(title: "Open garment JSON…", target: self, action: #selector(openFile))
        fixtureMenu = NSPopUpButton(frame: NSRect(x: 0, y: 0, width: 130, height: 28), pullsDown: false)
        fixtureMenu.addItems(withTitles: ["T-shirt", "Hoodie", "Pants", "Zip hoodie"])
        fixtureMenu.target = self
        fixtureMenu.action = #selector(changeFixture(_:))
        let toggle = NSButton(checkboxWithTitle: "Sewing lines", target: self, action: #selector(toggleSeams(_:)))
        toggle.state = .on
        let avatarToggle = NSButton(checkboxWithTitle: "Thomas", target: self, action: #selector(toggleAvatar(_:)))
        avatarToggle.state = .on
        let wireToggle = NSButton(checkboxWithTitle: "Wireframe", target: self, action: #selector(toggleWireframe(_:)))
        let reset = NSButton(title: "Reset camera", target: self, action: #selector(resetCamera))
        let reload = NSButton(title: "Reload", target: self, action: #selector(reloadFixture))
        let fit = NSButton(title: "Fit view", target: self, action: #selector(fitCamera))
        let showAll = NSButton(title: "Show all", target: self, action: #selector(showAllPanels))
        let fullWorkspace = NSButton(title: "Full 3D + 2D Workspace", target: self, action: #selector(returnToCompleteWorkspace))
        let slider = NSSlider(value: 0, minValue: 0, maxValue: 1, target: self, action: #selector(updateSpread(_:)))
        explodeSlider = slider
        slider.widthAnchor.constraint(equalToConstant: 170).isActive = true
        let sewPreview = NSButton(title: "Sew Preview", target: self, action: #selector(animateSewingPreview))
        let fitted = NSButton(title: "Simulate Fit", target: self, action: #selector(animateFitPreview))
        let resetFit = NSButton(title: "Reset Fit", target: self, action: #selector(resetFitPreview))
        fitProgress = NSSlider(value: 1, minValue: 0, maxValue: 1, target: self, action: #selector(setFitPosition(_:)))
        fitProgress.widthAnchor.constraint(equalToConstant: 115).isActive = true
        status = NSTextField(labelWithString: "Native document viewer · solver not yet connected")
        status.textColor = .secondaryLabelColor
        bar.addArrangedSubview(fixtureMenu); bar.addArrangedSubview(open); bar.addArrangedSubview(reload); bar.addArrangedSubview(showAll); bar.addArrangedSubview(reset); bar.addArrangedSubview(fit); bar.addArrangedSubview(fullWorkspace)
        tools.addArrangedSubview(toggle); tools.addArrangedSubview(avatarToggle); tools.addArrangedSubview(wireToggle)
        tools.addArrangedSubview(NSTextField(labelWithString: "Explode")); tools.addArrangedSubview(slider); tools.addArrangedSubview(sewPreview)
        tools.addArrangedSubview(fitted); tools.addArrangedSubview(resetFit); tools.addArrangedSubview(fitProgress)
        root.addSubview(bar)
        root.addSubview(tools)

        toolbarStatus = NSTextField(labelWithString: "GARMENT STUDIO   /   3D GARMENT   +   2D PATTERN")
        toolbarStatus.font = NSFont.monospacedSystemFont(ofSize: 11, weight: .medium)
        toolbarStatus.textColor = .secondaryLabelColor
        toolbarStatus.translatesAutoresizingMaskIntoConstraints = false
        root.addSubview(toolbarStatus)
        solverStatus = NSTextField(labelWithString: "XPBD fixture not yet loaded")
        solverStatus.font = NSFont.monospacedSystemFont(ofSize: 10, weight: .regular)
        solverStatus.textColor = .secondaryLabelColor
        solverStatus.translatesAutoresizingMaskIntoConstraints = false
        root.addSubview(solverStatus)

        let workspaceRow = NSStackView()
        workspaceRow.orientation = .horizontal
        workspaceRow.spacing = 0
        workspaceRow.alignment = .centerY
        workspaceRow.translatesAutoresizingMaskIntoConstraints = false
        root.addSubview(workspaceRow)
        let split = NSSplitView()
        split.isVertical = true; split.dividerStyle = .thin
        split.translatesAutoresizingMaskIntoConstraints = false
        nativeSplit = split
        sceneView = SCNView()
        sceneView.scene = scene
        sceneView.backgroundColor = NSColor(calibratedWhite: 0.10, alpha: 1)
        sceneView.allowsCameraControl = true
        let click = NSClickGestureRecognizer(target: self, action: #selector(selectPanelIn3D(_:)))
        sceneView.addGestureRecognizer(click)
        sceneView.autoenablesDefaultLighting = false
        sceneView.antialiasingMode = .multisampling4X
        canvas = PatternCanvas()
        canvas.onSelect = { [weak self] index in
            self?.panelTable.selectRowIndexes(IndexSet(integer: index), byExtendingSelection: false)
            self?.panelTable.scrollRowToVisible(index)
        }
        let sidebar = NSView()
        sidebar.wantsLayer = true
        sidebar.layer?.backgroundColor = NSColor(calibratedWhite: 0.14, alpha: 1).cgColor
        let heading = NSTextField(labelWithString: "GARMENT PANELS")
        heading.font = .boldSystemFont(ofSize: 12)
        heading.translatesAutoresizingMaskIntoConstraints = false
        sidebar.addSubview(heading)
        panelTable = NSTableView()
        panelTable.headerView = nil
        panelTable.rowHeight = 32
        panelTable.backgroundColor = .clear
        panelTable.selectionHighlightStyle = .regular
        let col = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("panel"))
        col.title = "Pattern pieces"; col.width = 210
        panelTable.addTableColumn(col)
        panelTable.dataSource = self; panelTable.delegate = self
        let panelScroll = NSScrollView()
        panelScroll.documentView = panelTable
        panelScroll.hasVerticalScroller = true
        panelScroll.drawsBackground = false
        panelScroll.translatesAutoresizingMaskIntoConstraints = false
        sidebar.addSubview(panelScroll)
        details = NSTextField(labelWithString: "Select a pattern piece to inspect it.")
        details.maximumNumberOfLines = 5
        details.lineBreakMode = .byWordWrapping
        details.textColor = .secondaryLabelColor
        details.translatesAutoresizingMaskIntoConstraints = false
        sidebar.addSubview(details)
        let hide = NSButton(title: "Hide / Show Selected", target: self, action: #selector(toggleSelectedPanel))
        hide.translatesAutoresizingMaskIntoConstraints = false
        sidebar.addSubview(hide)
        let seamHeading = NSTextField(labelWithString: "SEWING / MATCHED EDGES")
        seamHeading.font = .boldSystemFont(ofSize: 11)
        seamHeading.translatesAutoresizingMaskIntoConstraints = false
        sidebar.addSubview(seamHeading)
        seamMenu = NSPopUpButton(frame: .zero, pullsDown: false)
        seamMenu.target = self
        seamMenu.action = #selector(selectSeam(_:))
        seamMenu.translatesAutoresizingMaskIntoConstraints = false
        sidebar.addSubview(seamMenu)
        NSLayoutConstraint.activate([
            heading.topAnchor.constraint(equalTo: sidebar.topAnchor, constant: 18), heading.leadingAnchor.constraint(equalTo: sidebar.leadingAnchor, constant: 14),
            panelScroll.topAnchor.constraint(equalTo: heading.bottomAnchor, constant: 14), panelScroll.leadingAnchor.constraint(equalTo: sidebar.leadingAnchor, constant: 8), panelScroll.trailingAnchor.constraint(equalTo: sidebar.trailingAnchor, constant: -8), panelScroll.heightAnchor.constraint(equalToConstant: 280),
            details.topAnchor.constraint(equalTo: panelScroll.bottomAnchor, constant: 18), details.leadingAnchor.constraint(equalTo: sidebar.leadingAnchor, constant: 14), details.trailingAnchor.constraint(equalTo: sidebar.trailingAnchor, constant: -12),
            hide.topAnchor.constraint(equalTo: details.bottomAnchor, constant: 18), hide.leadingAnchor.constraint(equalTo: sidebar.leadingAnchor, constant: 10),
            seamHeading.topAnchor.constraint(equalTo: hide.bottomAnchor, constant: 24), seamHeading.leadingAnchor.constraint(equalTo: sidebar.leadingAnchor, constant: 14),
            seamMenu.topAnchor.constraint(equalTo: seamHeading.bottomAnchor, constant: 12), seamMenu.leadingAnchor.constraint(equalTo: sidebar.leadingAnchor, constant: 11),
            seamMenu.trailingAnchor.constraint(equalTo: sidebar.trailingAnchor, constant: -11)
        ])
        workspaceRow.addArrangedSubview(sidebar)
        workspaceRow.addArrangedSubview(split)
        split.addSubview(sceneView); split.addSubview(canvas)
        sidebar.widthAnchor.constraint(equalToConstant: 245).isActive = true
        split.setContentHuggingPriority(.defaultLow, for: .horizontal)
        NSLayoutConstraint.activate([
            bar.topAnchor.constraint(equalTo: root.topAnchor, constant: 12),
            bar.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 16),
            bar.trailingAnchor.constraint(lessThanOrEqualTo: root.trailingAnchor, constant: -12),
            tools.topAnchor.constraint(equalTo: bar.bottomAnchor, constant: 9),
            tools.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 16),
            tools.trailingAnchor.constraint(lessThanOrEqualTo: root.trailingAnchor, constant: -12),
            toolbarStatus.topAnchor.constraint(equalTo: tools.bottomAnchor, constant: 9),
            toolbarStatus.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 16),
            solverStatus.topAnchor.constraint(equalTo: toolbarStatus.bottomAnchor, constant: 5),
            solverStatus.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 16),
            workspaceRow.topAnchor.constraint(equalTo: solverStatus.bottomAnchor, constant: 10),
            workspaceRow.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            workspaceRow.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            workspaceRow.bottomAnchor.constraint(equalTo: root.bottomAnchor),
            split.widthAnchor.constraint(greaterThanOrEqualToConstant: 800),
            split.widthAnchor.constraint(equalTo: workspaceRow.widthAnchor, constant: -245),
            sidebar.heightAnchor.constraint(equalTo: workspaceRow.heightAnchor),
            split.heightAnchor.constraint(equalTo: workspaceRow.heightAnchor)
        ])
        window.center(); window.makeKeyAndOrderFront(nil)
        DispatchQueue.main.async {
            root.layoutSubtreeIfNeeded()
            split.adjustSubviews()
            if split.bounds.width > 200 { split.setPosition(split.bounds.width * 0.55, ofDividerAt: 0) }
        }
        NSApp.activate(ignoringOtherApps: true)
        let nativePreviewOnly = CommandLine.arguments.contains("--native-preview")
        if CommandLine.arguments.count > 1 && !CommandLine.arguments[1].hasPrefix("--") {
            load(URL(fileURLWithPath: CommandLine.arguments[1]))
        } else {
            changeFixture(fixtureMenu)
        }
        if !nativePreviewOnly { showCompleteWorkspace() }
    }

    @objc func openFile() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.json]
        panel.begin { response in if response == .OK, let url = panel.url { self.load(url) } }
    }

    func load(_ url: URL) {
        do {
            document = try GarmentDocument(url: url)
            selectedPanel = -1
            selectedSeam = nil
            panelVisibility = Array(repeating: true, count: document!.panels.count)
            currentFixture = url
            canvas.document = document
            canvas.selectedPanel = -1
            canvas.selectedSeam = nil
            panelTable.reloadData()
            seamMenu.removeAllItems()
            seamMenu.addItem(withTitle: "All sewing connections")
            for name in Array(Set(document!.seamNames)).sorted() {
                seamMenu.addItem(withTitle: name.replacingOccurrences(of: "seam-", with: "").replacingOccurrences(of: "-", with: " ").capitalized)
                seamMenu.lastItem?.representedObject = name
            }
            window.title = "Garment Studio — \(document!.title)"
            status.stringValue = "\(document!.panels.count) panels · \(document!.particles.count) particles · \(document!.seamPairs.count) stitch pairs"
            rebuildScene()
            loadPreparedSolution()
        } catch {
            let alert = NSAlert(error: error); alert.runModal()
        }
    }

    func numberOfRows(in tableView: NSTableView) -> Int { document?.panels.count ?? 0 }

    func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        guard let doc = document, row >= 0, row < doc.panels.count else { return nil }
        let label = NSTextField(labelWithString: "\(panelVisibility[row] ? "◉" : "○")  \(doc.panels[row].name)")
        label.textColor = panelVisibility[row] ? .labelColor : .secondaryLabelColor
        label.font = .systemFont(ofSize: 13)
        return label
    }

    func tableViewSelectionDidChange(_ notification: Notification) {
        let index = panelTable.selectedRow
        selectedPanel = index
        canvas.selectedPanel = index
        for (i, node) in panelNodes.enumerated() {
            node.geometry?.materials.forEach { $0.emission.contents = i == index ? NSColor.systemOrange.withAlphaComponent(0.16) : NSColor.black }
        }
        if let doc = document, index >= 0, index < doc.panels.count {
            let panel = doc.panels[index]
            details.stringValue = "\(panel.name)\n\(panel.indices.count) vertices · \(panel.faces.count) triangles\nSewing and arrangement inspection"
        } else { details.stringValue = "Select a pattern piece to inspect it." }
    }

    @objc func selectPanelIn3D(_ gesture: NSClickGestureRecognizer) {
        let hits = sceneView.hitTest(gesture.location(in: sceneView), options: [.firstFoundOnly: false])
        guard let match = hits.compactMap({ result -> Int? in
            panelNodes.firstIndex(where: { $0 === result.node })
        }).first else { return }
        panelTable.selectRowIndexes(IndexSet(integer: match), byExtendingSelection: false)
        panelTable.scrollRowToVisible(match)
    }

    @objc func toggleSelectedPanel() {
        let i = selectedPanel
        guard i >= 0, i < panelVisibility.count else { return }
        panelVisibility[i].toggle()
        panelNodes[i].isHidden = !panelVisibility[i]
        panelTable.reloadData()
    }

    @objc func selectSeam(_ sender: NSPopUpButton) {
        selectedSeam = sender.selectedItem?.representedObject as? String
        canvas.selectedSeam = selectedSeam
        rebuildSewingLines()
    }

    @objc func showAllPanels() {
        for i in panelVisibility.indices { panelVisibility[i] = true }
        for node in panelNodes { node.isHidden = false }
        panelTable.reloadData()
    }

    @objc func changeFixture(_ sender: NSPopUpButton) {
        let fixture = ["tee-quality.native-sim.json", "hoodie-quality.native-sim.json", "pants.native-sim.json", "zip-hoodie-quality.native-sim.json"]
        let index = max(0, min(sender.indexOfSelectedItem, fixture.count - 1))
        let bundled = Bundle.main.resourceURL?.appendingPathComponent("fixtures/").appendingPathComponent(fixture[index])
        let development = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("native_backend/fixtures/").appendingPathComponent(fixture[index])
        let url = bundled.flatMap { FileManager.default.fileExists(atPath: $0.path) ? $0 : nil } ?? development
        load(url)
    }

    @objc func reloadFixture() { if let currentFixture { load(currentFixture) } }

    @objc func resetCamera() {
        guard let camera = sceneView.pointOfView else { return }
        camera.position = SCNVector3(0, 1.3, 2.6)
        camera.look(at: SCNVector3(0, 1.25, 0))
    }

    @objc func fitCamera() {
        sceneView.defaultCameraController.frameNodes(panelNodes + (avatarNode.map { [$0] } ?? []))
    }

    func rebuildScene() {
        scene.rootNode.childNodes.forEach { $0.removeFromParentNode() }
        panelNodes = []; seamNode = nil; avatarNode = nil
        particlePanel = [:]
        guard let doc = document else { return }
        for (index, panel) in doc.panels.enumerated() {
            for global in panel.indices { particlePanel[global] = index }
            let sources = panel.indices.map { global -> SIMD3<Double> in
                global >= 0 && global < doc.particles.count ? doc.particles[global] : SIMD3(0, 0, 0)
            }
            let geometry = makeNativeGarmentGeometry(sources.map { SCNVector3(Float($0.x), Float($0.y), Float($0.z)) }, faces: panel.faces)
            let material = SCNMaterial()
            material.diffuse.contents = NSColor(calibratedRed: 0.23 + Double(index % 3) * 0.035, green: 0.25, blue: 0.28, alpha: 1)
            material.isDoubleSided = true
            material.lightingModel = .blinn
            material.roughness.contents = 0.92
            material.metalness.contents = 0.0
            material.specular.contents = NSColor(calibratedWhite: 0.08, alpha: 1)
            geometry.materials = [material]
            let node = SCNNode(geometry: geometry)
            node.name = panel.name
            scene.rootNode.addChildNode(node); panelNodes.append(node)
            node.isHidden = !panelVisibility[index]
        }
        addStudioLighting()
        loadAvailableAvatar()
        let camera = SCNCamera(); camera.zFar = 100
        let node = SCNNode(); node.camera = camera
        node.position = SCNVector3(0, 1.3, 2.6)
        node.look(at: SCNVector3(0, 1.25, 0))
        scene.rootNode.addChildNode(node)
        sceneView.pointOfView = node
        applySpread()
        panelTable.reloadData()
    }

    func addStudioLighting() {
        let floor = SCNFloor()
        floor.reflectivity = 0.03
        let surface = SCNMaterial()
        surface.diffuse.contents = NSColor(calibratedWhite: 0.16, alpha: 1)
        surface.roughness.contents = 0.83
        floor.materials = [surface]
        let floorNode = SCNNode(geometry: floor)
        floorNode.name = "stage floor"
        floorNode.position = SCNVector3(0, -0.025, 0)
        scene.rootNode.addChildNode(floorNode)

        func addLight(_ type: SCNLight.LightType, intensity: CGFloat, color: NSColor, position: SCNVector3) {
            let light = SCNLight()
            light.type = type
            light.intensity = intensity
            light.color = color
            light.castsShadow = false
            light.shadowSampleCount = 8
            let node = SCNNode()
            node.light = light
            node.position = position
            node.look(at: SCNVector3(0, 1.15, 0))
            scene.rootNode.addChildNode(node)
        }
        addLight(.ambient, intensity: 130, color: .white, position: SCNVector3(0, 2, 0))
        addLight(.omni, intensity: 370, color: NSColor(calibratedRed: 0.94, green: 0.96, blue: 1.0, alpha: 1), position: SCNVector3(2.0, 3, 2.8))
        addLight(.omni, intensity: 150, color: NSColor(calibratedRed: 1.0, green: 0.92, blue: 0.86, alpha: 1), position: SCNVector3(-2, 2, 0.5))
    }

    func loadAvailableAvatar() {
        let privateBundled = Bundle.main.resourceURL?.appendingPathComponent("assets/clo-thomas.obj")
        let privateLocal = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("assets/clo-thomas.obj")
        let publicBundled = Bundle.main.resourceURL?.appendingPathComponent("web/avatars/makehuman-base.obj")
        let privateURL = [privateBundled, privateLocal].compactMap { $0 }.first { FileManager.default.fileExists(atPath: $0.path) }
        let url = privateURL ?? publicBundled ?? URL(fileURLWithPath: "/nonexistent-avatar.obj")
        let avatarLabel = privateURL != nil ? "Thomas" : "MakeHuman"
        guard FileManager.default.fileExists(atPath: url.path) else {
            status.stringValue += " · Avatar model not bundled"
            return
        }
        do {
            let avatarScene = try SCNScene(url: url, options: [.checkConsistency: true])
            let avatar = SCNNode()
            for child in avatarScene.rootNode.childNodes { avatar.addChildNode(child.clone()) }
            avatar.name = "\(avatarLabel) · fitting geometry"
            avatar.enumerateChildNodes { part, _ in
                guard let geometry = part.geometry else { return }
                let name = (part.name ?? "").lowercased()
                let material = SCNMaterial()
                material.lightingModel = .physicallyBased
                material.roughness.contents = 0.76
                if name.contains("hair") || name.contains("eyelash") {
                    material.diffuse.contents = NSColor(calibratedRed: 0.14, green: 0.12, blue: 0.10, alpha: 1)
                } else if name.contains("shoes") {
                    material.diffuse.contents = NSColor(calibratedRed: 0.18, green: 0.18, blue: 0.20, alpha: 1)
                } else if name.contains("eye_") || name.contains("tooth") {
                    material.diffuse.contents = NSColor(calibratedWhite: 0.92, alpha: 1)
                } else {
                    material.diffuse.contents = NSColor(calibratedRed: 0.71, green: 0.52, blue: 0.40, alpha: 1)
                }
                geometry.materials = [material]
            }
            // Source GLB uses meters, but OBJ exporters can apply a different unit scale.
            // Normalize height to the 1.8 m body used by the current garment fixture.
            let (minPoint, maxPoint) = avatar.boundingBox
            let height = max(0.001, Double(maxPoint.y - minPoint.y))
            let factor = 1.8 / height
            avatar.scale = SCNVector3(factor, factor, factor)
            avatar.position = SCNVector3(-Double(minPoint.x + maxPoint.x) * factor / 2, -Double(minPoint.y) * factor, -Double(minPoint.z + maxPoint.z) * factor / 2)
            avatar.isHidden = !avatarVisible
            scene.rootNode.addChildNode(avatar)
            avatarNode = avatar
            status.stringValue += " · \(avatarLabel) loaded"
        } catch {
            status.stringValue += " · \(avatarLabel) import error: \(error.localizedDescription)"
        }
    }

    @objc func toggleAvatar(_ sender: NSButton) {
        avatarVisible = sender.state == .on
        avatarNode?.isHidden = !avatarVisible
    }

    @objc func toggleWireframe(_ sender: NSButton) {
        wireframe = sender.state == .on
        for node in panelNodes { node.geometry?.materials.forEach { $0.fillMode = wireframe ? .lines : .fill } }
    }

    func applySpread() {
        for (index, node) in panelNodes.enumerated() {
            node.position = SCNVector3(Float((Double(index % 4) - 1.5) * 0.34 * spread), 0, Float((Double(index / 4) + 1) * 0.24 * spread))
        }
        rebuildSewingLines()
    }

    func rebuildSewingLines() {
        seamNode?.removeFromParentNode()
        seamNode = nil
        guard showSewing, let doc = document, !doc.seamPairs.isEmpty else { return }
        var vertices: [SCNVector3] = []
        var indices: [Int32] = []
        var drawnPerSeam: [String: Int] = [:]
        for (index, pair) in doc.seamPairs.enumerated() {
            let seam = doc.seamNames[index]
            if let selectedSeam, seam != selectedSeam { continue }
            if selectedSeam == nil && (drawnPerSeam[seam] ?? 0) >= 2 { continue }
            guard let ai = particlePanel[pair.0], let bi = particlePanel[pair.1] else { continue }
            drawnPerSeam[seam, default: 0] += 1
            let initialA = doc.particles[pair.0], initialB = doc.particles[pair.1]
            let solvedA = solvedSnapshot?.particles[pair.0] ?? initialA
            let solvedB = solvedSnapshot?.particles[pair.1] ?? initialB
            let a = initialA + (solvedA - initialA) * fitAmount
            let b = initialB + (solvedB - initialB) * fitAmount
            let ao = panelNodes[ai].position, bo = panelNodes[bi].position
            let start = Int32(vertices.count)
            let ax: CGFloat = CGFloat(a.x) + ao.x
            let ay: CGFloat = CGFloat(a.y) + ao.y
            let az: CGFloat = CGFloat(a.z) + ao.z
            let bx: CGFloat = CGFloat(b.x) + bo.x
            let by: CGFloat = CGFloat(b.y) + bo.y
            let bz: CGFloat = CGFloat(b.z) + bo.z
            vertices.append(SCNVector3(x: ax, y: ay, z: az))
            vertices.append(SCNVector3(x: bx, y: by, z: bz))
            indices.append(start); indices.append(start + 1)
        }
        guard !vertices.isEmpty else { return }
        let geometry = SCNGeometry(sources: [SCNGeometrySource(vertices: vertices)],
                                   elements: [SCNGeometryElement(indices: indices, primitiveType: .line)])
        let material = SCNMaterial()
        material.lightingModel = .constant
        material.diffuse.contents = NSColor.systemOrange
        material.isDoubleSided = true
        geometry.materials = [material]
        let node = SCNNode(geometry: geometry)
        node.name = "native-sewing-correspondence"
        scene.rootNode.addChildNode(node)
        seamNode = node
    }

    @objc func toggleSeams(_ sender: NSButton) {
        showSewing = sender.state == .on
        canvas.showSewing = showSewing
        rebuildSewingLines()
    }
    @objc func updateSpread(_ sender: NSSlider) {
        sewingPreviewTimer?.invalidate()
        sewingPreviewTimer = nil
        spread = sender.doubleValue
        applySpread()
    }

    @objc func animateSewingPreview() {
        sewingPreviewTimer?.invalidate()
        spread = 1
        explodeSlider.doubleValue = spread
        applySpread()
        let started = Date()
        sewingPreviewTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 30, repeats: true) { [weak self] timer in
            guard let self else { timer.invalidate(); return }
            let progress = min(1, Date().timeIntervalSince(started) / 2.0)
            self.spread = 1 - progress * progress * (3 - 2 * progress)
            self.explodeSlider.doubleValue = self.spread
            self.applySpread()
            if progress >= 1 { timer.invalidate(); self.sewingPreviewTimer = nil }
        }
        // Visualization only. Native solver stitch-closure ramp is a separate milestone.
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}

@main
enum GarmentStudioEntry {
    static func main() {
        let app = NSApplication.shared
        app.setActivationPolicy(.regular)
        let delegate = NativeApp()
        app.delegate = delegate
        app.run()
    }
}
