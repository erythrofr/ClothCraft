#pragma once

#include "garment_document.hpp"

#include <QMainWindow>
#include <QString>

#include <functional>
#include <memory>
#include <vector>

class PatternCanvas;
class StagingView;
class QListWidget;
class QDoubleSpinBox;
class QLabel;
class QAction;
class QComboBox;
class QPushButton;
class QSplitter;
class QDockWidget;

// Fully native Qt Widgets desktop shell; C++ Document is the only editable
// state. No React, WKWebView, JavaScript pattern editor or unvalidated solver.
class MainWindow final : public QMainWindow {
 public:
  explicit MainWindow(garment::Json initial, const QString& sourcePath = {},
                      QWidget* parent = nullptr);

 private:
  std::unique_ptr<garment::Document> document_;
  PatternCanvas* canvas_ = nullptr;
  StagingView* stage_ = nullptr;
  QSplitter* workspaceSplitter_ = nullptr;
  QDockWidget* patternDock_ = nullptr;
  QDockWidget* patternInspectorDock_ = nullptr;
  QDockWidget* seamDock_ = nullptr;
  QDockWidget* productionDock_ = nullptr;
  QListWidget* pieces_ = nullptr;
  QListWidget* seams_ = nullptr;
  QLabel* selectionLabel_ = nullptr;
  QLabel* seamLabel_ = nullptr;
  QDoubleSpinBox* pointX_ = nullptr;
  QDoubleSpinBox* pointY_ = nullptr;
  QDoubleSpinBox* allowance_ = nullptr;
  QDoubleSpinBox* curveX_ = nullptr;
  QDoubleSpinBox* curveY_ = nullptr;
  QDoubleSpinBox* splitPercent_ = nullptr;
  QPushButton* setCurve_ = nullptr;
  QPushButton* straightenEdge_ = nullptr;
  QPushButton* splitEdge_ = nullptr;
  QAction* undoAction_ = nullptr;
  QAction* redoAction_ = nullptr;
  QComboBox* sizes_ = nullptr;
  QListWidget* markerFabrics_ = nullptr;
  QLabel* productionStatus_ = nullptr;
  std::unique_ptr<garment::Document> preview_;
  QString sourceFile_;
  std::string selectedPiece_;
  int selectedPoint_ = -1;
  std::vector<garment::Json> undo_;
  std::vector<garment::Json> redo_;
  bool updating_ = false;

  void makeMenus();
  void makeDocks();
  void applyWorkspaceProfile(const std::string& preset);
  void selectPiece(const std::string& id);
  void selectPoint(std::size_t index);
  void updateAll(bool fitCanvas = false);
  void updateInspector();
  void mutate(const std::string& command, const garment::Json& args);
  void undo();
  void redo();
  void openDocument();
  void saveCopy();
  void refreshProduction();
  void showProductionPreflight();
  void showSewingConstructionAudit();
  void showNativeClothConstruction();
  void showNativeSolverPayloadPreflight();
  void showNativeCloCommandReference();
  void previewProceduralTextile();
  void showMarkerLayoutSummary();
  void exportSizeDxf();
  void exportConstructionDxf();
  void showFlatMeshCount();
  void exportBom();
  void exportPomCsv();
  void exportTechPack();
  void exportMarkerSvg();
  void exportMarkerPdf();
  void exportFlatObj();
  void exportFlatGltf();
  void exportFactoryZip();
  void exportFullFactoryDevelopmentZip();
  bool saveGenerated(const QString& title,const QString& suggested,
                     const QString& filter,const std::string& bytes);
  std::string activeSize() const;
  static QDoubleSpinBox* measurement(QWidget* parent);
};
