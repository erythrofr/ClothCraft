#include "main_window.hpp"

#include "pattern_canvas.hpp"
#include "staging_view.hpp"
#include "zozo_reference_viewer.hpp"
#include "grading.hpp"
#include "marker_layout.hpp"
#include "marker_svg.hpp"
#include "marker_pdf.hpp"
#include "factory_zip.hpp"
#include "factory_package_files.hpp"
#include "dxf_export.hpp"
#include "construction_dxf.hpp"
#include "pattern_mesh.hpp"
#include "obj_export.hpp"
#include "gltf_export.hpp"
#include "bom_export.hpp"
#include "measurement_export.hpp"
#include "tech_pack_export.hpp"
#include "production_preflight.hpp"
#include "sewing_construction.hpp"
#include "drafting_split.hpp"
#include "workspace_profiles.hpp"
#include "cloth_meshing_pipeline.hpp"
#include "cloth_seam_constraints.hpp"
#include "assembled_cloth_snapshot.hpp"
#include "native_simulation_payload_builder.hpp"
#include "clo_menus.hpp"
#include "workspace_command_index.hpp"
#include "textile_procedurals.hpp"

#include <QAction>
#include <QApplication>
#include <QComboBox>
#include <QDockWidget>
#include <QDialog>
#include <QDir>
#include <QDoubleSpinBox>
#include <QFile>
#include <QFileDialog>
#include <QFileInfo>
#include <QFormLayout>
#include <QFrame>
#include <QHBoxLayout>
#include <QImage>
#include <QInputDialog>
#include <QLabel>
#include <QLineEdit>
#include <QListWidget>
#include <QMenuBar>
#include <QMessageBox>
#include <QPushButton>
#include <QPixmap>
#include <QSaveFile>
#include <QScrollArea>
#include <QSignalBlocker>
#include <QSplitter>
#include <QStatusBar>
#include <QTabWidget>
#include <QTimer>
#include <QToolBar>
#include <QVBoxLayout>

#include <cmath>
#include <algorithm>
#include <fstream>

using garment::Document;
using garment::Json;

namespace {

QString label(const Json& piece) {
  return QString::fromStdString(piece.value("name",piece.at("id").get<std::string>()));
}

Json fromFile(const QString& path) {
  QFile source(path);
  if (!source.open(QIODevice::ReadOnly)) throw std::runtime_error("cannot open " + path.toStdString());
  auto content = source.readAll();
  Json data = Json::parse(content.constData(),content.constData()+content.size());
  return data;
}

} // namespace

QDoubleSpinBox* MainWindow::measurement(QWidget* parent) {
  auto* spin = new QDoubleSpinBox(parent);
  spin->setDecimals(4);
  spin->setRange(-100000,100000);
  spin->setSuffix(" cm");
  spin->setSingleStep(.1);
  spin->setKeyboardTracking(false);
  return spin;
}

MainWindow::MainWindow(Json initial,const QString& sourcePath,QWidget* parent)
    : QMainWindow(parent), document_(std::make_unique<Document>(std::move(initial))),
      sourceFile_(sourcePath) {
  setWindowTitle("EXO Sample 3D · C++ Native Preview");
  resize(1430, 900);
  setDockOptions(QMainWindow::AllowNestedDocks | QMainWindow::AnimatedDocks);
  const auto color=QStringLiteral(
    "QMainWindow,QDockWidget,QToolBar {background:#262e39;color:#dce2e8;}"
    "QMenuBar {background:#242b34;color:#e5eaf0;}"
    "QMenuBar::item:selected {background:#4c5c6d;}"
    "QStatusBar {background:#202733;color:#a8b5c1;}"
    "QLabel {color:#d9e2e9;}"
    "QListWidget {background:#313b47;color:#eef2f5;border:0;padding:5px;}"
    "QListWidget::item:selected {background:#4f6476;color:#ffffff;}"
    "QDockWidget::title {background:#2d3743;color:#ced7e2;padding:9px;}"
    "QDoubleSpinBox {background:#435063;color:#ffffff;border:1px solid #536073;padding:5px;}"
    "QPushButton {background:#41566a;color:#f2f4f7;padding:9px;border:0;border-radius:4px;}"
    "QPushButton:hover {background:#526d84;}"
  );
  setStyleSheet(color);
  auto* body = new QSplitter(Qt::Horizontal, this);
  workspaceSplitter_ = body;
  canvas_ = new PatternCanvas(body);
  stage_ = new StagingView(body);
  body->addWidget(canvas_);
  body->addWidget(stage_);
  body->setStretchFactor(0, 3);
  body->setStretchFactor(1, 2);
  setCentralWidget(body);
  makeMenus();
  makeDocks();
  // Docks and the splitter need a real first layout before fitInView.
  // Otherwise the initial transform can leave patterns unreadably tiny.
  QTimer::singleShot(0,this,[this,body] {
    body->setSizes({600,420});
    canvas_->focusPatterns();
  });

  canvas_->onSelectPiece = [this](const std::string& id) { selectPiece(id); };
  canvas_->onSelectPoint = [this](const std::string& id,std::size_t i) {
    selectPiece(id);
    selectPoint(i);
  };
  canvas_->onMovePoint = [this](const std::string& id,std::size_t i,double x,double y) {
    if (preview_) {
      statusBar()->showMessage("Graded size previews are read-only. Select the base size to edit the drafting pattern.",7500);
      updateAll();
      return;
    }
    selectPiece(id);
    selectedPoint_=static_cast<int>(i);
    mutate("move-point",{{"pieceId",id},{"pointIndex",i},{"x",x},{"y",y}});
  };
  if (!document_->data().at("pieces").empty())
    selectedPiece_=document_->data().at("pieces")[0].at("id").get<std::string>();
  updateAll(true);
  statusBar()->showMessage("C++17 CAD document · native Qt canvas · unsimulated 3D staging · ZOZO PPF guarded", 15000);
}

