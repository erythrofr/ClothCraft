#pragma once
#include "garment_document.hpp"
#include <string>
namespace garment {
// Snapshot adapter: caller supplies JSON projections of browser THREE/Map state.
Json createNativeBackendSession(const Json& project,const Json& simulation,const Json& payload);
Json createBrowserBackendSession(const Json& project,const Json& simulation,const Json& request,const Json& protocolVersion);
Json adoptNativeBackendResult(const Json& session,const Json& result,double elapsedMs=0);
Json nativeBackendStats(const Json& session);
Json browserBackendStats(const Json& session);
Json browserBackendPieceState(const Json& session,const std::string& pieceId);
Json incrementBrowserBackendFrame(const Json& session);
Json disposeNativeBackendSession(const Json& session);
Json disposeBrowserBackendSession(const Json& session);
void rejectSynchronousNativeStep();
// Pure request metadata adapter. Transport, cancellation and promises remain in host client.
Json nativeBackendHttpRequest(const Json& session,int frames=8);
}
