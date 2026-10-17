#pragma once
#include "garment_document.hpp"
#include <functional>
namespace garment::ppf_service_client {
inline constexpr const char* DEFAULT_PPF_SERVICE_URL="http://127.0.0.1:5192";
using ProgressCallback=std::function<void(const Json&)>;
Json getPpfServiceHealth(const Json& options=Json::object());
Json submitPpfFinalSolve(const Json& project,const Json& options=Json::object());
Json getPpfJob(const std::string& jobId,const Json& options=Json::object());
Json getPpfJobPreview(const std::string& jobId,const Json& options=Json::object());
Json waitForPpfJob(const std::string& jobId,const Json& options=Json::object(),ProgressCallback onProgress={});
}