void MainWindow::makeMenus() {
  auto* file=menuBar()->addMenu("File");
  auto* open=file->addAction("Open garment JSON…",this,[this]{openDocument();});
  open->setShortcut(QKeySequence::Open);
  auto* save=file->addAction("Save a copy…",this,[this]{saveCopy();});
  save->setShortcut(QKeySequence::SaveAs);
  file->addSeparator();
  file->addAction("Quit",qApp,&QCoreApplication::quit);
  auto* edit=menuBar()->addMenu("Edit");
  undoAction_=edit->addAction("Undo",this,[this]{undo();});
  undoAction_->setShortcut(QKeySequence::Undo);
  redoAction_=edit->addAction("Redo",this,[this]{redo();});
  redoAction_->setShortcut(QKeySequence::Redo);
  auto* view=menuBar()->addMenu("View");
  view->addAction("Fit 2D patterns",this,[this]{canvas_->focusPatterns();});
  auto* workspaces=view->addMenu("CLO-style workspace layouts");
  for(const auto& preset:garment::workspace_profiles::WORKSPACE_PROFILES.items()) {
    const auto name=preset.key();
    const auto display=preset.value().value("name",name);
    auto* action=workspaces->addAction(QString::fromStdString(display));
    action->setStatusTip("Change only Qt workspace presentation, never garment physics, pattern data or revision");
    connect(action,&QAction::triggered,this,[this,name]{applyWorkspaceProfile(name);});
  }
  view->addAction("Find CLO-style commands (reference)…",this,
    [this]{showNativeCloCommandReference();});
  auto* gridSnap=view->addAction("Snap drafting points to 1 cm grid");
  gridSnap->setCheckable(true);
  gridSnap->setChecked(false);
  gridSnap->setStatusTip("Quantize moved pattern vertices in centimeters. Hold Shift for 45-degree drafting guidelines.");
  connect(gridSnap,&QAction::toggled,this,[this](bool enabled){canvas_->setGridSnapEnabled(enabled);});
  auto* manufacturing=menuBar()->addMenu("Production");
  manufacturing->addAction("Review production preflight…",this,[this]{showProductionPreflight();});
  manufacturing->addAction("Review sewing construction…",this,[this]{showSewingConstructionAudit();});
  manufacturing->addAction("Review native cloth mesh + stitches…",this,[this]{showNativeClothConstruction();});
  manufacturing->addAction("Review marker layout…",this,[this]{showMarkerLayoutSummary();});
  manufacturing->addSeparator();
  manufacturing->addAction("Export graded cutlines DXF…",this,[this]{exportSizeDxf();});
  manufacturing->addAction("Export construction DXF…",this,[this]{exportConstructionDxf();});
  manufacturing->addAction("Count flat mesh geometry…",this,[this]{showFlatMeshCount();});
  manufacturing->addAction("Export native flat OBJ…",this,[this]{exportFlatObj();});
  manufacturing->addAction("Export native glTF 2.0…",this,[this]{exportFlatGltf();});
  manufacturing->addAction("Export fabric marker SVG…",this,[this]{exportMarkerSvg();});
  manufacturing->addAction("Export true-size marker PDF…",this,[this]{exportMarkerPdf();});
  manufacturing->addAction("Export BOM XML…",this,[this]{exportBom();});
  manufacturing->addAction("Export development factory ZIP…",this,[this]{exportFactoryZip();});
  manufacturing->addAction("Export full factory ZIP (experimental, uncertified)…",
    this,[this]{exportFullFactoryDevelopmentZip();});
  manufacturing->addAction("Export all-size POM CSV…",this,[this]{exportPomCsv();});
  manufacturing->addAction("Export structured tech pack JSON…",this,[this]{exportTechPack();});
  auto* materials=menuBar()->addMenu("Materials");
  materials->addAction("Preview native textile PBR maps…",this,[this]{previewProceduralTextile();});
  auto* sim=menuBar()->addMenu("Simulation");
  auto* originalDress=sim->addAction("View original ZOZO dress recording…",this,[this]{
    const QString recommended=QDir::current().filePath("public/references/zozo-dress");
    const QString source=QFileDialog::getExistingDirectory(this,
      "Select original ZOZO dress reference folder (read-only)",
      QDir(recommended).exists()?recommended:QDir::homePath());
    if(source.isEmpty())return;
    try{
      showZozoReferenceViewer(this,source);
    }catch(const std::exception& ex){
      QMessageBox::warning(this,"Original ZOZO recording unavailable",
        QString::fromUtf8(ex.what()));
    }
  });
  originalDress->setStatusTip("Read-only original ZOZO dress frames; this does not simulate or modify the active garment");
  sim->addAction("Inspect native solver payload preflight…",this,
    [this]{showNativeSolverPayloadPreflight();});
  auto* ppf=sim->addAction("ZOZO PPF readiness…",this,[this]{
    QMessageBox::information(this,"PPF native boundary",
      "The C++ engine validates the shell/stitches, ≤3 cm starting gap, fabric strain and body/self collision evidence. "
      "ZOZO's original Rust solver remains a separate backend. The current Thomas T-shirt initial assembly "
      "does not pass the starting-gap gate, so this preview cannot launch a certified fit.");
  });
  ppf->setStatusTip("Native Rust PPF adapter validates initial assembly before any job submission");
  auto* bar=addToolBar("CAD");
  bar->setMovable(false);
  bar->addAction("Fit 2D",this,[this]{canvas_->focusPatterns();});
  bar->addAction("Undo",this,[this]{undo();});
  bar->addAction("Redo",this,[this]{redo();});
  auto* simulate=bar->addAction("Simulate");
  simulate->setEnabled(false);
  simulate->setToolTip("Physical cloth fitting disabled until PPF assembly/CCD validation passes");
}

