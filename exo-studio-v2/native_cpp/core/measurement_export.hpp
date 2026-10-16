#pragma once

#include "garment_document.hpp"

namespace garment {

// Source-of-truth JS equivalent: src/core/measurements.js. 2D centimetre
// measurements, no simulation and no claim of production fit certification.
Json measureProject(const Document& document);
Json buildMeasurementSizeRun(const Document& document);
std::string measurementRunToCsv(const Document& document);

} // namespace garment
