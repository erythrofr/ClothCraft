#include "zozo_reference_viewer.hpp"
#include "zozo_reference_dress.hpp"

#include <QDialog>
#include <QHBoxLayout>
#include <QLabel>
#include <QMouseEvent>
#include <QPainter>
#include <QPushButton>
#include <QSlider>
#include <QTimer>
#include <QVBoxLayout>
#include <QWheelEvent>

#include <algorithm>
#include <array>
#include <cmath>
#include <memory>
#include <vector>

namespace {

struct Triangle {std::uint32_t a,b,c;};

class ZozoWireframeCanvas final : public QWidget {
 public:
  explicit ZozoWireframeCanvas(const garment::Json& meshes,QWidget* parent=nullptr)
      : QWidget(parent) {
    setObjectName("NativeZozoReferenceCanvas");
    setMinimumSize(600,400);
    setMouseTracking(true);
    setToolTip("Original recorded ZOZO dress, not a simulated editable garment. Drag to orbit, scroll to zoom.");
    // Downsample only the wireframe visualization, never the recorded vertex
    // data. Native 28,467-vertex frames stay float32 bit-identical to source.
    const auto& body=meshes.at("bodyIndices");
    for(std::size_t i=0;i+2<body.size();i+=3*24)
      bodyEdges_.push_back({body[i].get<std::uint32_t>(),
        body[i+1].get<std::uint32_t>(),body[i+2].get<std::uint32_t>()});
    for(const auto& panel:meshes.at("clothPanels")) {
      const auto& indices=panel.at("indices");
      for(std::size_t i=0;i+2<indices.size();i+=3*8)
        clothEdges_.push_back({indices[i].get<std::uint32_t>(),
          indices[i+1].get<std::uint32_t>(),indices[i+2].get<std::uint32_t>()});
    }
  }

  void setRecordingFrame(std::vector<float> vertices,int frame,int bodyCrossings) {
    vertices_=std::move(vertices);
    frame_=frame;
    bodyCrossings_=bodyCrossings;
    update();
  }

 protected:
  void mousePressEvent(QMouseEvent* event) override {dragStart_=event->pos();}
  void mouseMoveEvent(QMouseEvent* event) override {
    if(!(event->buttons()&Qt::LeftButton))return;
    const auto delta=event->pos()-dragStart_;
    yaw_+=delta.x()*.008;
    pitch_=std::clamp(pitch_+delta.y()*.006,-1.2,1.2);
    dragStart_=event->pos();
    update();
  }
  void wheelEvent(QWheelEvent* event) override {
    zoom_=std::clamp(zoom_*(event->angleDelta().y()>0?1.1:1./1.1),.3,8.);
    event->accept();
    update();
  }
  void paintEvent(QPaintEvent*) override {
    QPainter painter(this);
    painter.fillRect(rect(),QColor("#19212b"));
    painter.setRenderHint(QPainter::Antialiasing,false);
    const auto projected=[&](const std::uint32_t index)->QPointF {
      const auto p=static_cast<std::size_t>(index)*3;
      if(p+2>=vertices_.size())return {};
      const double x=vertices_[p],y=vertices_[p+1],z=vertices_[p+2];
      const double cosine=std::cos(yaw_),sine=std::sin(yaw_);
      const double u=x*cosine+z*sine;
      const double depth=-x*sine+z*cosine;
      const double v=y*std::cos(pitch_)-depth*std::sin(pitch_);
      // Leave a reserved header and lower warning strip rather than allowing
      // recorded head/feet to collide with UI text at the default zoom.
      const double scale=std::min(width()*.60,height()*.50)*zoom_;
      return {width()*.5+u*scale,height()*.49-v*scale};
    };
    // Body reference mesh in muted slate; cloth traced on top in amber.
    painter.setBrush(Qt::NoBrush);
    painter.setPen(QPen(QColor(116,147,175,88),.7));
    for(const auto& t:bodyEdges_) {
      painter.drawLine(projected(t.a),projected(t.b));
      painter.drawLine(projected(t.b),projected(t.c));
      painter.drawLine(projected(t.c),projected(t.a));
    }
    painter.setPen(QPen(QColor(239,195,127,165),.75));
    for(const auto& t:clothEdges_) {
      painter.drawLine(projected(t.a),projected(t.b));
      painter.drawLine(projected(t.b),projected(t.c));
      painter.drawLine(projected(t.c),projected(t.a));
    }
    painter.setRenderHint(QPainter::Antialiasing,true);
    painter.setPen(QColor("#dbe3ed"));
    painter.setFont(QFont("Helvetica Neue",11,QFont::DemiBold));
    painter.drawText(QRect(18,15,width()-36,25),
      "ZOZO / CODIM-IPC  ·  ORIGINAL RECORDED DRESS");
    painter.setFont(QFont("Helvetica Neue",9));
    painter.setPen(QColor("#aebdca"));
    painter.drawText(QRect(18,40,width()-36,20),
      "Native C++ Float32 recording   ·   blue: original body   ·   amber: cloth");
    painter.setPen(bodyCrossings_>0?QColor("#ffae86"):QColor("#b9c7d8"));
    painter.drawText(QRect(18,height()-54,width()-36,22),
      QString("Frame %1/240  ·  original body intersections: %2")
      .arg(frame_).arg(bodyCrossings_));
    painter.setPen(QColor("#f0b38b"));
    painter.drawText(QRect(18,height()-29,width()-36,19),
      "UNVERIFIED ORIGINAL FIT • Recorded intersection failures preserved • Not editable garment simulation");
  }