void MainWindow::makeDocks() {
  auto* left = new QDockWidget("Pattern Objects",this);
  patternDock_=left;
  left->setObjectName("NativePatternOutliner");
  pieces_=new QListWidget(left);
  pieces_->setObjectName("NativePatternList");
  left->setWidget(pieces_);
  addDockWidget(Qt::LeftDockWidgetArea,left);
  connect(pieces_,&QListWidget::currentItemChanged,this,[this](QListWidgetItem* item,QListWidgetItem*) {
    if (!updating_ && item) selectPiece(item->data(Qt::UserRole).toString().toStdString());
  });

  auto* right = new QDockWidget("Pattern Inspector",this);
  patternInspectorDock_=right;
  right->setObjectName("NativePatternInspector");
  auto* panel=new QWidget(right);
  auto* layout=new QVBoxLayout(panel);
  selectionLabel_=new QLabel("No selection",panel);
  selectionLabel_->setWordWrap(true);
  layout->addWidget(selectionLabel_);
  auto* form=new QFormLayout();
  pointX_=measurement(panel);
  pointY_=measurement(panel);
  allowance_=measurement(panel);
  curveX_=measurement(panel);
  curveY_=measurement(panel);
  splitPercent_=new QDoubleSpinBox(panel);
  splitPercent_->setRange(5.,95.);
  splitPercent_->setDecimals(1);
  splitPercent_->setSingleStep(5.);
  splitPercent_->setValue(50.);
  splitPercent_->setSuffix(" % of edge");
  allowance_->setRange(0,100);
  form->addRow("Point X",pointX_);
  form->addRow("Point Y",pointY_);
  form->addRow("Edge allowance",allowance_);
  form->addRow("Curve control X",curveX_);
  form->addRow("Curve control Y",curveY_);
  form->addRow("Split position",splitPercent_);
  layout->addLayout(form);
  setCurve_=new QPushButton("Set outgoing edge curve",panel);
  straightenEdge_=new QPushButton("Make outgoing edge straight",panel);
  splitEdge_=new QPushButton("Insert point on outgoing edge",panel);
  layout->addWidget(setCurve_);
  layout->addWidget(straightenEdge_);
  layout->addWidget(splitEdge_);
  connect(setCurve_,&QPushButton::clicked,this,[this]{
    if(updating_ || preview_ || selectedPoint_<0 || selectedPiece_.empty())return;
    mutate("set-curve",{{"pieceId",selectedPiece_},{"edgeIndex",selectedPoint_},
      {"cx",curveX_->value()},{"cy",curveY_->value()}});
  });
  connect(straightenEdge_,&QPushButton::clicked,this,[this]{
    if(updating_ || preview_ || selectedPoint_<0 || selectedPiece_.empty())return;
    mutate("remove-curve",{{"pieceId",selectedPiece_},{"edgeIndex",selectedPoint_}});
  });
  connect(splitEdge_,&QPushButton::clicked,this,[this]{
    if(updating_ || preview_ || selectedPoint_<0 || selectedPiece_.empty())return;
    for(const auto& piece:document_->data().at("pieces")) {
      if(!piece.is_object()||piece.value("id",std::string())!=selectedPiece_)continue;
      try {
        const auto fractions=garment::draftingSplitFractions(piece,selectedPoint_,
          {{"method","ratio"},{"ratioPercent",splitPercent_->value()}});
        const double fraction=fractions.at(0).get<double>();
        const double parameter=garment::splitParameterAtArcFraction(piece,selectedPoint_,fraction);
        mutate("split-edge",{{"pieceId",selectedPiece_},{"edgeIndex",selectedPoint_},
          {"fraction",parameter}});
      }catch(const std::exception& ex){
        QMessageBox::warning(this,"Cannot divide selected edge",QString::fromUtf8(ex.what()));
      }
      return;
    }
  });
  auto* note=new QLabel("Select a pattern and drag an amber point in the 2D canvas.\n"
                        "All changes are native C++ document transactions.",panel);
  note->setWordWrap(true);
  layout->addWidget(note);
  auto* reset2d=new QPushButton("Fit all drafting pieces",panel);
  layout->addWidget(reset2d);
  connect(reset2d,&QPushButton::clicked,this,[this]{canvas_->focusPatterns();});
  layout->addStretch();
  right->setWidget(panel);
  addDockWidget(Qt::RightDockWidgetArea,right);

  connect(pointX_,QOverload<double>::of(&QDoubleSpinBox::valueChanged),this,[this](double x){
    if (updating_ || selectedPoint_<0)return;
    mutate("move-point",{{"pieceId",selectedPiece_},{"pointIndex",selectedPoint_},{"x",x},{"y",pointY_->value()}});
  });
  connect(pointY_,QOverload<double>::of(&QDoubleSpinBox::valueChanged),this,[this](double y){
    if (updating_ || selectedPoint_<0)return;
    mutate("move-point",{{"pieceId",selectedPiece_},{"pointIndex",selectedPoint_},{"x",pointX_->value()},{"y",y}});
  });
  connect(allowance_,QOverload<double>::of(&QDoubleSpinBox::valueChanged),this,[this](double value){
    if (updating_ || selectedPoint_<0)return;
    mutate("set-edge-allowance",{{"pieceId",selectedPiece_},{"edgeIndex",selectedPoint_},{"allowanceCm",value}});
  });

  auto* seamDock=new QDockWidget("Seams and Measurements",this);
  seamDock_=seamDock;
  seamDock->setObjectName("NativeSeamList");
  auto* seamPanel=new QWidget(seamDock);
  auto* seamLayout=new QVBoxLayout(seamPanel);
  seams_=new QListWidget(seamPanel);
  seams_->setObjectName("NativeSewingList");
  seamLabel_=new QLabel("Select a sewing relationship",seamPanel);
  seamLabel_->setWordWrap(true);
  seamLayout->addWidget(seams_);
  seamLayout->addWidget(seamLabel_);
  seamDock->setWidget(seamPanel);
  addDockWidget(Qt::RightDockWidgetArea,seamDock);
  splitDockWidget(right,seamDock,Qt::Vertical);
  connect(seams_,&QListWidget::currentItemChanged,this,[this](QListWidgetItem* item,QListWidgetItem*) {
    if (!item) return;
    try {
      auto seam=document_->seamInfo(item->data(Qt::UserRole).toString().toStdString());
      seamLabel_->setText(QString("A: %1 cm  ·  B: %2 cm  ·  Mismatch: %3%\n%4")
        .arg(seam["lengthACm"].get<double>(),0,'f',2)
        .arg(seam["lengthBCm"].get<double>(),0,'f',2)
        .arg(seam["mismatchPercent"].get<double>(),0,'f',2)
        .arg(QString::fromStdString(seam["status"].get<std::string>())));
    } catch (const std::exception& ex) { seamLabel_->setText(ex.what()); }
  });

  auto* productionDock=new QDockWidget("Production • Native C++",this);
  productionDock_=productionDock;
  productionDock->setObjectName("NativeProductionInspector");
  auto* productionPanel=new QWidget(productionDock);
  productionPanel->setObjectName("NativeProductionPanel");
  auto* productionLayout=new QVBoxLayout(productionPanel);
  auto* sizeForm=new QFormLayout();
  sizes_=new QComboBox(productionPanel);
  sizes_->setObjectName("NativeGradeSizePicker");
  sizeForm->addRow("Preview size",sizes_);
  productionLayout->addLayout(sizeForm);
  productionStatus_=new QLabel("Native production check pending",productionPanel);
  productionStatus_->setWordWrap(true);
  productionLayout->addWidget(productionStatus_);
  markerFabrics_=new QListWidget(productionPanel);
  markerFabrics_->setObjectName("NativeMarkerFabrics");
  productionLayout->addWidget(markerFabrics_);
  auto* preflightButton=new QPushButton("Review production preflight…",productionPanel);
  auto* markerButton=new QPushButton("Review marker layout…",productionPanel);
  productionLayout->addWidget(preflightButton);
  productionLayout->addWidget(markerButton);
  auto* outputDxf=new QPushButton("Export graded cutline DXF…",productionPanel);
  auto* outputConstruction=new QPushButton("Export construction DXF…",productionPanel);
  auto* outputMeshCount=new QPushButton("Count flat mesh geometry…",productionPanel);
  auto* outputObj=new QPushButton("Export flat OBJ…",productionPanel);
  auto* outputGltf=new QPushButton("Export flat glTF 2.0…",productionPanel);
  auto* outputSvg=new QPushButton("Export true-size marker SVG…",productionPanel);
  auto* outputPdf=new QPushButton("Export true-size marker PDF…",productionPanel);
  auto* outputBom=new QPushButton("Export BOM XML…",productionPanel);
  auto* outputZip=new QPushButton("Export development ZIP…",productionPanel);
  auto* outputPom=new QPushButton("Export all-size POM CSV…",productionPanel);
  auto* outputTechPack=new QPushButton("Export tech pack JSON…",productionPanel);
  productionLayout->addWidget(outputDxf);
  productionLayout->addWidget(outputConstruction);
  productionLayout->addWidget(outputMeshCount);
  productionLayout->addWidget(outputObj);
  productionLayout->addWidget(outputGltf);
  productionLayout->addWidget(outputSvg);
  productionLayout->addWidget(outputPdf);
  productionLayout->addWidget(outputBom);
  productionLayout->addWidget(outputZip);
  productionLayout->addWidget(outputPom);
  productionLayout->addWidget(outputTechPack);
  auto* caveat=new QLabel("Native C++ sizing and fabric layout are development tools, not factory/cutter approval. Physical PPF fit remains unvalidated.",productionPanel);
  caveat->setWordWrap(true);
  productionLayout->addWidget(caveat);
  auto* productionScroll=new QScrollArea(productionDock);
  productionScroll->setObjectName("NativeProductionScroll");
  productionScroll->setWidgetResizable(true);
  productionScroll->setFrameShape(QFrame::NoFrame);
  productionScroll->setStyleSheet(
    "QScrollArea {background:#262e39;border:0;}"
    "QWidget#NativeProductionPanel {background:#262e39;color:#e9eff5;}");
  productionScroll->setWidget(productionPanel);
  productionDock->setWidget(productionScroll);
  productionDock->setMinimumHeight(160);
  productionDock->setMaximumHeight(290);
  addDockWidget(Qt::BottomDockWidgetArea,productionDock);
  connect(sizes_,&QComboBox::currentTextChanged,this,[this](const QString&) {if (!updating_) updateAll(true);});
  connect(outputDxf,&QPushButton::clicked,this,[this]{exportSizeDxf();});
  connect(preflightButton,&QPushButton::clicked,this,[this]{showProductionPreflight();});
  connect(markerButton,&QPushButton::clicked,this,[this]{showMarkerLayoutSummary();});
  connect(outputConstruction,&QPushButton::clicked,this,[this]{exportConstructionDxf();});
  connect(outputMeshCount,&QPushButton::clicked,this,[this]{showFlatMeshCount();});
  connect(outputObj,&QPushButton::clicked,this,[this]{exportFlatObj();});
  connect(outputGltf,&QPushButton::clicked,this,[this]{exportFlatGltf();});
  connect(outputSvg,&QPushButton::clicked,this,[this]{exportMarkerSvg();});
  connect(outputPdf,&QPushButton::clicked,this,[this]{exportMarkerPdf();});
  connect(outputBom,&QPushButton::clicked,this,[this]{exportBom();});
  connect(outputZip,&QPushButton::clicked,this,[this]{exportFactoryZip();});
  connect(outputPom,&QPushButton::clicked,this,[this]{exportPomCsv();});
  connect(outputTechPack,&QPushButton::clicked,this,[this]{exportTechPack();});
}

