import AppKit
import SceneKit

/// Loads a pre-computed native XPBD simulation snapshot from bundled resources.
/// This is physically computed garment data, not live interactive cloth simulation.
struct NativeSolvedSnapshot {
    let particles: [SIMD3<Double>]
    let frames: Int
    let seamAverageMm: Double
    let maximumStrain: Double
    let finite: Bool

    init(url: URL, expectedCount: Int) throws {
        let root = try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any] ?? [:]
        guard root["protocol"] as? String == "garment-studio.native-xpbd-result",
              let state = root["state"] as? [String: Any],
              let raw = state["particles"] as? [[String: Any]],
              raw.count == expectedCount else {
            throw NSError(domain: "GarmentStudioSolver", code: 1, userInfo: [NSLocalizedDescriptionKey: "XPBD result does not match the selected garment."])
        }
        particles = raw.map { p in
            let coordinates = p["position"] as? [NSNumber] ?? []
            return SIMD3(coordinates.count > 0 ? coordinates[0].doubleValue : 0,
                         coordinates.count > 1 ? coordinates[1].doubleValue : 0,
                         coordinates.count > 2 ? coordinates[2].doubleValue : 0)
        }
        let stats = root["stats"] as? [String: Any] ?? [:]
        frames = root["frames"] as? Int ?? 0
        seamAverageMm = ((stats["seamAverageDistance"] as? NSNumber)?.doubleValue ?? 0) * 1000
        maximumStrain = (stats["structuralStrainMax"] as? NSNumber)?.doubleValue ?? 0
        finite = stats["finite"] as? Bool ?? false
        guard finite, particles.allSatisfy({ $0.x.isFinite && $0.y.isFinite && $0.z.isFinite }) else {
            throw NSError(domain: "GarmentStudioSolver", code: 2, userInfo: [NSLocalizedDescriptionKey: "XPBD solution has nonfinite vertices."])
        }
    }
}

extension NativeApp {
    func loadPreparedSolution() {
        solvedSnapshot = nil
        guard let doc = document, let file = currentFixture else { return }
        let resultName = file.deletingPathExtension().lastPathComponent + ".result.json"
        let resourceURL = Bundle.main.resourceURL?.appendingPathComponent("solved/").appendingPathComponent(resultName)
        let localURL = file.deletingLastPathComponent().appendingPathComponent(resultName)
        let url = resourceURL.flatMap { FileManager.default.fileExists(atPath: $0.path) ? $0 : nil } ?? localURL
        guard FileManager.default.fileExists(atPath: url.path) else {
            solverStatus.stringValue = "Native XPBD snapshot unavailable for this file"
            return
        }
        do {
            solvedSnapshot = try NativeSolvedSnapshot(url: url, expectedCount: doc.particles.count)
            solverStatus.stringValue = "XPBD ready · \(solvedSnapshot!.frames) frames · seam \(String(format: "%.1f", solvedSnapshot!.seamAverageMm)) mm · peak strain \(Int(solvedSnapshot!.maximumStrain * 100))%"
            updateFitPosition(1)
            fitProgress.doubleValue = 1
        } catch {
            solverStatus.stringValue = error.localizedDescription
        }
    }

    func updateFitPosition(_ t: Double) {
        guard let doc = document, let solved = solvedSnapshot else { return }
        let f = max(0, min(1, t))
        for (index, panel) in doc.panels.enumerated() where index < panelNodes.count {
            let positions = panel.indices.map { global -> SCNVector3 in
                guard global >= 0, global < doc.particles.count else { return SCNVector3Zero }
                let start = doc.particles[global]
                let end = solved.particles[global]
                return SCNVector3(start.x + (end.x-start.x)*f, start.y + (end.y-start.y)*f, start.z + (end.z-start.z)*f)
            }
            let geometry = makeNativeGarmentGeometry(positions, faces: panel.faces)
            geometry.materials = panelNodes[index].geometry?.materials ?? []
            panelNodes[index].geometry = geometry
        }
        fitAmount = f
        rebuildSewingLines()
    }

    @objc func setFitPosition(_ sender: NSSlider) {
        fitTimer?.invalidate(); fitTimer = nil
        updateFitPosition(sender.doubleValue)
    }

    @objc func animateFitPreview() {
        guard solvedSnapshot != nil else { return }
        fitTimer?.invalidate()
        updateFitPosition(0)
        let initial = 0.0
        let began = Date()
        fitTimer = Timer.scheduledTimer(withTimeInterval: 1.0/30.0, repeats: true) { [weak self] timer in
            guard let self else { timer.invalidate(); return }
            let t = min(1, Date().timeIntervalSince(began) / 2.0)
            let ease = t*t*(3-2*t)
            self.fitProgress.doubleValue = initial + (1-initial)*ease
            self.updateFitPosition(self.fitProgress.doubleValue)
            if t >= 1 { timer.invalidate(); self.fitTimer = nil }
        }
    }

    @objc func resetFitPreview() {
        fitTimer?.invalidate(); fitTimer = nil
        fitProgress.doubleValue = 0
        updateFitPosition(0)
    }
}
