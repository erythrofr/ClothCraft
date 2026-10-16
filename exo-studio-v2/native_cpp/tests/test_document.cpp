#include "garment_document.hpp"
#include "dxf_export.hpp"
#include "grading.hpp"
#include "cutting_geometry.hpp"

#include <cassert>
#include <cmath>
#include <functional>
#include <iostream>

using garment::Document;
using garment::Json;

static bool rejects(const std::function<void()>& fn) {
  try { fn(); } catch (const std::exception&) { return true; }
  return false;
}

static Json fixture() {
  return {
    {"id", "sample"}, {"name", "Sample"}, {"version", 21}, {"revision", 2}, {"units", "cm"},
    {"someFutureField", {{"nested", Json::array({3, "keep", true})}}},
    {"fabrics", {{"main", {{"name", "Cotton"}, {"texture", "custom.png"}}}}},
    {"pieces", Json::array({
      {{"id", "front"}, {"name", "Front"}, {"points", Json::array({
        {{"x", 0}, {"y", 0}, {"id", "p0"}},
        {{"x", 10}, {"y", 0}, {"gradeRule", "retain"}},
        {{"x", 10}, {"y", 10}}, {{"x", 0}, {"y", 10}}})},
        {"curves", {{"0", {{"cx", 5}, {"cy", -5}, {"metadata", "not overwritten on inspect"}}}}},
        {"edgeSeamAllowances", {{"1", 1.2}}}, {"seamAllowance", 1.0},
        {"layout2d", {{"x", 24}, {"y", 15}}}, {"locked", false}},
      {{"id", "back"}, {"name", "Back"}, {"points", Json::array({
        {{"x", 0}, {"y", 0}}, {{"x", 10}, {"y", 0}},
        {{"x", 10}, {"y", 10}}, {{"x", 0}, {"y", 10}}})}}
    })},
    {"seams", Json::array({
      {{"id", "test-seam"}, {"a", {{"pieceId", "front"}, {"edgeIndex", 1}}},
                             {"b", {{"pieceId", "back"}, {"edgeIndex", 1}}},
                             {"customStitchRule", "preserve-me"}}
    })}
  };
}