void MainWindow::applyWorkspaceProfile(const std::string& preset) {
  try {
    if(!workspaceSplitter_ || !canvas_ || !stage_)
      throw std::runtime_error("Qt workspace has not been initialized");
    const auto& presets=garment::workspace_profiles::WORKSPACE_PROFILES;
    if(!presets.contains(preset))
      throw std::invalid_argument("Unknown workspace layout: "+preset);
    const auto profile=garment::workspace_profiles::normalizeWorkspaceProfile(presets.at(preset));
    const std::string layout=profile.at("viewportLayout").get<std::string>();
    workspaceSplitter_->setOrientation(layout=="stack"?Qt::Vertical:Qt::Horizontal);
    canvas_->setVisible(layout!="3d");
    stage_->setVisible(layout!="2d");
    const int stagePercent=profile.at("viewportSplit").get<int>();
    if(layout=="split"||layout=="stack")
      workspaceSplitter_->setSizes({(100-stagePercent)*10,stagePercent*10});
    if(patternDock_)
      patternDock_->setVisible(profile.at("objectBrowserVisible").get<bool>());
    if(patternInspectorDock_)
      patternInspectorDock_->setVisible(profile.at("inspectorVisible").get<bool>());
    if(seamDock_)
      seamDock_->setVisible(profile.at("section")=="Sewing"||preset=="drafting");
    if(productionDock_)
      productionDock_->setVisible(profile.at("section")=="Production"||preset=="drafting");
    const QString name=QString::fromStdString(profile.at("name").get<std::string>());
    statusBar()->showMessage(QString("Workspace: %1 · native Qt view only, garment document unchanged").arg(name),5500);
    if(canvas_->isVisible())
      QTimer::singleShot(0,this,[this]{if(canvas_ && canvas_->isVisible())canvas_->focusPatterns();});
  } catch(const std::exception& ex) {
    QMessageBox::warning(this,"Workspace profile unavailable",QString::fromUtf8(ex.what()));
  }
}

void MainWindow::selectPiece(const std::string& id) {
  if (id == selectedPiece_ && selectedPoint_ == -1) return;
  selectedPiece_ = id;
  selectedPoint_=-1;
  updateAll();
}

void MainWindow::selectPoint(std::size_t index) {
  selectedPoint_=static_cast<int>(index);
  // Keep the active QGraphicsEllipseItem alive during pointer capture. A full
  // canvas rebuild here would delete the dragged point mid mouse gesture.
  // Once a moved point commits its C++ document transaction, mutate() safely
  // rebuilds the canvas using the authoritative geometry.
  updateInspector();
}

void MainWindow::updateInspector() {
  updating_=true;
  QSignalBlocker blockX(pointX_),blockY(pointY_),blockAllowance(allowance_);
  QSignalBlocker blockCurveX(curveX_),blockCurveY(curveY_);
  const Json* pattern=nullptr;
  for (const auto& item:document_->data().at("pieces"))
    if (item.at("id") == selectedPiece_) {pattern=&item;break;}
  const bool selected=pattern && selectedPoint_>=0 &&
                       static_cast<std::size_t>(selectedPoint_)<pattern->at("points").size();
  pointX_->setEnabled(selected && !preview_);
  pointY_->setEnabled(selected && !preview_);
  allowance_->setEnabled(selected && !preview_);
  curveX_->setEnabled(selected && !preview_);
  curveY_->setEnabled(selected && !preview_);
  setCurve_->setEnabled(selected && !preview_);
  straightenEdge_->setEnabled(selected && !preview_);
  splitPercent_->setEnabled(selected && !preview_);
  splitEdge_->setEnabled(selected && !preview_);
  if (selected) {
    const auto& pos=pattern->at("points")[selectedPoint_];
    pointX_->setValue(pos["x"].get<double>());
    pointY_->setValue(pos["y"].get<double>());
    allowance_->setValue(document_->edgeInfo(selectedPiece_,selectedPoint_)["seamAllowanceCm"].get<double>());
    const auto& pts=pattern->at("points");
    const auto current=pattern->value("curves",Json::object());
    const auto key=std::to_string(selectedPoint_);
    if(current.is_object()&&current.contains(key)&&current[key].is_object()) {
      curveX_->setValue(current[key].at("cx").get<double>());
      curveY_->setValue(current[key].at("cy").get<double>());
    } else {
      const auto& next=pts[(static_cast<std::size_t>(selectedPoint_)+1)%pts.size()];
      curveX_->setValue((pos.at("x").get<double>()+next.at("x").get<double>())/2.);
      curveY_->setValue((pos.at("y").get<double>()+next.at("y").get<double>())/2.);
    }
  }
  selectionLabel_->setText(QString::fromStdString(selectedPiece_) +
    (selected ? QString(" · point %1 / edge %1").arg(selectedPoint_) : QString(" · select a point")) +
    (preview_ ? " · graded preview, read-only" : ""));
  updating_=false;
}

void MainWindow::updateAll(bool fitCanvas) {
  updating_=true;
  const auto& source=document_->data();
  const auto grading=source.value("grading",Json::object());
  const std::string base=grading.is_object()?grading.value("baseSize",std::string("M")):"M";
  if (sizes_) {
    const QString rememberedSize=sizes_->currentText();
    QSignalBlocker blockSize(sizes_);
    sizes_->clear();
    Json available=grading.is_object()?grading.value("sizes",Json::array()):Json::array();
    if (!available.is_array() || available.empty())
      available=Json::array({"XS","S","M","L","XL","XXL"});
    for (const auto& s:available) if (s.is_string())
      sizes_->addItem(QString::fromStdString(s.get<std::string>()));
    const QString baseText=QString::fromStdString(base);
    const auto selected=sizes_->findText(rememberedSize);
    sizes_->setCurrentIndex(selected>=0?selected:std::max(0,sizes_->findText(baseText)));
  }
  preview_.reset();
  if (activeSize()!=base) {
    try {preview_=std::make_unique<Document>(garment::gradeProject(*document_,activeSize()));}
    catch(const std::exception& e) {
      statusBar()->showMessage(QString("Graded preview unavailable: %1").arg(e.what()),7000);
    }
  }
  pieces_->clear();
  for (const auto& piece : document_->data().at("pieces")) {
    auto* item=new QListWidgetItem(label(piece),pieces_);
    item->setData(Qt::UserRole,QString::fromStdString(piece.at("id").get<std::string>()));
    if (piece.at("id") == selectedPiece_) pieces_->setCurrentItem(item);
  }
  QString remembered;
  if (seams_->currentItem()) remembered=seams_->currentItem()->data(Qt::UserRole).toString();
  seams_->clear();
  if (document_->data().contains("seams"))
    for (const auto& seam:document_->data().at("seams")) {
      auto id=seam.at("id").get<std::string>();
      auto measure=document_->seamInfo(id);
      auto* item=new QListWidgetItem(QString::fromStdString(id) +
        QString("  ·  %1%").arg(measure["mismatchPercent"].get<double>(),0,'f',1),seams_);
      item->setData(Qt::UserRole,QString::fromStdString(id));
      if (measure["status"] == "error") item->setForeground(QColor("#f1b56d"));
      if (QString::fromStdString(id)==remembered) seams_->setCurrentItem(item);
    }
  const Document& visible=preview_?*preview_:*document_;
  canvas_->refresh(visible,selectedPiece_,selectedPoint_);
  stage_->setDocument(visible);
  stage_->selectPiece(selectedPiece_);
  undoAction_->setEnabled(!undo_.empty());
  redoAction_->setEnabled(!redo_.empty());
  updating_=false;
  updateInspector();
  refreshProduction();
  if (fitCanvas) canvas_->focusPatterns();
}

