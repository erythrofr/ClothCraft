#include "main_window.hpp"
#include "zozo_reference_viewer.hpp"

#include <QApplication>
#include <QCoreApplication>
#include <QFile>
#include <QFileInfo>
#include <QFont>
#include <QGraphicsView>
#include <QGraphicsScene>
#include <QListWidget>
#include <QDockWidget>
#include <QDialog>
#include <QDir>
#include <QMenuBar>
#include <QMenu>
#include <QMessageBox>
#include <QPixmap>
#include <QSlider>
#include <QTimer>

#include <exception>
#include <iostream>
#include <string>

namespace {

garment::Json fallback() {
  return {{"id","native-cpp-demo"},{"version",21},{"revision",1},{"units","cm"},
          {"name","Native CAD Demo (separate from your saved projects)"},
          {"pieces",garment::Json::array({
            {{"id","front"},{"name","Front panel"},
             {"layout2d",{{"x",-26},{"y",3}}},
             {"arrangement3d",{{"x",0},{"y",.7},{"z",.22}}},
             {"points",garment::Json::array({
               {{"x",-18},{"y",0}},{{"x",18},{"y",0}},{{"x",21},{"y",68}},{{"x",-21},{"y",68}}})},
             {"curves",{{"2",{{"cx",0},{"cy",75}}}}}, {"seamAllowance",1.0}},
            {{"id","back"},{"name","Back panel"},
             {"layout2d",{{"x",32},{"y",3}}},
             {"arrangement3d",{{"x",0},{"y",.7},{"z",-.22}}},
             {"points",garment::Json::array({
               {{"x",-18},{"y",0}},{{"x",18},{"y",0}},{{"x",21},{"y",68}},{{"x",-21},{"y",68}}})},
             {"seamAllowance",1.0}}
          })},
          {"seams",garment::Json::array({
            {{"id","side-left"},{"a",{{"pieceId","front"},{"edgeIndex",3}}},
                               {"b",{{"pieceId","back"},{"edgeIndex",3}}}}
          })}};
}

garment::Json load(const QString& path) {
  QFile file(path);
  if (!file.open(QIODevice::ReadOnly)) throw std::runtime_error("cannot read: " + path.toStdString());
  QByteArray bytes=file.readAll();
  return garment::Json::parse(bytes.constData(),bytes.constData()+bytes.size());
}

} // namespace

