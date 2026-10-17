#include "seamly_import.hpp"
#include <libxml/parser.h>
#include <libxml/tree.h>
#include <algorithm>
#include <cmath>
#include <map>
#include <regex>
#include <set>
#include <stdexcept>
namespace garment {
const Json SEAMLY_AVATAR_FIELDS={{"height","heightCm"},{"bust_circ","chestCm"},{"waist_circ","waistCm"},
 {"hip_circ","hipCm"},{"neck_circ","neckCm"},{"arm_shoulder_tip_to_wrist","armLengthCm"}};
namespace {
using Node=xmlNodePtr;
std::string text(Node n){if(!n)return "";xmlChar* content=xmlNodeGetContent(n);if(!content)return "";std::string s=reinterpret_cast<const char*>(content);xmlFree(content);return s;}
std::string trim(std::string s){auto start=s.find_first_not_of(" \t\r\n");if(start==std::string::npos)return "";auto end=s.find_last_not_of(" \t\r\n");return s.substr(start,end-start+1);}
std::string name(Node n){return n?reinterpret_cast<const char*>(n->name):"";}
std::string attr(Node n,const char* k){if(!n)return "";xmlChar* v=xmlGetProp(n,BAD_CAST k);if(!v)return "";std::string s=reinterpret_cast<const char*>(v);xmlFree(v);return s;}
Node child(Node n,const char* k){for(Node p=n?n->children:nullptr;p;p=p->next)if(p->type==XML_ELEMENT_NODE&&name(p)==k)return p;return nullptr;}
std::vector<Node> children(Node n,const char* k){std::vector<Node> out;for(Node p=n?n->children:nullptr;p;p=p->next)if(p->type==XML_ELEMENT_NODE&&(k==nullptr||name(p)==k))out.push_back(p);return out;}
double measure(std::string s,const std::string& field,bool negative=false){
 s=trim(s);if(s.empty())throw std::invalid_argument("Missing "+field);
 std::size_t length=0;double n=NAN;try{n=std::stod(s,&length);}catch(...){}
 if(length!=s.size()||!std::isfinite(n)||(!negative&&n<0)||std::abs(n)>1e6)throw std::invalid_argument("Non-numeric or invalid "+field+"; formula evaluation requires the Seamly2D engine");
 return n;
}
double round6(double x){return std::round(x*1e6)/1e6;}
std::string lower(std::string s){std::transform(s.begin(),s.end(),s.begin(),[](unsigned char c){return static_cast<char>(std::tolower(c));});return s;}
struct Doc{
 xmlDocPtr doc=nullptr;
 explicit Doc(const std::string& input,std::size_t maximum,const char* label){
  if(input.size()>maximum)throw std::invalid_argument(std::string(label)+" must be XML smaller than "+(maximum==2097152?"2":"4")+" MB");
  if(std::regex_search(input,std::regex(R"(<!\s*(DOCTYPE|ENTITY)\b)",std::regex::icase)))throw std::invalid_argument(maximum==2097152?"XML document types and entities are not allowed":"DOCTYPE/ENTITY are forbidden in garment-construction imports");
  doc=xmlReadMemory(input.data(),static_cast<int>(input.size()),"seamly.xml",nullptr,XML_PARSE_NONET|XML_PARSE_NOERROR|XML_PARSE_NOWARNING);
  if(!doc)throw std::invalid_argument(maximum==2097152?"Invalid Seamly measurement XML: not well formed":"Invalid .sm2d source XML: not well formed");
 }
 ~Doc(){if(doc)xmlFreeDoc(doc);}
 Node root()const{return xmlDocGetRootElement(doc);}
};
std::string clipped(std::string s,std::size_t n){if(s.size()>n)s.resize(n);return s;}
}
Json parseSeamlyMeasurements(const std::string& xml,const std::string& filename){
 Doc doc(xml,2097152,"Seamly measurement file");
 Node root=doc.root();const std::string kind=name(root);
 if(kind!="smis"&&kind!="smms")throw std::invalid_argument("Only SeamlyMe .smis or .smms measurements are supported. Import .sm2d construction using Seamly2D until the formula interpreter is implemented.");
 std::string unit=lower(trim(text(child(root,"unit"))));
 const std::map<std::string,double> scales={{"cm",1},{"mm",.1},{"inch",2.54},{"in",2.54}};
 auto scale=scales.find(unit);if(scale==scales.end())throw std::invalid_argument("Unsupported Seamly measurement unit: "+(unit.empty()?"(missing)":unit));
 const auto entries=children(child(root,"body-measurements"),"m");
 if(entries.empty()||entries.size()>600)throw std::invalid_argument("Expected 1–600 Seamly body measurements");
 Json measurements=Json::object();std::regex valid(R"(^[A-Za-z_][A-Za-z_0-9-]{0,127}$)");
 for(Node entry:entries){
  std::string id=trim(attr(entry,"name"));
  if(!std::regex_match(id,valid)||measurements.contains(id))throw std::invalid_argument("Invalid or duplicate Seamly measurement identifier: "+id);
  double base=measure(attr(entry,kind=="smms"?"base":"value"),id+" base value")*scale->second;
  std::string description=attr(entry,"description");if(description.empty())description=attr(entry,"full_name");
  Json record={{"name",id},{"baseCm",round6(base)},{"description",description}};
  if(kind=="smms"){
   auto increment=[&](const char* k,const char* title){
    std::string raw=attr(entry,k);return round6(measure(raw.empty()?"0":raw,id+title,true)*scale->second);
   };
   record["sizeIncrementCm"]=increment("size_increase"," size increment");
   record["heightIncrementCm"]=increment("height_increase"," height increment");
  }
  measurements[id]=record;
 }
 return {{"format","garment-studio-seamlyme-measurements.v1"},{"kind",kind},
 {"sourceName",filename.empty()?Json(nullptr):Json(clipped(filename,255))},{"sourceUnit",unit},
 {"baseSize",kind=="smms"?Json(attr(child(root,"size"),"base")):Json(nullptr)},
 {"baseHeight",kind=="smms"?Json(attr(child(root,"height"),"base")):Json(nullptr)},
 {"note",trim(text(child(root,"notes")))},{"measurementCount",measurements.size()},{"measurements",measurements},
 {"assumptions",kind=="smms"?
 "Base size and height values only; Seamly grading increments are preserved but not applied without its full measurement/formula evaluation.":
 "Individual measurement values only; this does not import or evaluate a Seamly .sm2d drafting formula dependency graph."}};
}
Json applySeamlyMeasurements(const Json& project,const Json& library,bool toAvatar){
 if(!library.is_object()||library.value("format",std::string())!="garment-studio-seamlyme-measurements.v1")throw std::invalid_argument("Invalid SeamlyMe measurement library");
 Json result=project;
 if(!result.is_object())result=Json::object();
 if(!result.contains("measurementLibrary")||!result["measurementLibrary"].is_object())result["measurementLibrary"]=Json::object();
 result["measurementLibrary"]["seamly"]=library;
 if(toAvatar){
  if(!result.contains("avatar")||!result["avatar"].is_object())result["avatar"]=Json::object();
  const auto& measurements=library.value("measurements",Json::object());
  for(auto it=SEAMLY_AVATAR_FIELDS.begin();it!=SEAMLY_AVATAR_FIELDS.end();++it){
   if(!measurements.is_object()||!measurements.contains(it.key()))continue;
   const auto& value=measurements.at(it.key()).value("baseCm",Json());
   if(value.is_number()&&std::isfinite(value.get<double>())&&value.get<double>()>0)result["avatar"][it.value().get<std::string>()]=value;
  }
 }
 return result;
}
Json parseSeamlyConstructionReference(const std::string& xml,const std::string& filename){
 Doc doc(xml,4194304,"Seamly .sm2d source");
 Node root=doc.root();
 if(name(root)!="pattern"||!child(root,"version")||!child(root,"unit"))throw std::invalid_argument("The file is not a Seamly2D pattern construction");
 const std::string unit=lower(text(child(root,"unit")));
 if(unit!="cm"&&unit!="mm"&&unit!="inch"&&unit!="in")throw std::invalid_argument("Unsupported Seamly2D unit: "+unit);
 auto blocks=children(root,"draftBlock"),draws=children(root,"draw");blocks.insert(blocks.end(),draws.begin(),draws.end());
 if(blocks.empty()||blocks.size()>100)throw std::invalid_argument("Expected 1–100 Seamly2D draft blocks");
 Json increments=Json::array();std::set<std::string> defined,used;
 for(Node item:children(child(root,"increments"),"increment")){
  auto id=clipped(attr(item,"name"),128);
  if(id.empty()||!defined.insert(id).second)throw std::invalid_argument("Duplicate or invalid Seamly increment: "+id);
  increments.push_back({{"name",id},{"formula",clipped(attr(item,"formula"),4096)},{"description",clipped(attr(item,"description"),2048)}});
 }
 Json groups=Json::array(),types=Json::object();int total=0,index=0;
 const std::vector<std::string> referenceKeys={"firstPoint","secondPoint","basePoint","point1","point4","curve","idObject"};
 std::regex hash(R"(#[A-Za-z][A-Za-z_0-9]*)");
 for(Node block:blocks){
  ++index;Json nodes=Json::array();std::set<std::string> usedIds;
  for(Node item:children(child(block,"calculation"),nullptr)){
    const std::string family=name(item);
    auto id=attr(item,"id"),type=attr(item,"type");if(type.empty())type=family;
    if(id.empty()||!usedIds.insert(id).second)throw std::invalid_argument("Seamly draft block has duplicate or missing construction ID: "+id);
    Json attrs=Json::object(),refs=Json::object();
    for(xmlAttrPtr a=item->properties;a;a=a->next){
     const auto key=reinterpret_cast<const char*>(a->name);
     auto val=clipped(attr(item,key),4096);attrs[key]=val;
     if(std::find(referenceKeys.begin(),referenceKeys.end(),key)!=referenceKeys.end())refs[key]=val;
     for(std::sregex_iterator i(val.begin(),val.end(),hash),end;i!=end;++i)used.insert(i->str());
    }
    nodes.push_back({{"id",id},{"family",family},{"type",type},{"name",attrs.value("name",std::string()).empty()?Json(nullptr):attrs.at("name")},{"attributes",attrs},{"references",refs}});
    const auto typeKey=family+":"+type;types[typeKey]=types.value(typeKey,0)+1;
    if(++total>6000)throw std::invalid_argument("Seamly construction contains too many tools");
  }
  std::string blockName=attr(block,"name");if(blockName.empty())blockName="Draft block "+std::to_string(index);
  groups.push_back({{"id","block-"+std::to_string(index)},{"name",clipped(blockName,160)},{"toolCount",nodes.size()},{"nodes",nodes},{"detailCount",children(child(block,"details"),"detail").size()}});
 }
 Json unresolved=Json::array();for(const auto& id:used)if(!defined.count(id))unresolved.push_back(id);
 return {{"format","garment-studio-seamly-construction-reference.v1"},{"kind","sm2d"},
 {"version",clipped(text(child(root,"version")),80)},{"unit",unit},
 {"sourceName",filename.empty()?Json(nullptr):Json(clipped(filename,255))},
 {"description",clipped(text(child(root,"description")),2048)},
 {"measurementPath",clipped(text(child(root,"measurements")),512)},
 {"note","Read-only source graph. Geometry tools/formulas, cutting details and measurement dependencies require the original Seamly2D solver. Garment Studio will not pretend this is a manufacturing-ready flattened outline."},
 {"blocks",groups},{"toolCount",total},{"incrementCount",increments.size()},{"increments",increments},
 {"toolTypes",types},{"unresolvedIncrements",unresolved}};
}
}
