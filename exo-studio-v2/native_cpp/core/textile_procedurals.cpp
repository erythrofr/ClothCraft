#include "textile_procedurals.hpp"
#include <algorithm>
#include <cmath>
#include <map>
#include <regex>
#include <string>
#include <vector>
namespace garment::textile_procedurals {
static constexpr double PI=3.141592653589793238462643383279502884;
static double clamp(double x,double a,double b){return std::max(a,std::min(b,x));}
static double value(const Json& j,const char* key,double fallback){if(!j.is_object()||!j.contains(key)||j[key].is_null())return fallback;const auto& x=j[key];if(x.is_number())return x.get<double>();if(x.is_boolean())return x.get<bool>()?1:0;if(x.is_string()){try{return std::stod(x.get<std::string>());}catch(...){return NAN;}}return NAN;}
static double optics(const Json& j,const char* key,double a,double b,double fallback){if(!j.is_object()||!j.contains(key))return fallback;double v=j[key].is_null()?0:value(j,key,NAN);return std::isfinite(v)?clamp(v,a,b):fallback;}
static std::string lower(std::string s){std::transform(s.begin(),s.end(),s.begin(),[](unsigned char c){return char(std::tolower(c));});return s;}
static double noise(double u,double v){double t=2*PI;return .52*std::sin(t*(13*u+19*v))+.31*std::cos(t*(37*u-23*v))+.17*std::sin(t*(59*u+43*v));}
static double woven(double u,double v,int threads,const std::string& type="plain"){
 double warp=std::pow((std::cos(2*PI*threads*u)+1)*.5,1.8),weft=std::pow((std::cos(2*PI*threads*v)+1)*.5,1.8);
 int wi=int(std::floor(threads*u+.5)),vi=int(std::floor(threads*v+.5));
 bool above=(wi+vi)%2==0;if(type=="twill")above=((wi+vi)%4+4)%4!=0;if(type=="satin")above=((wi+2*vi)%5+5)%5!=0;
 return .40*warp+.40*weft+(above?.23:-.23)*warp*weft;
}
Json describeTextileSurface(const Json& fabric){
 std::string name="";if(fabric.is_object()){for(const auto* key:{"name","id"})if(name.empty()&&fabric.contains(key)&&fabric[key].is_string())name=fabric[key].get<std::string>();}
 name=lower(name);std::string family="plain-weave";
 if(name.find("ripstop")!=std::string::npos)family="ripstop";
 else if(name.find("corduroy")!=std::string::npos||name.find("wale")!=std::string::npos)family="corduroy";
 else if(name.find("velvet")!=std::string::npos||name.find("velour")!=std::string::npos||name.find("plush")!=std::string::npos)family="velvet";
 else if(name.find("organza")!=std::string::npos||name.find("chiffon")!=std::string::npos||name.find("voile")!=std::string::npos)family="sheer-weave";
 else if(name.find("rib")!=std::string::npos)family="rib-knit";
 else if(std::regex_search(name,std::regex("jersey|single.?knit|cotton.?knit|tee")))family="jersey-knit";
 else if(name.find("fleece")!=std::string::npos||name.find("terry")!=std::string::npos)family="terry-knit";
 else if(name.find("denim")!=std::string::npos||name.find("jean")!=std::string::npos||name.find("twill")!=std::string::npos)family="twill";
 else if(name.find("suede")!=std::string::npos||name.find("nap")!=std::string::npos)family="suede";
 else if(name.find("leather")!=std::string::npos)family="leather";
 else if(name.find("silk")!=std::string::npos||name.find("satin")!=std::string::npos)family="silk";
 else if(name.find("nylon")!=std::string::npos||name.find("polyester")!=std::string::npos)family="synthetic";
 if(fabric.is_object()&&fabric.contains("surfaceFamily")&&fabric["surfaceFamily"].is_string()&&fabric["surfaceFamily"]!="auto"&&!fabric["surfaceFamily"].get<std::string>().empty())family=fabric["surfaceFamily"].get<std::string>();
 static const std::map<std::string,double> gains={{"jersey-knit",.76},{"rib-knit",.88},{"terry-knit",1.04},{"twill",.88},{"plain-weave",.75},{"synthetic",.46},{"silk",.30},{"suede",.66},{"leather",.67},{"ripstop",.63},{"velvet",.82},{"sheer-weave",.27},{"corduroy",1.05}};
 auto it=gains.find(family);return {{"family",family},{"tileCm",optics(fabric,"weaveScaleCm",.3,10,3)},{"normalGain",it==gains.end()?.75:it->second}};
}
double textileRelief(const std::string& f,double u,double v){
 const double wx=2*PI*28*u,wy=2*PI*31*v,n=noise(u,v);
 if(f=="jersey-knit")return .42*std::cos(wx+.64*std::sin(wy))+.27*std::cos(wy)+.10*n;
 if(f=="rib-knit")return .56*std::cos(2*PI*15*u)+.23*std::cos(wx+.52*std::sin(wy))+.13*n;
 if(f=="corduroy")return .78*std::cos(2*PI*14*u)+.12*std::cos(2*PI*70*u)+.09*n;
 if(f=="terry-knit")return .32*std::cos(wx+.61*std::sin(wy))+.23*std::cos(wy)+.21*std::cos(2*PI*(11*u+11*v))+.18*n;
 if(f=="twill")return woven(u,v,32,"twill")+.09*n;
 if(f=="silk")return .45*woven(u,v,40,"satin")+.045*n;
 if(f=="synthetic")return .20*std::cos(2*PI*42*u)*std::cos(2*PI*40*v)+.08*n;
 if(f=="ripstop"){double latticeU=std::pow(std::max(0.,std::cos(2*PI*6*u)),18),latticeV=std::pow(std::max(0.,std::cos(2*PI*6*v)),18);return .62*woven(u,v,36)+.47*(latticeU+latticeV)+.05*n;}
 if(f=="sheer-weave")return .30*woven(u,v,44)+.03*n;
 if(f=="velvet")return .33*std::cos(2*PI*51*u)*std::cos(2*PI*53*v)+.24*n;
 if(f=="leather")return .23*std::sin(2*PI*(7*u+13*v))*.5+.26*std::cos(2*PI*(9*u-5*v))+.15*n;
 if(f=="suede")return .23*n+.18*std::sin(2*PI*(19*u+17*v));
 return woven(u,v,32)+.095*n;
}
static int byte(double v){if(!std::isfinite(v))return 0;return int(clamp(std::floor(v+.5),0,255));}
Json makeProceduralTextileMaps(const Json& fabric,int resolution){
 if(resolution<1||resolution>256)throw std::invalid_argument("resolution must be 1..256");
 auto spec=describeTextileSurface(fabric);const std::string family=spec["family"];const int count=resolution*resolution;
 std::vector<float> heights(count);float min=INFINITY,max=-INFINITY;
 for(int y=0;y<resolution;y++)for(int x=0;x<resolution;x++){float h=float(textileRelief(family,double(x)/resolution,double(y)/resolution));heights[y*resolution+x]=h;min=std::min(min,h);max=std::max(max,h);}
 auto height=[&](int x,int y){return double(heights[((y+resolution)%resolution)*resolution+(x+resolution)%resolution]);};
 double thickness=value(fabric,"thickness",.002);if(!std::isfinite(thickness)||thickness==0)thickness=.002;
 double gain=spec["normalGain"].get<double>()*clamp(thickness/.002,.4,1.6);
 static const std::map<std::string,int> base={{"silk",190},{"sheer-weave",204},{"synthetic",214},{"leather",212},{"twill",231},{"jersey-knit",235},{"rib-knit",230},{"terry-knit",246},{"velvet",245},{"corduroy",247},{"suede",250},{"ripstop",221},{"plain-weave",234}};
 auto it=base.find(family);int roughBase=it==base.end()?232:it->second;
 double variation=optics(fabric,"colorVariation",0,1,.25);
 Json normal=Json::array(),roughness=Json::array(),color=Json::array(),rawHeight=Json::array();
 for(int y=0;y<resolution;y++)for(int x=0;x<resolution;x++){
  double u=double(x)/resolution,v=double(y)/resolution;
  double dx=(height(x+1,y)-height(x-1,y))*.5,dy=(height(x,y+1)-height(x,y-1))*.5;
  double nx=-dx*gain*2,ny=-dy*gain*2,inverse=1/std::hypot(nx,ny,1.);
  for(int c:{byte(127.5+127.5*nx*inverse),byte(127.5+127.5*ny*inverse),byte(127.5+127.5*inverse),255})normal.push_back(c);
  double ratio=(height(x,y)-min)/std::max(1e-6,double(max)-min);
  int rough=byte(clamp(roughBase+(ratio-.5)*22,0,255));for(int c:{rough,rough,rough,255})roughness.push_back(c);
  double waves=family=="twill"?.5*std::cos(2*PI*(28*u+10*v)):family=="rib-knit"?.65*std::cos(2*PI*15*u):(family=="leather"||family=="suede")?.25*std::cos(2*PI*(7*u+13*v)):.3*std::cos(2*PI*28*u)+.3*std::cos(2*PI*31*v);
  int albedo=byte(clamp(1-variation*(.07+.04*waves),.82,1)*255);
  for(int c:{albedo,albedo,albedo,255})color.push_back(c);
  rawHeight.push_back(height(x,y));
 }
 Json texture=fabric.is_object()?fabric.value("texture",Json::object()):Json::object();
 if(!texture.is_object())texture=Json::object();
 double tile=spec["tileCm"],repeatX=std::max(.5,value(texture,"repeatWidthCm",20))/tile,repeatY=std::max(.5,value(texture,"repeatHeightCm",20))/tile;
 double rotation=value(texture,"rotationDeg",0)*PI/180;
 return {{"family",family},{"tileCm",tile},{"resolution",resolution},{"repeat",{{"x",repeatX},{"y",repeatY}}},{"rotation",rotation},{"colorSpace",{{"color","srgb"},{"normal","none"},{"roughness","none"}}},{"heights",rawHeight},{"colorPixels",color},{"normalPixels",normal},{"roughnessPixels",roughness}};
}
}