 private:
  std::vector<Triangle> clothEdges_;
  std::vector<Triangle> bodyEdges_;
  std::vector<float> vertices_;
  int frame_=0;
  int bodyCrossings_=0;
  double yaw_=.35,pitch_=.06,zoom_=1.0;
  QPoint dragStart_;
};
}

void showZozoReferenceViewer(QWidget* parent,const QString& referenceDirectory) {
  auto source=std::make_shared<garment::ZozoReferenceDress>(
    garment::loadZozoDressReference(referenceDirectory.toStdString()));
  QDialog dialog(parent);
  dialog.setObjectName("NativeZozoReferenceViewer");
  dialog.setWindowTitle("Original ZOZO dress · native read-only playback");
  auto* layout=new QVBoxLayout(&dialog);
  auto* warning=new QLabel(
    "This is original ZOZO/Codim-IPC recorded motion, NOT the current garment. "
    "Its original source contains body intersections and has NOT passed fit/CCD certification.",&dialog);
  warning->setWordWrap(true);
  layout->addWidget(warning);
  auto* canvas=new ZozoWireframeCanvas(source->meshes(),&dialog);
  layout->addWidget(canvas,1);
  auto* controls=new QHBoxLayout;
  auto* play=new QPushButton("Play",&dialog);
  auto* slider=new QSlider(Qt::Horizontal,&dialog);
  slider->setObjectName("NativeZozoFrameSlider");
  slider->setRange(0,240);
  slider->setSingleStep(1);
  auto* frameLabel=new QLabel("0 / 240",&dialog);
  controls->addWidget(play);
  controls->addWidget(slider,1);
  controls->addWidget(frameLabel);
  layout->addLayout(controls);
  auto* hint=new QLabel("Recorded 60 fps · playback preview 10 fps · drag to orbit · scroll to zoom",&dialog);
  layout->addWidget(hint);
  auto* timer=new QTimer(&dialog);
  timer->setInterval(100);
  const auto setFrame=[&](const int frame){
    const auto& audit=source->manifest().at("audits").at(static_cast<std::size_t>(frame));
    const int intersections=audit.value("bodyCrossings",0);
    canvas->setRecordingFrame(source->frameVertices(frame),frame,intersections);
    frameLabel->setText(QString("%1 / 240").arg(frame));
  };
  QObject::connect(slider,&QSlider::valueChanged,&dialog,setFrame);
  QObject::connect(play,&QPushButton::clicked,&dialog,[=](){
    if(timer->isActive()){timer->stop();play->setText("Play");}
    else {timer->start();play->setText("Pause");}
  });
  QObject::connect(timer,&QTimer::timeout,&dialog,[=](){
    slider->setValue(slider->value()>=240?0:slider->value()+1);
  });
  setFrame(0);
  dialog.resize(865,700);
  dialog.exec();
}
