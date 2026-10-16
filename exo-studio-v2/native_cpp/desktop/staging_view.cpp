#include "staging_view.hpp"

#include <QMouseEvent>
#include <QPainter>
#include <QPainterPath>
#include <QWheelEvent>

#include <algorithm>
#include <cmath>
#include <exception>
#include <vector>

using garment::Json;

namespace {

double member(const Json& value, const char* key, double fallback = 0) {
  if (value.is_object() && value.contains(key) && value.at(key).is_number())
    return value.at(key).get<double>();
  return fallback;
}

struct Plane {
  QPolygonF outline;
  double depth;
  QColor color;
  bool selected;
};

} // namespace

StagingView::StagingView(QWidget* parent) : QWidget(parent) {
  setObjectName("NativeStagingCanvas");
  setMinimumWidth(290);
  setMouseTracking(true);
  setAutoFillBackground(false);
  setToolTip("Native staging projection. Not a PPF fit or physics result. Drag to orbit, scroll to zoom.");
}

void StagingView::setDocument(const garment::Document& document) {
  snapshot_ = document.data();
  try {
    // Native C++ tessellation is cached on document edits, never rebuilt
    // during camera orbit or each paint. This is the CAD rest state only.
    meshes_ = garment::buildProjectPatternMeshes(snapshot_,10,0);
    meshError_.clear();
  } catch (const std::exception& ex) {
    meshes_.clear();
    meshError_=QString::fromUtf8(ex.what());
  }
  update();
}

void StagingView::selectPiece(const std::string& id) {
  selected_ = id;
  update();
}

void StagingView::mousePressEvent(QMouseEvent* event) { lastPointer_ = event->pos(); }
void StagingView::mouseMoveEvent(QMouseEvent* event) {
  if (!(event->buttons() & Qt::LeftButton)) return;
  const auto delta = event->pos() - lastPointer_;
  yaw_ += delta.x() * .008;
  pitch_ = std::clamp(pitch_ + delta.y() * .005, -.8, .65);
  lastPointer_ = event->pos();
  update();
}
void StagingView::wheelEvent(QWheelEvent* event) {
  zoom_ = std::clamp(zoom_ * (event->angleDelta().y() > 0 ? 1.10 : 1 / 1.10), .35, 5.0);
  update();
  event->accept();
}

