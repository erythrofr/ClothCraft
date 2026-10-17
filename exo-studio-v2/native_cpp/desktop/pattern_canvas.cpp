#include "pattern_canvas.hpp"
#include "drafting_snapping.hpp"

#include <QBrush>
#include <QFont>
#include <QGraphicsEllipseItem>
#include <QGraphicsPathItem>
#include <QGraphicsScene>
#include <QGraphicsSceneMouseEvent>
#include <QGraphicsTextItem>
#include <QPainter>
#include <QPainterPath>
#include <QPen>
#include <QTimer>
#include <QWheelEvent>

#include <cmath>
#include <utility>

using garment::Json;

namespace {

class PiecePath final : public QGraphicsPathItem {
 public:
  explicit PiecePath(QObject* owner, std::function<void()> pressed)
    : owner_(owner), pressed_(std::move(pressed)) {}
 protected:
  void mousePressEvent(QGraphicsSceneMouseEvent* event) override {
    if (pressed_) QTimer::singleShot(0, owner_, pressed_);
    QGraphicsPathItem::mousePressEvent(event);
  }
 private:
  QObject* owner_;
  std::function<void()> pressed_;
};

class PointHandle final : public QGraphicsEllipseItem {
 public:
  PointHandle(QObject* owner, QPointF initial, std::function<void()> pressed,
              std::function<void(QPointF,bool)> released)
      : QGraphicsEllipseItem(-4.4, -4.4, 8.8, 8.8), owner_(owner), start_(initial),
        pressed_(std::move(pressed)), released_(std::move(released)) {
    setPos(initial);
    setFlag(ItemIsMovable);
    setFlag(ItemSendsGeometryChanges);
    setCursor(Qt::CrossCursor);
    setZValue(14);
    setPen(QPen(QColor("#fefefe"), 1.25));
    setBrush(QBrush(QColor("#e0a844")));
  }
 protected:
  void mousePressEvent(QGraphicsSceneMouseEvent* event) override {
    if (pressed_) QTimer::singleShot(0, owner_, pressed_);
    QGraphicsEllipseItem::mousePressEvent(event);
  }
  void mouseReleaseEvent(QGraphicsSceneMouseEvent* event) override {
    QGraphicsEllipseItem::mouseReleaseEvent(event);
    if (released_ && QLineF(start_, pos()).length() > .02) {
      const auto point=pos();
      const bool axisConstraint=event->modifiers().testFlag(Qt::ShiftModifier);
      QTimer::singleShot(0, owner_, [cb=released_,point,axisConstraint]{cb(point,axisConstraint);});
    }
  }
 private:
  QObject* owner_;
  QPointF start_;
  std::function<void()> pressed_;
  std::function<void(QPointF,bool)> released_;
};

double number(const Json& value, const char* key, double fallback = 0) {
  if (value.is_object() && value.contains(key) && value.at(key).is_number())
    return value.at(key).get<double>();
  return fallback;
}

}  // namespace

PatternCanvas::PatternCanvas(QWidget* parent) : QGraphicsView(parent), canvas_(new QGraphicsScene(this)) {
  setObjectName("NativePatternCanvas");
  setScene(canvas_);
  setViewportUpdateMode(QGraphicsView::BoundingRectViewportUpdate);
  setRenderHint(QPainter::Antialiasing);
  setDragMode(QGraphicsView::ScrollHandDrag);
  setTransformationAnchor(QGraphicsView::AnchorUnderMouse);
  setFrameShape(QFrame::NoFrame);
  setBackgroundBrush(QColor("#f3f4f5"));
}

void PatternCanvas::drawBackground(QPainter* painter, const QRectF& rect) {
  QGraphicsView::drawBackground(painter, rect);
  const double step = 10 * kPixelsPerCm;
  QPen faint(QColor("#e4e7ea"), 0);
  painter->setPen(faint);
  const auto xmin = std::floor(rect.left() / step) * step;
  const auto ymin = std::floor(rect.top() / step) * step;
  for (double x = xmin; x < rect.right(); x += step) painter->drawLine(QLineF(x, rect.top(), x, rect.bottom()));
  for (double y = ymin; y < rect.bottom(); y += step) painter->drawLine(QLineF(rect.left(), y, rect.right(), y));
  painter->setPen(QPen(QColor("#bdc4cb"), 0));
  painter->drawLine(QLineF(0, rect.top(), 0, rect.bottom()));
  painter->drawLine(QLineF(rect.left(), 0, rect.right(), 0));
}