std::string MainWindow::activeSize() const {
  if (sizes_ && !sizes_->currentText().isEmpty()) return sizes_->currentText().toStdString();
  const auto grading=document_->data().value("grading",Json::object());
  return grading.is_object()?grading.value("baseSize",std::string("M")):"M";
}

void MainWindow::refreshProduction() {
  if (!markerFabrics_ || !productionStatus_) return;
  const auto retained=markerFabrics_->currentItem()
    ?markerFabrics_->currentItem()->data(Qt::UserRole).toString():QString();
  markerFabrics_->clear();
  try {
    const auto checked=garment::inspectProduction(document_->data(),true);
    const auto report=garment::buildFabricMarkers(preview_?*preview_:*document_);
    productionStatus_->setText(QString("Size: %1 · %2 blocker(s), %3 warning(s) across all sizes\n"
                                       "Fabric markers below are development estimates only.")
      .arg(QString::fromStdString(activeSize()))
      .arg(checked["blockers"].get<int>()).arg(checked["warnings"].get<int>()));
    for (auto it=report.begin();it!=report.end();++it) {
      const auto& marker=it.value();
      QString text=QString("%1 · %2 cm wide · %3 cm long\n%4/%5 pieces · efficiency %6%")
        .arg(QString::fromStdString(it.key()))
        .arg(marker["width"].get<double>(),0,'f',1)
        .arg(marker["length"].get<double>(),0,'f',1)
        .arg(static_cast<qulonglong>(marker["placements"].size()))
        .arg(static_cast<qulonglong>(marker["requestedPieces"].get<std::size_t>()))
        .arg(marker["efficiency"].get<double>()*100,0,'f',1);
      auto* item=new QListWidgetItem(text,markerFabrics_);
      item->setData(Qt::UserRole,QString::fromStdString(it.key()));
      if (marker["unusedPieces"].get<std::size_t>()>0)
        item->setForeground(QColor("#e7a363"));
      if (it.key()==retained.toStdString()) markerFabrics_->setCurrentItem(item);
    }
    if (!markerFabrics_->currentItem() && markerFabrics_->count()) markerFabrics_->setCurrentRow(0);
  } catch (const std::exception& ex) {
    productionStatus_->setText(QString("Production calculation unavailable: %1").arg(ex.what()));
  }
}

void MainWindow::showProductionPreflight() {
  try {
    refreshProduction();
    const Json report=garment::inspectProduction(document_->data(),true);
    QString details;
    for (const auto& issue:report.at("issues")) {
      details+=QString("[%1] %2 · %3\n%4\n\n")
        .arg(QString::fromStdString(issue.value("severity",std::string("unknown"))))
        .arg(QString::fromStdString(issue.value("code",std::string("unknown"))))
        .arg(QString::fromStdString(issue.value("scope",std::string("project"))))
        .arg(QString::fromStdString(issue.value("message",std::string())));
    }
    if(details.isEmpty()) details="No structural manufacturing issues reported.";
    QMessageBox dialog(this);
    dialog.setWindowTitle("Native production preflight");
    dialog.setIcon(report.at("blockers").get<int>() ? QMessageBox::Warning : QMessageBox::Information);
    dialog.setText(QString("%1 · %2 blocker(s), %3 warning(s) across %4 size(s)")
      .arg(QString::fromStdString(report.at("status").get<std::string>()))
      .arg(report.at("blockers").get<int>()).arg(report.at("warnings").get<int>())
      .arg(static_cast<qulonglong>(report.at("sizes").size())));
    dialog.setInformativeText("Structural checks and marker coverage are development checks; factory certification is not provided.");
    dialog.setDetailedText(details);
    dialog.exec();
  } catch(const std::exception& ex) {
    QMessageBox::warning(this,"Production preflight unavailable",
      QString("Unable to review the current project:\n%1").arg(QString::fromUtf8(ex.what())));
  }
}

void MainWindow::previewProceduralTextile() {
  try {
    const auto& doc=document_->data();
    if(!doc.contains("fabrics") || !doc.at("fabrics").is_object() || doc.at("fabrics").empty())
      throw std::invalid_argument("The document does not contain a fabric library");
    QStringList fabrics;
    std::vector<std::string> ids;
    for(auto item=doc.at("fabrics").begin();item!=doc.at("fabrics").end();++item) {
      ids.push_back(item.key());
      fabrics.push_back(QString::fromStdString(
        item.value().is_object()?item.value().value("name",item.key()):item.key()));
    }
    bool accepted=false;
    const auto selected=QInputDialog::getItem(this,"Native material maps",
      "Select a fabric in this garment",fabrics,0,false,&accepted);
    if(!accepted)return;
    const int index=fabrics.indexOf(selected);
    if(index<0||static_cast<std::size_t>(index)>=ids.size())return;
    const auto& fabric=doc.at("fabrics").at(ids.at(index));
    const auto maps=garment::textile_procedurals::makeProceduralTextileMaps(fabric,256);
    QDialog dialog(this);
    dialog.setWindowTitle("Garment Studio · Native textile material preview");
    auto* layout=new QVBoxLayout(&dialog);
    auto* title=new QLabel(QString("%1 · %2")
      .arg(selected).arg(QString::fromStdString(maps.at("family").get<std::string>())),&dialog);
    layout->addWidget(title);
    auto* tabs=new QTabWidget(&dialog);
    for(const auto& entry:std::vector<std::pair<const char*,const char*>>{
      {"Color","colorPixels"},{"Normal","normalPixels"},{"Roughness","roughnessPixels"}}) {
      const auto& pixels=maps.at(entry.second);
      QImage image(256,256,QImage::Format_RGBA8888);
      if(pixels.size()!=256*256*4)throw std::runtime_error("Invalid native textile pixel map size");
      for(int y=0;y<256;++y) {
        auto* dst=image.scanLine(y);
        for(int x=0;x<256*4;++x)
          dst[x]=static_cast<unsigned char>(pixels.at(static_cast<std::size_t>(y*256*4+x)).get<int>());
      }
      auto* view=new QLabel(tabs);
      view->setAlignment(Qt::AlignCenter);
      view->setPixmap(QPixmap::fromImage(image).scaled(384,384,Qt::KeepAspectRatio,Qt::FastTransformation));
      tabs->addTab(view,entry.first);
    }
    layout->addWidget(tabs);
    auto* disclaimer=new QLabel("Native C++ procedural maps. Pixel data is independent of "
      "the garment pose; this is not a simulated fabric-drape preview.",&dialog);
    disclaimer->setWordWrap(true);
    layout->addWidget(disclaimer);
    dialog.resize(445,490);
    dialog.exec();
  }catch(const std::exception& ex){
    QMessageBox::warning(this,"Native material preview unavailable",QString::fromUtf8(ex.what()));
  }
}