int main(int argc,char** argv) {
  QApplication app(argc,argv);
  QApplication::setApplicationName("EXO Sample 3D · C++");
  QApplication::setOrganizationName("MIKRISTIAN");
  QFont font=app.font();
  font.setPointSize(11);
  app.setFont(font);
  try {
    const bool smoke=argc>=2 && std::string(argv[1])=="--smoke-test";
    const bool zozoSmoke=argc>=2 && std::string(argv[1])=="--zozo-preview-smoke";
    auto project=fallback();
    QString sourcePath;
    if (argc>=2 && !smoke && !zozoSmoke) {
      sourcePath=QString::fromLocal8Bit(argv[1]);
      project=load(sourcePath);
    } else {
      QString sample=QCoreApplication::applicationDirPath() + "/../Resources/sample-tee.json";
      if (QFile::exists(sample)) {
        sourcePath=sample;
        project=load(sample);
      }
    }
    MainWindow window(std::move(project),sourcePath);
    window.show();
    if(zozoSmoke){
      QTimer::singleShot(60,&app,[&app,&window] {
        QTimer::singleShot(1100,&app,[&app,&window] {
          auto* dialog=window.findChild<QDialog*>("NativeZozoReferenceViewer");
          auto* preview=dialog?dialog->findChild<QWidget*>("NativeZozoReferenceCanvas"):nullptr;
          auto* slider=dialog?dialog->findChild<QSlider*>("NativeZozoFrameSlider"):nullptr;
          const auto initialRaster=preview?preview->grab():QPixmap();
          if(slider)slider->setValue(90); // Preserved source intersection warning frame.
          QApplication::processEvents();
          const auto raster=preview?preview->grab():QPixmap();
          const bool scrubbing=slider && slider->value()==90 && !initialRaster.isNull()
            && !raster.isNull() && initialRaster.toImage()!=raster.toImage();
          const QString screenshot=qEnvironmentVariable("GARMENT_QT_ZOZO_SMOKE_PNG");
          const bool captured=screenshot.isEmpty() ||
            (!QFileInfo::exists(screenshot) && raster.save(screenshot,"PNG"));
          const bool verified=dialog && dialog->isVisible() && preview &&
              preview->width()>500 && preview->height()>300 && scrubbing && captured;
          std::cout<<"QT_ZOZO_REFERENCE_SMOKE "<<(verified?"PASS":"FAIL")
            <<" readOnlyDialog="<<(dialog && dialog->isVisible())
            <<" wireframe="<<(preview?preview->width():0)<<"x"
            <<(preview?preview->height():0)<<" image="<<raster.width()<<"x"
            <<raster.height()<<" frame90Scrub="<<scrubbing
            <<" imageSaved="<<captured<<std::endl;
          if(dialog)dialog->accept();
          app.exit(verified?0:3);
        });
        try{
          showZozoReferenceViewer(&window,
            QDir::current().filePath("public/references/zozo-dress"));
        }catch(const std::exception& ex){
          std::cerr<<"QT_ZOZO_REFERENCE_SMOKE FAIL: "<<ex.what()<<std::endl;
          app.exit(4);
        }
      });
    }
    if (smoke) {
      QTimer::singleShot(600,&app,[&app,&window] {
        const auto* outliner=window.findChild<QListWidget*>("NativePatternList");
        const auto* production=window.findChild<QDockWidget*>("NativeProductionInspector");
        const auto* canvas=window.findChild<QGraphicsView*>("NativePatternCanvas");
        const auto* staging=window.findChild<QWidget*>("NativeStagingCanvas");
        bool obj=false,gltf=false,pdf=false,bom=false,zip=false,fullFactory24=false;
        for(const QAction* top:window.menuBar()->actions()) {
          if(!top->menu() || top->text()!="Production") continue;
          for(const QAction* a:top->menu()->actions()) {
            if(!a->isEnabled()) continue;
            const auto text=a->text();
            obj |= text.contains("flat OBJ");
            gltf |= text.contains("glTF 2.0");
            pdf |= text.contains("marker PDF");
            bom |= text.contains("BOM XML");
            zip |= text.contains("factory ZIP");
            fullFactory24 |= text.contains("full factory ZIP") &&
                             text.contains("uncertified");
          }
        }
        const bool nativeExportMenus=obj&&gltf&&pdf&&bom&&zip&&fullFactory24;
        const QPixmap captured=window.grab();
        const bool valid=outliner && outliner->count()==4 && production && nativeExportMenus &&
          canvas && canvas->scene() && canvas->scene()->items().size()>4 &&
          canvas->viewport()->width()>220 && canvas->viewport()->height()>200 &&
          staging && staging->width()>200 &&
          window.isVisible() &&
          !captured.isNull() && captured.width()>300 && captured.height()>300;
        const QString screenshot=qEnvironmentVariable("GARMENT_QT_SMOKE_PNG");
        const bool imageSaved=screenshot.isEmpty() ||
          (!QFileInfo::exists(screenshot) && captured.save(screenshot,"PNG"));
        std::cout << "QT_NATIVE_SMOKE " << (valid && imageSaved?"PASS":"FAIL")
                  << " visible=" << window.isVisible()
                  << " pieces=" << (outliner?outliner->count():0)
                  << " canvas=" << (canvas?canvas->viewport()->width():0)
                  << "x" << (canvas?canvas->viewport()->height():0)
                  << " drawingItems=" << (canvas&&canvas->scene()?canvas->scene()->items().size():0)
                  << " exports=" << nativeExportMenus
                  << " fullFactory24=" << fullFactory24
                  << " raster=" << captured.width() << "x" << captured.height()
                  << " imageSaved=" << imageSaved << std::endl;
        app.exit(valid && imageSaved?0:3);
      });
    }
    return app.exec();
  } catch (const std::exception& e) {
    QMessageBox::critical(nullptr,"Native CAD could not start",QString::fromUtf8(e.what()));
    std::cerr << e.what() << '\n';
    return 2;
  }
}