void PatternCanvas::wheelEvent(QWheelEvent* event) {
  const double factor = event->angleDelta().y() > 0 ? 1.12 : 1 / 1.12;
  if (transform().m11() * factor >= .08 && transform().m11() * factor <= 16)
    scale(factor, factor);
  event->accept();
}

void PatternCanvas::focusPatterns() {
  if (canvas_->items().empty()) return;
  const auto bounds = canvas_->itemsBoundingRect().adjusted(-38, -38, 38, 38);
  setSceneRect(bounds);
  fitInView(bounds, Qt::KeepAspectRatio);
}

void PatternCanvas::refresh(const garment::Document& document, const std::string& selectedPiece,
                             int selectedPoint) {
  canvas_->clear();
  setDragMode(QGraphicsView::ScrollHandDrag);
  for (const Json& piece : document.data().at("pieces")) {
    const auto& id = piece.at("id").get_ref<const std::string&>();
    const bool selected = id == selectedPiece;
    const auto& pts = piece.at("points");
    auto layout = piece.value("layout2d", Json::object());
    const QPointF offset(number(layout,"x")*kPixelsPerCm, -number(layout,"y")*kPixelsPerCm);
    const auto xy = [&](const Json& p) {
      return QPointF(p.at("x").get<double>()*kPixelsPerCm, -p.at("y").get<double>()*kPixelsPerCm);
    };
    QPainterPath path(xy(pts[0]));
    for (std::size_t edge = 0; edge < pts.size(); ++edge) {
      const auto& curves = piece.value("curves", Json::object());
      auto key = std::to_string(edge);
      const QPointF next = xy(pts[(edge + 1) % pts.size()]);
      if (curves.is_object() && curves.contains(key) && curves[key].is_object()) {
        const auto& curve = curves[key];
        const QPointF control(curve.at("cx").get<double>()*kPixelsPerCm,
                              -curve.at("cy").get<double>()*kPixelsPerCm);
        path.quadTo(control, next);
      } else {
        path.lineTo(next);
      }
    }
    path.closeSubpath();
    auto* graphic = new PiecePath(this,[this, id] { if (onSelectPiece) onSelectPiece(id); });
    graphic->setPath(path);
    graphic->setPos(offset);
    graphic->setPen(QPen(QColor(selected ? "#bb801d" : "#7a858f"), selected ? 2.2 : 1.2));
    graphic->setBrush(QBrush(QColor("#d5dbe0"))); // keep neutral fill even when selected
    graphic->setZValue(selected ? 3 : 1);
    graphic->setToolTip(QString::fromStdString(id));
    canvas_->addItem(graphic);

    QFont labelFont;
    labelFont.setPointSize(10);
    labelFont.setWeight(QFont::DemiBold);
    auto* label = canvas_->addText(QString::fromStdString(piece.value("name", id)), labelFont);
    label->setDefaultTextColor(QColor("#414a54"));
    label->setPos(offset + path.boundingRect().center() - QPointF(30, 8));
    label->setZValue(7);
    if (!selected) continue;
    for (std::size_t i = 0; i < pts.size(); ++i) {
      const auto original = xy(pts[i]) + offset;
      auto* handle = new PointHandle(this,original,
        [this,id,i] {if (onSelectPoint) onSelectPoint(id,i);},
        [this, id, i, offset, sourceX=pts[i].at("x").get<double>(),
         sourceY=pts[i].at("y").get<double>()](QPointF released,bool axisConstraint) {
        const auto local = released - offset;
        Json destination={{"x",local.x()/kPixelsPerCm},{"y",-local.y()/kPixelsPerCm}};
        if(axisConstraint)
          destination=garment::constrainDraftAxis({{"x",sourceX},{"y",sourceY}},destination);
        if(gridSnapEnabled_)
          destination=garment::snapDraftGrid(destination,1.);
        if(onMovePoint)onMovePoint(id,i,destination.at("x").get<double>(),
                                   destination.at("y").get<double>());
      });
      if (static_cast<int>(i) == selectedPoint) {
        handle->setRect(-5.6,-5.6,11.2,11.2);
        handle->setBrush(QColor("#3b7dcb"));
      }
      handle->setToolTip(QString("%1 · point %2").arg(QString::fromStdString(id)).arg(static_cast<qulonglong>(i)));
      canvas_->addItem(handle);
    }
  }
}