void StagingView::paintEvent(QPaintEvent*) {
  QPainter painter(this);
  painter.setRenderHint(QPainter::Antialiasing);
  painter.fillRect(rect(), QColor("#222a35"));
  painter.setPen(QColor("#9baabb"));
  painter.setFont(QFont("Helvetica Neue", 11, QFont::DemiBold));
  painter.drawText(QRect(18, 13, width()-36, 25), "NATIVE 3D  |  INITIAL STAGING");
  painter.setFont(QFont("Helvetica Neue", 9));
  painter.setPen(QColor("#7e90a5"));
  painter.drawText(QRect(18, 36, width()-36, 23),
    "Native C++ triangulated panel contours • orbit: drag • zoom: scroll");

  const auto projection = [&](double x, double y, double z) {
    const double cx = std::cos(yaw_), sx = std::sin(yaw_);
    const double cp = std::cos(pitch_), sp = std::sin(pitch_);
    double u = x * cx + z * sx;
    double depth = -x * sx + z * cx;
    double elevation = (y - .90) * cp - depth * sp;
    double back = (y - .90) * sp + depth * cp;
    const double scale = std::min(width() * .76, height() * .55) * zoom_;
    return std::pair<QPointF, double>{QPointF(width()/2. + u * scale, height()*.72 - elevation * scale), back};
  };

  painter.setPen(QPen(QColor("#3b4c60"),1));
  for (int i=-8;i<=8;++i) {
    auto a=projection(i*.15,0,-1.2).first;
    auto b=projection(i*.15,0, 1.2).first;
    painter.drawLine(a,b);
    auto c=projection(-1.2,0,i*.15).first;
    auto d=projection( 1.2,0,i*.15).first;
    painter.drawLine(c,d);
  }
  // A minimal anatomical orientation guide, not Thomas's actual collision skin.
  painter.setPen(QPen(QColor(90,110,134,165),1));
  for (double elevation=.7;elevation<=1.7;elevation+=.16) {
    QPolygonF section;
    for (int j=0;j<=36;++j) {
      const double theta=j*2*3.141592653589793/36;
      auto [point,depth]=projection(.16*std::sin(theta),elevation,-.03+.11*std::cos(theta));
      (void)depth;
      section << point;
    }
    painter.drawPolyline(section);
  }

  if (!snapshot_.is_object() || !snapshot_.contains("pieces")) return;
  std::vector<Plane> planes;
  std::size_t index=0;
  std::size_t triangleCount=0;
  for (const auto& mesh : meshes_) {
    auto pieceIt=std::find_if(snapshot_["pieces"].begin(),snapshot_["pieces"].end(),
      [&](const Json& piece) {return piece.at("id").get<std::string>()==mesh.pieceId;});
    if (pieceIt==snapshot_["pieces"].end() || mesh.vertices.size()<3) continue;
    const Json& piece=*pieceIt;
    auto arrangement = piece.value("arrangement3d", Json::object());
    const auto id = mesh.pieceId;
    const double x = member(arrangement,"x") + member(arrangement,"stagingOffsetX");
    const double y = member(arrangement,"y",.90);
    const double z = member(arrangement,"z") + member(arrangement,"stagingOffsetZ");
    const double rotation = member(arrangement,"stagingRotationY")*3.141592653589793/180;
    const double cosine=std::cos(rotation),sine=std::sin(rotation);
    QPolygonF points;
    double depthAvg=0;
    for (const auto& vertex:mesh.vertices) {
      double u = vertex.positionCm.x*.01;
      double v = vertex.positionCm.y*.01;
      auto [pos,back] = projection(x + u*cosine,y + v,z + u*sine);
      points << pos;
      depthAvg += back;
    }
    static const QColor colors[] = {QColor("#acb9c7"),QColor("#7f9dab"),
                                    QColor("#b7a89e"),QColor("#abb69f")};
    QColor fabricColor=colors[index%4];
    const auto fabricId=piece.value("fabricId",std::string("main"));
    if(snapshot_.contains("fabrics") && snapshot_["fabrics"].is_object() &&
       snapshot_["fabrics"].contains(fabricId)) {
      const auto& fabric=snapshot_["fabrics"][fabricId];
      if(fabric.is_object()) {
        if(fabric.contains("color") && fabric["color"].is_string()) {
          QColor requested(QString::fromStdString(fabric["color"].get<std::string>()));
          if(requested.isValid()) fabricColor=requested;
        }
        const double opacity=member(fabric,"opacity",1.);
        fabricColor.setAlphaF(std::clamp(opacity,.10,1.));
      }
    }
    // A non-PBR viewport visualization: lighten dark fabrics for legible
    // edges against the neutral staging canvas, not colorimetric parity.
    if(fabricColor.lightnessF()<.40) fabricColor=fabricColor.lighter(170);
    planes.push_back({points, depthAvg/mesh.vertices.size(),fabricColor,id==selected_});
    triangleCount+=mesh.triangles.size();
    ++index;
  }
  std::sort(planes.begin(),planes.end(),[](const Plane&a,const Plane&b){return a.depth<b.depth;});
  for (const auto& plane : planes) {
    auto fill=plane.color;
    if(fill.alpha()==255) fill.setAlpha(215);
    painter.setBrush(fill);
    painter.setPen(QPen(plane.selected ? QColor("#ebae50") : QColor("#485769"),plane.selected ? 2.3 : 1.1));
    painter.drawPolygon(plane.outline);
  }
  painter.setPen(QColor("#a5acb3"));
  if(!meshError_.isEmpty()) {
    painter.setPen(QColor("#f1b56d"));
    painter.drawText(QRect(18,height()-73,width()-36,28),
      "Mesh preview rejected: "+meshError_);
  }
  painter.setPen(QColor("#a5acb3"));
  painter.drawText(QRect(18,height()-45,width()-36,30),
    QString("Native rest geometry: %1 panels / %2 triangles • no cloth simulation")
      .arg(static_cast<qulonglong>(planes.size()))
      .arg(static_cast<qulonglong>(triangleCount)));
}
