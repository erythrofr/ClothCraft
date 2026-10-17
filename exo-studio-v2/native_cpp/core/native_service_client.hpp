#pragma once
#include "garment_document.hpp"
#include <string>
namespace garment::native_service_client {
inline constexpr const char* DEFAULT_NATIVE_SERVICE_URL="http://127.0.0.1:5191";
// Synchronous localhost HTTP adapter. Remote endpoints need allowRemote=true.
Json getNativeBackendHealth(const Json& options=Json::object());
Json getNativeServiceHealth(const Json& options=Json::object());
Json runNativeBackend(const Json& project,const Json& options=Json::object());
Json solveWithNativeService(const Json& project,const Json& options=Json::object());
Json stepNativePayload(const Json& payload,const Json& options=Json::object());
}