int main() {
  Document original(fixture());
  assert(original.validate().ok());
  assert(original.data() == fixture());  // exact lossless import
  assert(original.summary()["pieceCount"] == 2);
  assert(original.summary()["seamCount"] == 1);
  assert(original.edgeInfo("front", 0)["lengthCm"].get<double>() > 10);  // Bézier is longer than its chord
  assert(std::abs(original.edgeInfo("front", 1)["seamAllowanceCm"].get<double>() - 1.2) < 1e-12);
  assert(original.seamInfo("test-seam")["mismatchPercent"] == 0);

  // First genuinely native manufacturing output: closed DXF outlines in mm,
  // quadratic Bézier tessellation, deterministic export, no document mutation.
  const auto dxfBefore = original.data();
  const auto dxf = garment::exportCuttingDxf(original, 24);
  assert(dxf == garment::exportCuttingDxf(original, 24));
  assert(dxf.find("$INSUNITS\n70\n4\n") != std::string::npos);
  assert(dxf.find("CUT_FRONT") != std::string::npos);
  assert(dxf.find("CUT_BACK") != std::string::npos);
  assert(dxf.find("0\nPOLYLINE\n") != std::string::npos);
  assert(dxf.find("0\nVERTEX\n") != std::string::npos);
  assert(dxf.find("0\nEOF\n") != std::string::npos);
  assert(original.data() == dxfBefore);
  // Stitchline DXF remains byte-stable, but a separate native cutline path
  // now offsets individual sewn edges and preserves cm->mm conversion.
  const auto originalOutline=garment::sampleCutBoundary(original.data()["pieces"][0],24);
  assert(originalOutline.size()>4);
  assert(std::abs(originalOutline[0].x-0.)>0.01 || std::abs(originalOutline[0].y)>0.01);
  const auto outlineDxf=garment::exportCuttingDxf(original,24,true);
  assert(outlineDxf!=dxf);
  assert(original.data()==dxfBefore);

  // Independent size grading must not mutate the baseline document or revision.
  Json gradedSource=fixture();
  gradedSource["grading"]={{"sizes",Json::array({"S","M","L"})},
                           {"baseSize","M"},{"widthPerSizeCm",4.0},{"lengthPerSizeCm",2.0}};
  gradedSource["pieces"][0]["points"][1]["gradeRule"]={{"enabled",true},
    {"dxPerSize",1.5},{"dyPerSize",-2.0}};
  gradedSource["customMeasurements"]=Json::array({{{"pieceId","front"},
    {"a",{{"x",0},{"y",0}}},{"b",{{"x",10},{"y",10}}}}});
  Document ungraded(gradedSource);
  const auto baseline=ungraded.data();
  auto sizeM=garment::gradeProject(ungraded,"M");
  assert(sizeM["pieces"][0]["points"]==baseline["pieces"][0]["points"]);
  auto sizeL=garment::gradeProject(ungraded,"L");
  assert(sizeL["pieces"][0]["points"][1]["x"]==11.5);
  assert(sizeL["pieces"][0]["points"][1]["y"]==-2.0);
  assert(sizeL["pieces"][0]["curves"]["0"].contains("metadata"));
  assert(sizeL["pieces"][0]["gradeSize"]=="L");
  assert(sizeL["seams"]==baseline["seams"]);
  assert(sizeL["someFutureField"]==baseline["someFutureField"]);
  assert(sizeL["revision"]==baseline["revision"]);
  auto sizes=garment::gradeSizeRun(ungraded);
  assert(sizes.size()==3 && sizes.contains("S") && sizes.contains("L"));
  assert(rejects([&]{(void)garment::gradeProject(ungraded,"NO_SUCH_SIZE");}));
  assert(ungraded.data()==baseline);
  assert(rejects([&]{ garment::exportCuttingDxf(original, 0); }));
  assert(original.data() == dxfBefore);

  auto stale = original.data();
  assert(rejects([&]{ original.apply("move-point", {{"pieceId", "front"}, {"pointIndex", 1}, {"x", 12}, {"y", 0}}, 1); }));
  assert(original.data() == stale);
  assert(rejects([&]{ original.apply("move-point", {{"pieceId", "front"}, {"pointIndex", 1}, {"x", 0}, {"y", 0}}, 2); }));
  assert(original.data() == stale);
  assert(rejects([&]{ original.apply("set-edge-allowance", {{"pieceId", "front"}, {"edgeIndex", 1}, {"allowanceCm", -5}}); }));
  assert(original.data() == stale);
  assert(rejects([&]{ original.apply("add-seam", {{"seam", {{"id", "bad"}, {"a", {{"pieceId", "missing"}, {"edgeIndex", 0}}}, {"b", {{"pieceId", "front"}, {"edgeIndex", 0}}}}}}); }));
  assert(original.data() == stale);

  auto tx = original.apply("move-point", {{"pieceId", "front"}, {"pointIndex", 1}, {"x", 12}, {"y", 0}}, 2);
  assert(tx.changed && tx.beforeRevision == 2 && tx.afterRevision == 3);
  assert(tx.inverseSnapshot == fixture());
  assert(original.data()["pieces"][0]["points"][1]["gradeRule"] == "retain");
  assert(original.data()["someFutureField"] == fixture()["someFutureField"]);
  assert(original.data()["fabrics"] == fixture()["fabrics"]);
  assert(original.data()["seams"] == fixture()["seams"]);
  assert(original.data()["revision"] == 3);
  auto noChange = original.apply("move-point", {{"pieceId", "front"}, {"pointIndex", 1}, {"x", 12}, {"y", 0}}, 3);
  assert(!noChange.changed && original.data()["revision"] == 3);
  original.restore(tx.inverseSnapshot);
  assert(original.data() == fixture());

  original.apply("set-curve", {{"pieceId", "front"}, {"edgeIndex", 3}, {"cx", -4}, {"cy", 5}});
  assert(original.edgeInfo("front", 3)["isCurve"] == true);
  assert(original.edgeInfo("front", 3)["lengthCm"].get<double>() > 10);
  original.apply("remove-curve", {{"pieceId", "front"}, {"edgeIndex", 3}});
  assert(original.edgeInfo("front", 3)["isCurve"] == false);
  original.apply("set-edge-allowance", {{"pieceId", "front"}, {"edgeIndex", 1}, {"allowanceCm", 2.5}});
  assert(original.edgeInfo("front", 1)["seamAllowanceCm"] == 2.5);
  original.apply("set-layout", {{"pieceId", "front"}, {"x", 57}, {"y", 31}});
  assert(original.data()["pieces"][0]["layout2d"]["x"] == 57);
  assert(rejects([&]{ original.apply("remove-piece", {{"pieceId", "front"}}); }));

  // A non-sewn Bézier may be split without damaging its analytic length,
  // paired-seam edge indexing, original point IDs or unknown curve metadata.
  Document segmented(fixture());
  const double oldCurveLength=segmented.edgeInfo("front",0)["lengthCm"].get<double>();
  auto splitTx=segmented.apply("split-edge",{{"pieceId","front"},{"edgeIndex",0},
                                             {"fraction",.37},{"pointId","new-point-1"}});
  assert(splitTx.changed);
  assert(segmented.data()["pieces"][0]["points"].size() == 5);
  assert(segmented.data()["pieces"][0]["points"][0]["id"] == "p0");
  assert(segmented.data()["pieces"][0]["points"][1]["id"] == "new-point-1");
  assert(segmented.data()["pieces"][0]["curves"]["0"]["metadata"] == "not overwritten on inspect");
  assert(segmented.data()["pieces"][0]["curves"]["1"]["metadata"] == "not overwritten on inspect");
  const double both=segmented.edgeInfo("front",0)["lengthCm"].get<double>()+
                    segmented.edgeInfo("front",1)["lengthCm"].get<double>();
  assert(std::abs(oldCurveLength-both) < 1e-6);
  assert(segmented.data()["pieces"][0]["edgeSeamAllowances"]["2"] == 1.2);
  assert(segmented.data()["seams"][0]["a"]["edgeIndex"] == 2);
  assert(segmented.seamInfo("test-seam")["mismatchPercent"] == 0);
  assert(rejects([&]{ segmented.apply("split-edge",{{"pieceId","front"},{"edgeIndex",2},
                                               {"fraction",.5}}); }));
  segmented.restore(splitTx.inverseSnapshot);
  assert(segmented.data() == fixture());

  Document editedCurve(fixture());
  editedCurve.apply("set-curve", {{"pieceId","front"},{"edgeIndex",0},
                                    {"cx",6},{"cy",-4}});
  assert(editedCurve.data()["pieces"][0]["curves"]["0"]["metadata"] == "not overwritten on inspect");

  auto removed = original.apply("remove-seam", {{"seamId", "test-seam"}});
  assert(removed.changed);
  original.apply("remove-piece", {{"pieceId", "back"}});
  assert(original.summary()["pieceCount"] == 1);
  assert(original.validate().ok());
  assert(rejects([&]{ Document x({{"pieces", Json::array({{{"id", "x"}, {"points", Json::array({
    {{"x", 0}, {"y", 0}}, {{"x", 0}, {"y", 0}}, {{"x", 5}, {"y", 5}}
  })}}})}}); (void)x; }));
  std::cout << "PASS native C++17 garment document: lossless JSON, revisions, curves, sewing, rollback, validation\n";
}
