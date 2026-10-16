#include "cloth_solver_step_extended.hpp"
#include "cloth_simulation.hpp"
#include <cmath>
#include <stdexcept>
namespace garment::cloth_solver_step_extended {
Json step(const Json& snapshot,const Json& project,double dt,int frames){
 if(frames<0||frames>1000)throw std::invalid_argument("frames outside supported range 0..1000");
 if(!std::isfinite(dt)||dt<0)throw std::invalid_argument("invalid timestep");
 const auto settings=project.value("simulation",Json::object());
 if(!settings.is_object())throw std::invalid_argument("simulation settings must be object");
 if(settings.value("collisions",true)||settings.value("selfCollision",true))
  throw std::runtime_error("Collision-enabled simulation requires body/self contact, seam stabilization and contact telemetry parity; unsupported");
 if(settings.value("continuousSurfaceContact",false)||settings.value("bodyTriangleContactAssist",false))
  throw std::runtime_error("Surface contact corrections unsupported");
 const auto wind=settings.value("wind",Json::object());
 if(wind.is_object()&&wind.value("enabled",false)&&wind.value("speed",0.0)>0.01)
  throw std::runtime_error("Wind force integration unsupported");
 Json state=snapshot;
 for(int i=0;i<frames;++i)state=garment::stepSimulation(state,project,dt);
 return state;
}
}
