#pragma once

#include "garment_document.hpp"

#include <QGraphicsView>
#include <functional>
#include <string>
#include <cstddef>

class QGraphicsScene;

// Native Qt graphics canvas. Only the shared C++ Document owns pattern data;
// this widget renders and emits edit commands, never stores an alternate CAD
// model or mutates project JSON behind the document engine's back.
class PatternCanvas final : public QGraphicsView {
 public:
  explicit PatternCanvas(QWidget* parent = nullptr);
  void refresh(const garment::Document& document, const std::string& selectedPiece,
               int selectedPoint);
  void focusPatterns();
  void setGridSnapEnabled(bool enabled) noexcept { gridSnapEnabled_ = enabled; }
  std::function<void(const std::string&)> onSelectPiece;
  std::function<void(const std::string&, std::size_t)> onSelectPoint;
  std::function<void(const std::string&, std::size_t, double, double)> onMovePoint;

 protected:
  void drawBackground(QPainter* painter, const QRectF& rect) override;
  void wheelEvent(QWheelEvent* event) override;

 private:
  QGraphicsScene* canvas_;
  bool gridSnapEnabled_ = false;
  constexpr static double kPixelsPerCm = 3.5;
};