void MainWindow::showNativeCloCommandReference() {
  bool accepted=false;
  const QString query=QInputDialog::getText(this,"Native CLO-style command reference",
    "Search commands by feature, workspace, or action:",QLineEdit::Normal,{},&accepted);
  if(!accepted)return;
  const auto commands=garment::workspace_command_index::indexWorkspaceCommands(
    garment::clo_menus::CLO_MENUS);
  const auto matches=garment::workspace_command_index::searchWorkspaceCommands(
    commands,query.toStdString(),20);
  QString listing;
  for(const auto& match:matches){
    listing+=QString("• %1  [%2]\n")
      .arg(QString::fromStdString(match.value("label",std::string())))
      .arg(QString::fromStdString(match.value("group",std::string())));
  }
  if(listing.isEmpty())listing="No matching commands in the native reference catalog.";
  QMessageBox dialog(this);
  dialog.setWindowTitle("CLO-style command reference (read-only)");
  dialog.setIcon(QMessageBox::Information);
  dialog.setText(QString("%1 matches in the %2-command catalog")
    .arg(static_cast<qulonglong>(matches.size()))
    .arg(static_cast<qulonglong>(commands.size())));
  dialog.setInformativeText(listing+"\nThis is a searchable command catalog, not evidence that every feature is implemented in Qt.");
  dialog.exec();
}

void MainWindow::showNativeSolverPayloadPreflight() {
  try {
    const auto payload=garment::buildAuthoredNativeSimulationPayload(document_->data());
    const auto report=payload.at("initialAssembly");
    QMessageBox dialog(this);
    dialog.setWindowTitle("Native solver payload preflight (read-only)");
    dialog.setIcon(QMessageBox::Warning);
    const auto count=[](const Json& data,const char* key)->qulonglong {
      return data.contains(key)&&data.at(key).is_array()
        ?static_cast<qulonglong>(data.at(key).size()):0;
    };
    dialog.setText(QString("%1 particles · %2 springs · %3 virtual seams · %4 excluded collision pairs")
      .arg(count(payload,"particles")).arg(count(payload,"constraints"))
      .arg(count(payload,"virtualSeams")).arg(count(payload,"collisionExclusions")));
    const auto mm=[](const Json& data,const char* key)->double {
      return data.contains(key)&&data.at(key).is_number()
        ?data.at(key).get<double>():0.;
    };
    dialog.setInformativeText(QString("Initial sewing gap: %1 mm · initial mesh peak strain: %2%\n"
      "Assembly result: %3\n"
      "This is geometry preflight only. No fitting, full body/cloth collision, "
      "swept collision detection, or factory acceptance has been established.")
      .arg(mm(report,"initialSeamGapMaximumMm"),0,'f',2)
      .arg(mm(report,"initialMeshPeakEdgeStrainPercent"),0,'f',2)
      .arg(QString::fromStdString(report.value("status",std::string("UNVERIFIED")))));
    QString details="Incomplete or unsupported native payload features:\n";
    for(const auto& limitation:payload.at("parityUnsupported"))
      if(limitation.is_string())details+="• "+QString::fromStdString(
        limitation.get<std::string>())+"\n";
    details+="\nInitial assembly metrics:\n"+QString::fromStdString(report.dump(2));
    dialog.setDetailedText(details);
    dialog.exec();
  }catch(const std::exception& ex){
    QMessageBox::warning(this,"Native solver preflight unavailable",
      QString::fromUtf8(ex.what()));
  }
}

void MainWindow::showNativeClothConstruction() {
  try {
    const auto& source=document_->data();
    const Json snapshot=garment::buildAssembledClothSnapshot(source);
    std::size_t triangles=0,vertices=0,cutlinePaths=0;
    for(const auto& piece:snapshot.at("pieces")) {
      triangles+=piece.at("faces").size();
      vertices+=piece.at("flatVertices").size();
      cutlinePaths+=piece.at("boundaryIndices").size();
    }
    const auto& unsupported=snapshot.at("unsupportedSeams");
    QString details;
    for(const auto& issue:unsupported)
      details+=QString("%1: %2\n")
        .arg(QString::fromStdString(issue.value("id",std::string("?"))))
        .arg(QString::fromStdString(issue.value("reason",std::string())));
    for(const auto& missing:snapshot.at("unported"))
      if(missing.is_string())details+=QString::fromStdString(missing.get<std::string>())+"\n";
    if(details.isEmpty())details="No unsupported construction features were reported.";
    QMessageBox dialog(this);
    dialog.setWindowTitle("Native cloth construction analysis");
    dialog.setIcon(QMessageBox::Warning);
    dialog.setText(QString("%1 pieces · %2 vertices · %3 triangles · %4 edge paths")
      .arg(static_cast<qulonglong>(snapshot.at("pieces").size()))
      .arg(static_cast<qulonglong>(vertices)).arg(static_cast<qulonglong>(triangles))
      .arg(static_cast<qulonglong>(cutlinePaths)));
    dialog.setInformativeText(QString("%1 physical cloth constraints · %2 ordered stitches · %3 fit anchors · %4 unsupported seams\n"
      "Native authored construction is not a fitted or collision-certified simulation.")
      .arg(static_cast<qulonglong>(snapshot.at("clothConstraints").size()))
      .arg(static_cast<qulonglong>(snapshot.at("seamConstraints").size()))
      .arg(static_cast<qulonglong>(snapshot.at("anchorConstraints").size()))
      .arg(static_cast<qulonglong>(unsupported.size())));
    dialog.setDetailedText(details);
    dialog.exec();
  } catch(const std::exception& ex) {
    QMessageBox::warning(this,"Native cloth construction unavailable",
      QString("Unable to compile this pattern for native cloth preview:\n%1").arg(QString::fromUtf8(ex.what())));
  }
}

void MainWindow::showSewingConstructionAudit() {
  try {
    const Json report=garment::auditSewingConstruction(document_->data());
    const auto& categories=report.at("categories");
    const int invalid=categories.at("invalidEndpoints").get<int>();
    const int inactive=categories.at("inactive3d").get<int>();
    const int overlaps=categories.at("overlappingRanges").get<int>();
    const int mismatches=categories.at("lengthMismatch").get<int>();
    QString details;
    for(const auto& issue:report.at("issues")) {
      details+=QString("[%1] Seam: %2\n%3\n\n")
        .arg(QString::fromStdString(issue.value("kind",std::string("unknown"))))
        .arg(QString::fromStdString(issue.value("seamId",std::string("?"))))
        .arg(QString::fromStdString(issue.value("detail",std::string())));
    }
    if(details.isEmpty())details="No sewing construction conflicts found.";
    QMessageBox dialog(this);
    const bool usable=report.at("usableForLiveAssembly").get<bool>();
    dialog.setWindowTitle("Native sewing construction audit");
    dialog.setIcon(usable?QMessageBox::Information:QMessageBox::Warning);
    dialog.setText(QString("%1 of %2 seam link(s) structurally valid")
      .arg(report.at("validSewingLinks").get<int>())
      .arg(report.at("sourceSeams").get<int>()));
    dialog.setInformativeText(QString("Invalid endpoints: %1 · Inactive 3D: %2 · Overlaps: %3 · Length mismatches: %4\n"
                                      "Sewing audit is a structural check, not physical fit or factory approval.")
      .arg(invalid).arg(inactive).arg(overlaps).arg(mismatches));
    dialog.setDetailedText(details);
    dialog.exec();
  } catch(const std::exception& ex) {
    QMessageBox::warning(this,"Sewing construction unavailable",
      QString("Unable to review the project sewing seams:\n%1").arg(QString::fromUtf8(ex.what())));
  }
}

