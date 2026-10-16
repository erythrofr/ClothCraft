#pragma once

#include "garment_document.hpp"
#include "pattern_mesh.hpp"

#include <QWidget>
#include <QString>
#include <vector>

// Native (non-browser) 3D staging projection of CAD panels.
// It intentionally does NOT call a cloth solver or depict a validated drape.
class StagingView final : public QWidget {
 public:
  explicit StagingView(QWidget* parent = nullptr);
  void setDocument(const garment::Document& document);
  void selectPiece(const std::string& id);

 protected:
  void paintEvent(QPaintEvent*) override;
  void mousePressEvent(QMouseEvent*) override;
  void mouseMoveEvent(QMouseEvent*) override;
  void wheelEvent(QWheelEvent*) override;

 private:
  garment::Json snapshot_;
  std::vector<garment::PatternMesh> meshes_;
  QString meshError_;
  std::string selected_;
  QPoint lastPointer_;
  double yaw_ = .42;
  double pitch_ = -.16;
  double zoom_ = 1;
};
