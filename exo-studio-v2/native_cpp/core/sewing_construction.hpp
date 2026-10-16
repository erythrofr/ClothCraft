#pragma once
#include "garment_document.hpp"
namespace garment {
Json seamEndpointInterval(const Json& endpoint);
bool seamEndpointOverlap(const Json& a,const Json& b,double epsilon=1e-5);
Json validateNewSeam(const Json& project,const Json& proposed,const Json& options=Json::object());
Json auditSewingConstruction(const Json& project,const Json& options=Json::object());
}
