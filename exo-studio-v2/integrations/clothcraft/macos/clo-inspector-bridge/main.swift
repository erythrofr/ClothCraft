import AppKit
import ApplicationServices
import CoreGraphics
import Foundation
import ImageIO
import ScreenCaptureKit
import UniformTypeIdentifiers

// A real launchd/LaunchServices app process, never osascript or a temporary
// Swift process. All interaction is read-only, restricted to the CLO app.
// Does not modify Chat On Steroids, CLO projects, EXO V1, or native V2 state.
struct Node: Codable {
    var role: String
    var name: String
    var value: String?
    var frame: [String: Double]?
    var children: [Node]
}

struct Report: Codable {
    var version = "1.0.0"
    var generatedAt = ISO8601DateFormatter().string(from: Date())
    var identifier = Bundle.main.bundleIdentifier ?? "unknown"
    var executable = CommandLine.arguments.first ?? "unknown"
    var accessibility = false
    var screenRecording = false
    var cloPID: Int32?
    var cloWindowCount = 0
    var cloWindows: [Node] = []
    var screenshotPath: String?
    var warnings: [String] = []
}

func attribute(_ element: AXUIElement, _ key: CFString) -> AnyObject? {
    var result: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, key, &result) == .success else { return nil }
    return result
}

func stringAttribute(_ element: AXUIElement, _ key: CFString) -> String {
    guard let result = attribute(element, key) else { return "" }
    if let text = result as? String { return String(text.prefix(180)) }
    return ""
}

func rectAttribute(_ element: AXUIElement) -> [String: Double]? {
    guard let position = attribute(element, kAXPositionAttribute as CFString),
          let size = attribute(element, kAXSizeAttribute as CFString) else { return nil }
    let p = position as! AXValue, s = size as! AXValue
    var origin = CGPoint.zero, dimensions = CGSize.zero
    guard AXValueGetValue(p, .cgPoint, &origin), AXValueGetValue(s, .cgSize, &dimensions) else { return nil }
    return ["x":Double(origin.x),"y":Double(origin.y),"width":Double(dimensions.width),"height":Double(dimensions.height)]
}

// Explicit, one-shot inspection action: select the existing first Fabric row
// without assigning materials, changing project values, or saving anything.
// Target is resolved from the live CLO AX label; no guessed screen click.
func selectExistingFabricForInspection(_ appElement: AXUIElement) -> Bool {
    var pending = [appElement], count = 0
    while !pending.isEmpty && count < 500 {
        let element = pending.removeFirst()
        count += 1
        if stringAttribute(element, kAXValueAttribute as CFString) == "FABRIC 1",
           let frame = rectAttribute(element), frame["width", default: 0] > 20,
           let x = frame["x"], let y = frame["y"], let w = frame["width"], let h = frame["height"] {
            let location = CGPoint(x: x + min(30,w/2), y: y+h/2)
            guard let source = CGEventSource(stateID: .hidSystemState),
                  let down = CGEvent(mouseEventSource: source, mouseType: .leftMouseDown, mouseCursorPosition: location, mouseButton: .left),
                  let up = CGEvent(mouseEventSource: source, mouseType: .leftMouseUp, mouseCursorPosition: location, mouseButton: .left)
            else { return false }
            down.post(tap: .cghidEventTap); up.post(tap: .cghidEventTap)
            return true
        }
        if let children = attribute(element, kAXChildrenAttribute as CFString) as? [AXUIElement] {
            pending.append(contentsOf: children.prefix(160))
        }
    }
    return false
}

// Scroll only inside CLO's right Property Editor at a position derived from
// its live AX heading. No clicks, project changes, or dialog interactions.
func scrollLivePropertyEditor(_ appElement: AXUIElement) -> Bool {
    var pending = [appElement], count = 0
    var targetWindowFrame: [String:Double]?
    while !pending.isEmpty && count < 500 {
        let element = pending.removeFirst()
        count += 1
        let value=stringAttribute(element, kAXValueAttribute as CFString)
        if stringAttribute(element, kAXRoleAttribute as CFString) == "AXWindow",
           let f = rectAttribute(element), (f["width"] ?? 0)>1100 {
            targetWindowFrame=f
        }
        if (value == "Property Editor" || (value == "Fabric" && (rectAttribute(element)?["x"] ?? 0)>1190)),
           let frame = rectAttribute(element), let x = frame["x"], let y = frame["y"] {
            let base=targetWindowFrame
            let position = CGPoint(x:(base?["x"] ?? x)+(base?["width"] ?? 1512)-105,
                                   y:(base?["y"] ?? y)+(base?["height"] ?? 900)-160)
            guard let source=CGEventSource(stateID:.hidSystemState),
                  let event=CGEvent(scrollWheelEvent2Source:source, units:.line,wheelCount:1,wheel1:-9,wheel2:0,wheel3:0)
            else { return false }
            event.location=position
            event.post(tap:.cghidEventTap)
            return true
        }
        if let children=attribute(element,kAXChildrenAttribute as CFString) as? [AXUIElement]{
            pending.append(contentsOf:children.prefix(160))
        }
    }
    return false
}

