#include "ppf_bridge.hpp"

#include <cassert>
#include <iostream>

using garment::PpfBridge;
using Json = nlohmann::json;

int main() {
  Json shell = {{"protocol", "garment-studio.ppf-shell"},
    {"shell", {{"vertices", Json::array({Json::array({0,0,0}), Json::array({.01,0,0}),
                                             Json::array({0,.01,0}), Json::array({.02,0,0})})},
               {"faces", Json::array({Json::array({0,1,2})})},
               {"stitchEdges", Json::array({{{"a",1},{"b",3},{"seamId","side"}}})}}}};
  Json measured = {{"geometryPreservedOrWithinLimit",true},{"bodyAndSelfIntersectionFreeAtInitialPose",true},
                   {"maximumRelativeIntrinsicEdgeChange",.02},{"bodyIntersectionPairs",0},{"selfIntersectionPairs",0}};
  auto good = PpfBridge::validateInitialShell(shell, measured);
  assert(good["ok"] == true);
  assert(good["stitchPairs"] == 1);
  assert(good["fullPhysicalFitVerified"] == false);
  assert(PpfBridge::validateInitialShell(shell, Json::object())["mayRun"] == false);
  shell["shell"]["stitchEdges"][0]["b"] = 2;
  assert(PpfBridge::validateInitialShell(shell, measured)["mayRun"] == false);
  shell["shell"]["stitchEdges"][0]["b"] = 3;
  shell["shell"]["stitchEdges"].push_back(shell["shell"]["stitchEdges"][0]);
  assert(PpfBridge::validateInitialShell(shell, measured)["mayRun"] == false);
  shell["shell"]["stitchEdges"].erase(1);
  shell["shell"]["vertices"][0][0] = "bad";
  assert(PpfBridge::validateInitialShell(shell, measured)["mayRun"] == false);
  shell["shell"]["vertices"][0][0] = 0;
  shell["shell"]["vertices"][3][0] = .9;
  assert(PpfBridge::validateInitialShell(shell, measured)["mayRun"] == false);
  shell["shell"]["vertices"][3][0] = .02;
  measured["bodyIntersectionPairs"] = 1;
  assert(PpfBridge::validateInitialShell(shell, measured)["mayRun"] == false);

  // Deliberately synthetic evidence tests the gate, not physical simulation.
  Json evidence = {
    {"strainLimitRatio", .05},
    {"contact", {{"frames",2}, {"allFramesAvatarIntersectionFree",true},
      {"allFramesSelfIntersectionFree",true}, {"allFramesWithinStrainLimit",true},
      {"perFrame", Json::array()}}},
    {"sewing", {{"framesAnalyzed",2}, {"stitchedPairs",98}, {"finalMeanGapCm",.1},
      {"finalMaxGapCm",.5}, {"samples",Json::array()}}},
    {"ipcCcd", {{"framesAudited",2}, {"allTestedStepsCollisionFree",true},
      {"steps",Json::array({{{"fromFrame",0},{"toFrame",1},{"collisionFree",true}}})}}},
    {"clearance", {{"framesMeasured",2}, {"final",{{"frame",1},
      {"shoulder",{{"meanCm",1},{"p90Cm",2}}},{"torso",{{"meanCm",1}}}}}}}
  };
  for(int i=0;i<2;++i) {
    evidence["contact"]["perFrame"].push_back({{"frame",i},{"avatarTriangleIntersectionPairs",0},
      {"clothSelfIntersectionPairs",0},{"strainLimitViolatingFaces",0},{"maxPrincipalStretch",1.04}});
    evidence["sewing"]["samples"].push_back({{"frame",i},{"meanCm",.1},{"maxCm",.5}});
  }
  assert(PpfBridge::evaluateFitEvidence(evidence)["accepted"] == true);
  auto rejected = [&](Json bad) { assert(PpfBridge::evaluateFitEvidence(bad)["accepted"] == false); };
  rejected(Json()); rejected(Json::object());
  auto bad=evidence; bad["contact"]["perFrame"][0]["avatarTriangleIntersectionPairs"]=1; rejected(bad);
  bad=evidence; bad["contact"]["perFrame"][0]["maxPrincipalStretch"]=1.4; rejected(bad);
  bad=evidence; bad["sewing"]["samples"][1]["meanCm"]=-1; rejected(bad);
  bad=evidence; bad["sewing"]["samples"][1]["maxCm"]=.6; rejected(bad);
  bad=evidence; bad["ipcCcd"]["steps"]=Json::array(); rejected(bad);
  bad=evidence; bad["ipcCcd"]["steps"][0]["toFrame"]=0; rejected(bad);
  bad=evidence; bad["clearance"]["final"]["shoulder"]["meanCm"]=10; rejected(bad);
  bad=evidence; bad.erase("strainLimitRatio"); rejected(bad);
  for(const auto& key:{"contact","sewing","ipcCcd","clearance"}) {
    bad=evidence; bad[key]="malformed"; rejected(bad);
  }
  auto env = PpfBridge::makeJobEnvelope({{"pieces", Json::array({{{"id","front"}}})}},10);
  assert(env["options"]["allowExplodedExperimental"] == false);
  std::cout << "PASS native PPF boundary: real shell preflight and fail-closed Rust solver envelope\n";
}