void MainWindow::showMarkerLayoutSummary() {
  try {
    refreshProduction();
    const std::string size=activeSize();
    Document graded(garment::gradeProject(*document_,size));
    const Json markers=garment::buildFabricMarkers(graded);
    if(markers.empty()) throw std::runtime_error("No marker fabrics found for this size. Assign fabric IDs to pattern pieces.");
    QString details;
    std::size_t totalRequested=0,totalPlaced=0,totalUnplaced=0;
    for(auto it=markers.begin();it!=markers.end();++it) {
      const auto& marker=it.value();
      const auto requested=marker.at("requestedPieces").get<std::size_t>();
      const auto placed=marker.at("placements").size();
      const auto unplaced=marker.at("unusedPieces").get<std::size_t>();
      totalRequested+=requested;totalPlaced+=placed;totalUnplaced+=unplaced;
      details+=QString("Fabric: %1\nWidth: %2 cm · Length: %3 cm\nPlaced: %4 / %5 · Unplaced: %6\nEfficiency: %7%\n\n")
        .arg(QString::fromStdString(it.key()))
        .arg(marker.at("width").get<double>(),0,'f',1)
        .arg(marker.at("length").get<double>(),0,'f',1)
        .arg(static_cast<qulonglong>(placed)).arg(static_cast<qulonglong>(requested))
        .arg(static_cast<qulonglong>(unplaced))
        .arg(marker.at("efficiency").get<double>()*100,0,'f',1);
    }
    QMessageBox dialog(this);
    dialog.setWindowTitle("Native marker layout summary");
    dialog.setIcon(totalUnplaced ? QMessageBox::Warning : QMessageBox::Information);
    dialog.setText(QString("Size %1 · %2 fabric(s) · %3/%4 cut pieces placed · %5 unplaced")
      .arg(QString::fromStdString(size)).arg(static_cast<qulonglong>(markers.size()))
      .arg(static_cast<qulonglong>(totalPlaced)).arg(static_cast<qulonglong>(totalRequested))
      .arg(static_cast<qulonglong>(totalUnplaced)));
    dialog.setInformativeText(totalUnplaced
      ?"Some pieces did not fit the configured fabric widths. Review details before exporting."
      :"Development fabric nesting estimate; not a factory-approved cutting marker.");
    dialog.setDetailedText(details);
    dialog.exec();
  } catch(const std::exception& ex) {
    QMessageBox::warning(this,"Marker layout unavailable",
      QString("Unable to generate a marker for the selected size:\n%1").arg(QString::fromUtf8(ex.what())));
  }
}

bool MainWindow::saveGenerated(const QString& title,const QString& suggested,
                               const QString& filter,const std::string& bytes) {
  const QString path=QFileDialog::getSaveFileName(this,title,suggested,filter);
  if (path.isEmpty()) return false;
  if (!sourceFile_.isEmpty() && QFileInfo(path).absoluteFilePath()==QFileInfo(sourceFile_).absoluteFilePath()) {
    QMessageBox::warning(this,"Protect source garment","Export to a separate file from the active garment project.");
    return false;
  }
  if (QFileInfo::exists(path) || QFileInfo(path).isSymLink()) {
    QMessageBox::warning(this,"Protect existing files","This native preview only creates new export files. Choose an unused filename.");
    return false;
  }
  QSaveFile file(path);
  if (!file.open(QIODevice::WriteOnly)) {
    QMessageBox::warning(this,"Cannot export",file.errorString());return false;
  }
  if (file.write(bytes.data(),static_cast<qint64>(bytes.size()))!=static_cast<qint64>(bytes.size()) ||
      !file.commit()) {
    QMessageBox::warning(this,"Export failed",file.errorString());return false;
  }
  statusBar()->showMessage("Created separate native export: "+path,7500);
  return true;
}

void MainWindow::exportSizeDxf() {
  try {
    const auto size=activeSize();
    Document sized(garment::gradeProject(*document_,size));
    const auto output=garment::exportCuttingDxf(sized,24,true);
    const auto filename=QString("garment-studio-%1-cutline.dxf").arg(QString::fromStdString(size));
    saveGenerated("Export native cutlines — development DXF",filename,"DXF pattern (*.dxf)",output);
  } catch(const std::exception& ex) {QMessageBox::warning(this,"DXF export failed",ex.what());}
}

void MainWindow::exportConstructionDxf() {
  try {
    const auto size=activeSize();
    const auto filename=QString("garment-studio-%1-construction.dxf")
      .arg(QString::fromStdString(size));
    saveGenerated("Export native construction DXF — development",filename,
      "Construction DXF (*.dxf)",garment::exportConstructionDxf(*document_,size));
  } catch(const std::exception& ex) {
    QMessageBox::warning(this,"Construction DXF export failed",ex.what());
  }
}

void MainWindow::showFlatMeshCount() {
  try {
    const garment::Document& visible=preview_?*preview_:*document_;
    const auto meshes=garment::buildProjectPatternMeshes(visible.data());
    std::size_t vertices=0,triangles=0,edges=0;
    for (const auto& mesh:meshes) {
      vertices+=mesh.vertices.size();
      triangles+=mesh.triangles.size();
      edges+=mesh.edges.size();
    }
    QMessageBox::information(this,"Native flat pattern mesh count",
      QString("Size: %1\nPattern meshes: %2\nVertices: %3\nTriangles: %4\nPattern edges: %5\n\nFlat pattern topology only; physical simulation has not been run.")
      .arg(QString::fromStdString(activeSize()))
      .arg(static_cast<qulonglong>(meshes.size()))
      .arg(static_cast<qulonglong>(vertices))
      .arg(static_cast<qulonglong>(triangles))
      .arg(static_cast<qulonglong>(edges)));
  } catch(const std::exception& ex) {
    QMessageBox::warning(this,"Mesh count unavailable",ex.what());
  }
}

void MainWindow::exportFlatObj() {
  try {
    const garment::Document& visible=preview_?*preview_:*document_;
    saveGenerated("Export native flat rest geometry as OBJ",
      QString("garment-studio-%1-flat.obj").arg(QString::fromStdString(activeSize())),
      "Wavefront OBJ (*.obj)",garment::exportFlatPatternObj(visible));
  } catch(const std::exception& ex) {QMessageBox::warning(this,"OBJ export failed",ex.what());}
}

void MainWindow::exportFlatGltf() {
  try {
    const garment::Document& visible=preview_?*preview_:*document_;
    saveGenerated("Export native flat material panels as glTF 2.0",
      QString("garment-studio-%1-flat.gltf").arg(QString::fromStdString(activeSize())),
      "glTF 2.0 (*.gltf)",garment::exportFlatPatternGltf(visible));
  } catch(const std::exception& ex) {QMessageBox::warning(this,"glTF export failed",ex.what());}
}

void MainWindow::exportBom() {
  try {
    saveGenerated("Export open Garment Studio BOM XML","garment-studio-bom.xml",
      "Garment Studio BOM (*.xml)",garment::exportBomXml(*document_));
  } catch(const std::exception& ex) {QMessageBox::warning(this,"BOM export failed",ex.what());}
}

void MainWindow::exportPomCsv() {
  try {
    saveGenerated("Export native all-size POM measurements",
      "garment-studio-pom-sizes.csv","Measurement CSV (*.csv)",
      garment::measurementRunToCsv(*document_));
  } catch (const std::exception& ex) {
    QMessageBox::warning(this,"POM export failed",ex.what());
  }
}

void MainWindow::exportTechPack() {
  try {
    saveGenerated("Export native structured development tech pack",
      "garment-studio-tech-pack.json","Garment tech pack (*.json)",
      garment::buildTechPack(*document_).dump(2) + "\n");
  } catch (const std::exception& ex) {
    QMessageBox::warning(this,"Tech pack export failed",ex.what());
  }
}

