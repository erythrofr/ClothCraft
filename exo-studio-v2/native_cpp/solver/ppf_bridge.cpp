#include "ppf_bridge.hpp"

#include <cmath>
#include <map>
#include <set>
#include <stdexcept>
#include <string>
#include <vector>

namespace garment {
namespace {
bool finiteCoord(const nlohmann::json& v) {
  if (!v.is_number()) return false;
  const auto x = v.get<double>();
  return std::isfinite(x) && std::abs(x) <= 1000.0;
}
}

PpfBridge::Json PpfBridge::validateInitialShell(const Json& payload, const Json& measured) {
  std::vector<std::string> errors;
  auto fail = [&](const std::string& why) { errors.push_back(why); };
  if (!payload.is_object() || payload.value("protocol", "") != "garment-studio.ppf-shell")
    fail("not a garment-studio.ppf-shell document");
  Json shell = payload.is_object() ? payload.value("shell", Json::object()) : Json::object();
  auto verts = shell.is_object() ? shell.value("vertices", Json::array()) : Json::array();
  auto faces = shell.is_object() ? shell.value("faces", Json::array()) : Json::array();
  auto stitches = shell.is_object() ? shell.value("stitchEdges", Json::array()) : Json::array();
  if (!verts.is_array() || verts.size() < 3 || verts.size() > 2000000) fail("invalid garment vertices");
  if (!faces.is_array() || faces.empty()) fail("garment requires triangles");
  if (!stitches.is_array() || stitches.empty()) fail("garment requires physical stitches");
  if (!errors.empty()) return {{"ok", false}, {"mayRun", false}, {"errors", errors}};
  for (const auto& v : verts) {
    if (!v.is_array() || v.size() != 3 || !finiteCoord(v[0]) || !finiteCoord(v[1]) || !finiteCoord(v[2])) {
      fail("nonfinite garment vertex"); break;
    }
  }
  if (!errors.empty()) return {{"ok", false}, {"mayRun", false}, {"errors", errors}};
  std::set<std::pair<std::int64_t, std::int64_t>> fabricEdges;
  for (const auto& f : faces) {
    if (!f.is_array() || f.size() != 3) { fail("invalid garment triangle"); break; }
    bool valid = true;
    for (const auto& idx : f) {
      if (!idx.is_number_integer() || idx.get<std::int64_t>() < 0 || idx.get<std::int64_t>() >= static_cast<std::int64_t>(verts.size()))
        valid = false;
    }
    if (!valid || f[0] == f[1] || f[1] == f[2] || f[0] == f[2]) {
      fail("degenerate triangle index or out-of-range garment triangle"); break;
    }
    auto p=f[0].get<std::size_t>(), q=f[1].get<std::size_t>(), r=f[2].get<std::size_t>();
    for (const auto& pair : {std::make_pair(p,q),std::make_pair(q,r),std::make_pair(r,p)})
      fabricEdges.insert(std::minmax(static_cast<std::int64_t>(pair.first),
                                     static_cast<std::int64_t>(pair.second)));
    const auto a=verts[p],b=verts[q],c=verts[r];
    auto ux=b[0].get<double>()-a[0].get<double>();
    auto uy=b[1].get<double>()-a[1].get<double>();
    auto uz=b[2].get<double>()-a[2].get<double>();
    auto vx=c[0].get<double>()-a[0].get<double>();
    auto vy=c[1].get<double>()-a[1].get<double>();
    auto vz=c[2].get<double>()-a[2].get<double>();
    if (std::hypot(std::hypot(uy*vz-uz*vy,uz*vx-ux*vz),ux*vy-uy*vx)<1e-12) {
      fail("zero-area garment triangle");break;
    }
  }
  if (!errors.empty()) return {{"ok", false}, {"mayRun", false}, {"errors", errors}};
  double worst = 0, sum = 0;
  std::map<std::string, std::vector<double>> groups;
  std::set<std::pair<std::int64_t,std::int64_t>> stitched;
  for (const auto& s : stitches) {
    if (!s.is_object() || !s.contains("a") || !s.contains("b") ||
        !s["a"].is_number_integer() || !s["b"].is_number_integer()) {
      fail("invalid stitch pair"); break;
    }
    auto a = s["a"].get<std::int64_t>(), b = s["b"].get<std::int64_t>();
    if (a < 0 || b < 0 || a == b || a >= static_cast<std::int64_t>(verts.size()) ||
        b >= static_cast<std::int64_t>(verts.size())) {
      fail("invalid stitch vertices"); break;
    }
    if (!s.contains("seamId") || !s.at("seamId").is_string() ||
        s.at("seamId").get<std::string>().empty()) {
      fail("missing stable seam ID"); break;
    }
    auto pair=std::minmax(a,b);
    if (!stitched.insert(pair).second) {fail("duplicate physical stitch pair");break;}
    if (fabricEdges.find(pair)!=fabricEdges.end()) {
      fail("stitch pair overlaps fabric mesh edge, not a loose physical seam");break;
    }
    double gap = std::hypot(std::hypot(verts[a][0].get<double>() - verts[b][0].get<double>(),
                                     verts[a][1].get<double>() - verts[b][1].get<double>()),
                            verts[a][2].get<double>() - verts[b][2].get<double>()) * 100;
    if (!std::isfinite(gap)) { fail("nonfinite stitch gap"); break; }
    worst = std::max(worst, gap);
    sum += gap;
    groups[s.value("seamId", "unnamed")].push_back(gap);
  }
  if (!errors.empty()) return {{"ok", false}, {"mayRun", false}, {"errors", errors}};
  if (!measured.is_object() || !measured.contains("geometryPreservedOrWithinLimit") ||
      !measured.contains("bodyAndSelfIntersectionFreeAtInitialPose") ||
      !measured.contains("maximumRelativeIntrinsicEdgeChange") ||
      !measured.contains("bodyIntersectionPairs") || !measured.contains("selfIntersectionPairs"))
    fail("independent initial-strain/contact measurements are required");
  else if (!measured.value("geometryPreservedOrWithinLimit", false) ||
           !measured.value("bodyAndSelfIntersectionFreeAtInitialPose", false) ||
           !measured["maximumRelativeIntrinsicEdgeChange"].is_number() ||
           !measured["bodyIntersectionPairs"].is_number_integer() ||
           !measured["selfIntersectionPairs"].is_number_integer() ||
           !std::isfinite(measured["maximumRelativeIntrinsicEdgeChange"].get<double>()) ||
           measured["maximumRelativeIntrinsicEdgeChange"].get<double>() > .05 ||
           measured["bodyIntersectionPairs"].get<int>() != 0 ||
           measured["selfIntersectionPairs"].get<int>() != 0)
    fail("source material strain or initial body/self contact failed independent validation");
  if (worst > 3.000001) fail("starting seam separation exceeds 3 cm");
  auto scene = payload.value("scene", Json::object());
  if (payload.contains("avatar") && payload.at("avatar").is_object() &&
      payload.at("avatar").value("mode", "") == "local-thomas-body-mesh" &&
      (!scene.is_object() || !scene.contains("avatarRepresentation") ||
       (scene.value("avatarRepresentation", "") != "pinned-shell" && scene.value("avatarRepresentation", "") != "static")))
    fail("Thomas collider mode must be explicit");
  Json listed = Json::array();
  for (const auto& [name, ds] : groups) {
    double maxGap = 0, mean = 0;
    for (auto d : ds) { maxGap = std::max(maxGap, d); mean += d; }
    listed.push_back({{"seamId", name}, {"pairs", ds.size()}, {"meanGapCm", mean / ds.size()}, {"maxGapCm", maxGap}});
  }
  return {{"ok", errors.empty()}, {"mayRun", errors.empty()}, {"initialMeanGapCm", stitches.empty() ? 0 : sum / stitches.size()},
          {"initialWorstGapCm", worst}, {"stitchPairs", stitches.size()}, {"seamGroups", listed},
          {"errors", errors}, {"fullPhysicalFitVerified", false},
          {"note", "Preflight only: native Rust PPF still requires execution and all-frame fit/CCD acceptance"}};
}


PpfBridge::Json PpfBridge::evaluateFitEvidence(const Json& evidence) {
  std::vector<std::string> errors;
  auto fail = [&](const std::string& message) { errors.push_back(message); };
  // Strict accessors intentionally reject strings, negative measurements,
  // null, fractional counts and missing values. Malformed evidence is a
  // rejected fit, never an exception that a GUI might mistake for success.
  auto number = [](const Json& obj, const char* key, double low, double high) {
    if (!obj.is_object() || !obj.contains(key) || !obj.at(key).is_number()) return false;
    const double value = obj.at(key).get<double>();
    return std::isfinite(value) && value >= low && value <= high;
  };
  auto integer = [&](const Json& obj, const char* key, int value) {
    return obj.is_object() && obj.contains(key) && obj.at(key).is_number_integer() &&
      obj.at(key) == value;
  };
  auto yes = [](const Json& obj, const char* key) {
    return obj.is_object() && obj.contains(key) && obj.at(key).is_boolean() && obj.at(key) == true;
  };
  auto member = [](const Json& obj, const char* key) -> Json {
    return obj.is_object() && obj.contains(key) ? obj.at(key) : Json();
  };
  const auto contact = member(evidence, "contact");
  const auto sewing = member(evidence, "sewing");
  const auto ccd = member(evidence, "ipcCcd");
  const auto clearance = member(evidence, "clearance");
  int frames = 0;
  if (number(contact, "frames", 2, 1200) && contact.at("frames").is_number_integer())
    frames = contact.at("frames").get<int>();
  else fail("missing or invalid trajectory frame count");
  const bool validLimit = number(evidence, "strainLimitRatio", 0.000001, 1.0);
  if (!validLimit) fail("explicit resolved strain limit required");
  const double limit = validLimit ? evidence.at("strainLimitRatio").get<double>() : 0;
  const auto perFrame = member(contact, "perFrame");
  if (!frames || !perFrame.is_array() || perFrame.size() != static_cast<size_t>(frames))
    fail("contact audit must cover every ordered frame");
  else for (int i = 0; i < frames; ++i) {
    const auto& row = perFrame[i];
    if (!integer(row, "frame", i) || !integer(row, "avatarTriangleIntersectionPairs", 0) ||
        !integer(row, "clothSelfIntersectionPairs", 0) || !integer(row, "strainLimitViolatingFaces", 0) ||
        !number(row, "maxPrincipalStretch", 0.000001, 1 + limit + 1e-6))
      fail("contact/strain failed or missing at frame " + std::to_string(i));
  }
  if (!yes(contact, "allFramesAvatarIntersectionFree") || !yes(contact, "allFramesSelfIntersectionFree") ||
      !yes(contact, "allFramesWithinStrainLimit")) fail("contact/strain audit summary failed");
  const auto samples = member(sewing, "samples");
  if (!integer(sewing, "framesAnalyzed", frames) || !number(sewing, "stitchedPairs", 1, 2000000) ||
      !sewing.at("stitchedPairs").is_number_integer() || !frames || !samples.is_array() ||
      samples.size() != static_cast<size_t>(frames)) fail("incomplete physical sewing evidence");
  else for (int i = 0; i < frames; ++i) {
    const auto& row = samples[i];
    if (!integer(row, "frame", i) || !number(row, "meanCm", 0, 200000) ||
        !number(row, "maxCm", 0, 200000) || row.at("meanCm") > row.at("maxCm"))
      fail("invalid sewing sample at frame " + std::to_string(i));
  }
  const bool seamPass = number(sewing, "finalMeanGapCm", 0, .2) && number(sewing, "finalMaxGapCm", 0, 1);
  if (!seamPass) fail("final seam closure exceeds tolerance or is missing");
  if (seamPass && frames && samples.is_array() && samples.size() == static_cast<size_t>(frames)) {
    const auto& last = samples.back();
    if (!number(last, "meanCm", 0, 200000) || !number(last, "maxCm", 0, 200000) ||
        std::abs(last.at("meanCm").get<double>() - sewing.at("finalMeanGapCm").get<double>()) > .001 ||
        std::abs(last.at("maxCm").get<double>() - sewing.at("finalMaxGapCm").get<double>()) > .001)
      fail("final sewing summary disagrees with trajectory");
  }
  const auto steps = member(ccd, "steps");
  if (!frames || !yes(ccd, "allTestedStepsCollisionFree") || !integer(ccd, "framesAudited", frames) ||
      !steps.is_array() || steps.size() != static_cast<size_t>(frames - 1)) fail("complete swept CCD required");
  else for (int i = 0; i < frames - 1; ++i)
    if (!integer(steps[i], "fromFrame", i) || !integer(steps[i], "toFrame", i + 1) ||
        !yes(steps[i], "collisionFree")) fail("swept collision or missing interval " + std::to_string(i));
  const auto final = member(clearance, "final");
  const auto shoulder = member(final, "shoulder");
  if (!frames || !integer(clearance, "framesMeasured", frames) || !integer(final, "frame", frames - 1) ||
      !number(shoulder, "meanCm", 0, 1.5) || !number(shoulder, "p90Cm", 0, 3) ||
      !number(member(final, "torso"), "meanCm", 0, 2)) fail("final shoulder/torso fit failed or missing");
  return {{"accepted", errors.empty()}, {"errors", errors}, {"frames", frames},
          {"scope", "independent report acceptance; not textile calibration or visual certification"},
          {"solver", "st-tech/ppf-contact-solver"}};
}

PpfBridge::Json PpfBridge::makeJobEnvelope(const Json& project, int frames) {
  if (!project.is_object() || !project.contains("pieces") || !project.at("pieces").is_array() ||
      project.at("pieces").empty())
    throw std::invalid_argument("PPF service needs the canonical garment project");
  if (frames < 2 || frames > 1200) throw std::invalid_argument("PPF frame count out of range");
  // Shape used by the actual running ppf_backend/server.mjs POST /jobs.
  // Submission is still gated by the PPF server's own mesh/contact validation.
  return {{"project", project}, {"options", {{"frames", frames}, {"allowExplodedExperimental", false}}}};
}

} // namespace garment
