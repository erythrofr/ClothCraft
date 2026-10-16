#pragma once

#include <QString>
class QWidget;

// Opens a deliberately separate, READ-ONLY reference viewer. Never changes
// the active garment document or treats an upstream ZOZO recording as a
// physically accepted fitting result.
void showZozoReferenceViewer(QWidget* parent,const QString& referenceDirectory);