void MainWindow::exportMarkerSvg() {
  try {
    const auto size=activeSize();
    Document sized(garment::gradeProject(*document_,size));
    const auto markers=garment::buildFabricMarkers(sized);
    const auto choice=markerFabrics_ && markerFabrics_->currentItem()
      ?markerFabrics_->currentItem()->data(Qt::UserRole).toString().toStdString():std::string();
    const auto fabricId=choice.empty()?markers.begin().key():choice;
    if (!markers.contains(fabricId)) throw std::invalid_argument("fabric not included in active marker");
    const auto svg=garment::markerToSvg(markers.at(fabricId),size,fabricId,sized.data());
    const auto filename=QString("garment-studio-%1-%2-marker.svg")
      .arg(QString::fromStdString(size)).arg(QString::fromStdString(fabricId));
    saveGenerated("Export native true-size SVG marker",filename,"SVG pattern (*.svg)",svg);
  } catch(const std::exception& ex) {QMessageBox::warning(this,"SVG export failed",ex.what());}
}

void MainWindow::exportMarkerPdf() {
  try {
    const auto size=activeSize();
    Document sized(garment::gradeProject(*document_,size));
    const auto markers=garment::buildFabricMarkers(sized);
    if(markers.empty()) throw std::invalid_argument("no marker fabrics found");
    const auto choice=markerFabrics_ && markerFabrics_->currentItem()
      ?markerFabrics_->currentItem()->data(Qt::UserRole).toString().toStdString():std::string();
    const auto fabricId=choice.empty()?markers.begin().key():choice;
    if(!markers.contains(fabricId)) throw std::invalid_argument("fabric not included in active marker");
    const auto& marker=markers.at(fabricId);
    if(marker.at("placements").empty()) throw std::invalid_argument("Cannot plot an empty marker");
    const auto filename=QString("garment-studio-%1-%2-marker.pdf")
      .arg(QString::fromStdString(size)).arg(QString::fromStdString(fabricId));
    saveGenerated("Export native true-size PDF marker",filename,"PDF marker (*.pdf)",
      garment::markerToPdf(marker,size,400.,sized.data()));
  } catch(const std::exception& ex) {QMessageBox::warning(this,"PDF marker export failed",ex.what());}
}

void MainWindow::exportFactoryZip() {
  try {
    const auto report=garment::inspectProduction(document_->data(),true);
    const int blockers=report.at("blockers").get<int>();
    if (blockers>0) {
      const auto answer=QMessageBox::question(this,"Production review required",
        QString("This project has %1 manufacturing blocker(s). The ZIP will include the issues but "
                "cannot be treated as factory-ready. Export a development package anyway?").arg(blockers),
        QMessageBox::Yes|QMessageBox::No,QMessageBox::No);
      if (answer!=QMessageBox::Yes) return;
    }
    saveGenerated("Export native development production package",
      "garment-studio-native-development.zip","ZIP archive (*.zip)",
      garment::buildNativeFactoryZip(*document_));
  } catch(const std::exception& ex) {QMessageBox::warning(this,"Factory package export failed",ex.what());}
}

void MainWindow::exportFullFactoryDevelopmentZip() {
  try{
    const auto production=garment::inspectProduction(document_->data(),true);
    const auto source=garment::factory_package_files::Json::parse(document_->data().dump());
    const auto generated=garment::factory_package_files::buildFactoryPackageFiles(source);
    QString warning=QString(
      "This experimental C++ factory package contains %1 development files. "
      "It is NOT factory-certified or yet byte-identical to JavaScript; "
      "graded DXF values, marker PDFs and some production reports still differ.\n\n"
      "Physical samples and cutting instructions must be checked independently.")
      .arg(static_cast<qulonglong>(generated.files.size()));
    const int blockers=production.value("blockers",0);
    if(blockers>0) warning+=QString("\n\nThe project's production preflight has %1 blocker(s).")
      .arg(blockers);
    if(!generated.missing.empty()){
      warning+="\n\nMissing required entries:\n";
      for(const auto& entry:generated.missing)if(entry.is_string())
        warning+=QString::fromStdString(entry.get<std::string>())+"\n";
    }
    warning+="\nExport a development-only archive for inspection?";
    if(QMessageBox::question(this,"Experimental factory package (uncertified)",
      warning,QMessageBox::Yes|QMessageBox::No,QMessageBox::No)!=QMessageBox::Yes)return;
    std::vector<garment::FactoryZipEntry> entries;
    entries.reserve(generated.files.size());
    for(const auto& file:generated.files)entries.push_back({file.first,file.second});
    const auto archive=garment::buildStoredZip(entries);
    saveGenerated("Export experimental full native factory package",
      "garment-studio-factory-full-EXPERIMENTAL-UNCERTIFIED.zip",
      "ZIP archive (*.zip)",archive);
  }catch(const std::exception& ex){
    QMessageBox::warning(this,"Experimental factory package export failed",
      QString::fromUtf8(ex.what()));
  }
}

void MainWindow::mutate(const std::string& command,const Json& args) {
  try {
    const auto before=document_->data();
    auto result=document_->apply(command,args,document_->data().value("revision",0));
    if (!result.changed) return;
    undo_.push_back(before);
    if (undo_.size()>150) undo_.erase(undo_.begin());
    redo_.clear();
    updateAll();
    statusBar()->showMessage(QString::fromStdString(command) +
                             QString(" · document revision %1").arg(result.afterRevision),3500);
  } catch (const std::exception& ex) {
    QMessageBox::warning(this,"CAD edit rejected",QString::fromUtf8(ex.what()));
    updateAll();
  }
}

void MainWindow::undo() {
  if (undo_.empty()) return;
  redo_.push_back(document_->data());
  document_->restore(undo_.back());
  undo_.pop_back();
  updateAll();
}

void MainWindow::redo() {
  if (redo_.empty()) return;
  undo_.push_back(document_->data());
  document_->restore(redo_.back());
  redo_.pop_back();
  updateAll();
}

void MainWindow::openDocument() {
  QString path=QFileDialog::getOpenFileName(this,"Open a copy of an existing garment project",{},"Garment JSON (*.json);;All files (*)");
  if (path.isEmpty())return;
  try {
    auto imported=std::make_unique<Document>(fromFile(path));
    document_=std::move(imported);
    sourceFile_=path;
    undo_.clear();redo_.clear();
    selectedPoint_=-1;
    selectedPiece_=document_->data().at("pieces").empty()?"":document_->data().at("pieces")[0].at("id").get<std::string>();
    updateAll(true);
    statusBar()->showMessage("Opened read-only source. Use Save a copy to export; original remains untouched.",9000);
  } catch (const std::exception& ex) {QMessageBox::warning(this,"Unable to read garment",ex.what());}
}

void MainWindow::saveCopy() {
  QString candidate=sourceFile_.isEmpty()?QStringLiteral("garment-studio-native-copy.json"):
    QFileInfo(sourceFile_).completeBaseName()+QStringLiteral("-native-copy.json");
  QString path=QFileDialog::getSaveFileName(this,"Save separate native garment copy",candidate,"Garment JSON (*.json)");
  if (path.isEmpty()) return;
  if ((!sourceFile_.isEmpty() && QFileInfo(path).absoluteFilePath()==QFileInfo(sourceFile_).absoluteFilePath()) ||
      QFileInfo::exists(path) || QFileInfo(path).isSymLink()) {
    QMessageBox::warning(this,"Protect original project","Choose an unused filename. This preview never overwrites any saved project.");
    return;
  }
  QSaveFile dest(path);
  if (!dest.open(QIODevice::WriteOnly)) {
    QMessageBox::warning(this,"Cannot save",dest.errorString());return;
  }
  const QByteArray payload=QByteArray::fromStdString(document_->data().dump(2))+'\n';
  if (dest.write(payload)!=payload.size() || !dest.commit()) {
    QMessageBox::warning(this,"Save failed",dest.errorString());return;
  }
  statusBar()->showMessage("Saved separate lossless garment JSON copy: " + path,7000);
}