func scan(_ element: AXUIElement, depth: Int, budget: inout Int) -> Node {
    budget -= 1
    var node = Node(
        role: stringAttribute(element, kAXRoleAttribute as CFString),
        name: stringAttribute(element, kAXTitleAttribute as CFString),
        value: nil,
        frame: rectAttribute(element),
        children: []
    )
    if let value = attribute(element, kAXValueAttribute as CFString), let text = value as? String {
        node.value = String(text.prefix(180))
    }
    if depth >= 7 || budget <= 0 { return node }
    for key in [kAXChildrenAttribute as CFString] {
        if let children = attribute(element, key) as? [AXUIElement] {
            for child in children.prefix(160) where budget > 0 {
                node.children.append(scan(child, depth: depth + 1, budget: &budget))
            }
        }
    }
    return node
}

@MainActor
func captureCLO(to folder: URL, report: inout Report) async {
    guard report.screenRecording else { return }
    do {
        let list = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
        let windows = list.windows.filter {
            let name = $0.owningApplication?.applicationName ?? ""
            let bundle = $0.owningApplication?.bundleIdentifier ?? ""
            return name.contains("CLO_Standalone") || bundle == "com.clo3d.security.closo"
        }
        guard let target = windows.first(where: { $0.frame.width >= 400 }) else {
            report.warnings.append("CLO screen-sharing window not found")
            return
        }
        let config = SCStreamConfiguration()
        config.width = max(1, Int(target.frame.width))
        config.height = max(1, Int(target.frame.height))
        config.showsCursor = false
        let filter = SCContentFilter(desktopIndependentWindow: target)
        let image = try await SCScreenshotManager.captureImage(contentFilter: filter, configuration: config)
        let output = folder.appendingPathComponent("clo-property-editor-reference.png")
        guard let destination = CGImageDestinationCreateWithURL(output as CFURL, UTType.png.identifier as CFString, 1, nil) else {
            report.warnings.append("Cannot create CLO PNG image destination")
            return
        }
        CGImageDestinationAddImage(destination, image, nil)
        guard CGImageDestinationFinalize(destination) else {
            report.warnings.append("Cannot write CLO PNG screenshot")
            return
        }
        try? FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: output.path)
        report.screenshotPath = output.path
    } catch {
        report.warnings.append("CLO screenshot failed: \(error.localizedDescription)")
    }
}

@main
struct CLOInspectorBridge {
    @MainActor static func main() async {
        let app = NSApplication.shared
        app.setActivationPolicy(.accessory)
        let folder = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/EXO-CLO-Inspector", isDirectory: true)
        do { try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true) }
        catch { return }
        try? FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: folder.path)
        var report = Report()
        let request = CommandLine.arguments.contains("--request-permissions")
        let axPromptOptions = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: request] as CFDictionary
        report.accessibility = AXIsProcessTrustedWithOptions(axPromptOptions)
        report.screenRecording = request ? CGRequestScreenCaptureAccess() : CGPreflightScreenCaptureAccess()

        let clo = NSRunningApplication.runningApplications(withBundleIdentifier: "com.clo3d.security.closo").first
            ?? NSWorkspace.shared.runningApplications.first(where: { $0.localizedName?.contains("CLO_Standalone") ?? false })
        report.cloPID = clo?.processIdentifier
        if report.accessibility, let clo {
            let appElement = AXUIElementCreateApplication(clo.processIdentifier)
            if CommandLine.arguments.contains("--select-fabric") {
                if clo.activate(options: []),
                   selectExistingFabricForInspection(appElement) {
                    try? await Task.sleep(for: .milliseconds(800))
                } else {
                    report.warnings.append("CLO FABRIC 1 row was not safely selectable")
                }
            }
            if CommandLine.arguments.contains("--scroll-property") {
                if clo.activate(options:[]), scrollLivePropertyEditor(appElement) {
                    try? await Task.sleep(for:.milliseconds(700))
                } else {
                    report.warnings.append("CLO Property Editor was not scrollable via AX position")
                }
            }
            if let windows = attribute(appElement, kAXWindowsAttribute as CFString) as? [AXUIElement] {
                report.cloWindowCount = windows.count
                AXUIElementSetMessagingTimeout(appElement, 2)
                var budget = 3000
                for window in windows.prefix(5) where budget > 0 {
                    report.cloWindows.append(scan(window, depth: 0, budget: &budget))
                }
            } else {
                report.warnings.append("CLO Accessibility window tree unavailable")
            }
        }
        await captureCLO(to: folder, report: &report)
        let destination = folder.appendingPathComponent("latest-status.json")
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        if let data = try? encoder.encode(report) {
            try? data.write(to: destination, options: .atomic)
            try? FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: destination.path)
        }
        app.terminate(nil)
    }
}
