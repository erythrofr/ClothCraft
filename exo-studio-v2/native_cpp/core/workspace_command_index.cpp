#include "workspace_command_index.hpp"
#include <algorithm>
#include <cctype>
#include <cmath>
#include <set>
#include <string>
#include <vector>
namespace garment::workspace_command_index {
const Json EXTRA_WORKSPACE_COMMANDS=Json::array({
 {{"label","Show both 3D and 2D windows"},{"group","Workspace"},{"action","workspace.view.split"},{"keywords","side by side divide panels"}},
 {{"label","Maximize 3D garment window"},{"group","Workspace"},{"action","workspace.view.3d"},{"keywords","focus show 3d only"}},
 {{"label","Maximize 2D pattern window"},{"group","Workspace"},{"action","workspace.view.2d"},{"keywords","focus show 2d only"}},
 {{"label","Reset 3D and 2D divider"},{"group","Workspace"},{"action","workspace.view.reset"},{"keywords","equal fifty fifty split resize"}},
 {{"label","Show or hide Object Browser"},{"group","Workspace"},{"action","workspace.panel.objects"},{"keywords","inspector scene tree"}},
 {{"label","Show or hide asset Library"},{"group","Workspace"},{"action","workspace.panel.toggle-library"},{"keywords","sidebar expand collapse dock"}},
 {{"label","Show or hide Property Editor"},{"group","Workspace"},{"action","workspace.panel.toggle-inspector"},{"keywords","inspector dock sidebar properties"}},
 {{"label","Open Library panel"},{"group","Workspace"},{"action","workspace.panel.library"},{"keywords","browse asset sidebar"}},
 {{"label","Open History panel"},{"group","Workspace"},{"action","workspace.panel.history"},{"keywords","undo redo history sidebar"}}
});
namespace {
std::string lower(std::string s){std::transform(s.begin(),s.end(),s.begin(),[](unsigned char c){return char(std::tolower(c));});return s;}
std::string jsString(const Json& v){if(v.is_null())return "null";if(v.is_string())return v.get<std::string>();if(v.is_boolean())return v.get<bool>()?"true":"false";if(v.is_number())return v.dump();if(v.is_array()){std::string s;for(size_t i=0;i<v.size();i++){if(i)s+=",";if(!v[i].is_null())s+=jsString(v[i]);}return s;}return "[object Object]";}
std::string queryString(const Json& v){if(v.is_null()||v==false||v==0||v=="")return "";return jsString(v);}
bool whitespace(unsigned char c){return std::isspace(c)!=0;}
}
Json indexWorkspaceCommands(const Json& menus){
 Json result=Json::array();std::set<std::string> seen;
 if(!menus.is_array())return result;
 for(const auto& menu:menus){
  if(!menu.is_object())continue;
  const auto& entries=menu.contains("commands")?menu["commands"]:Json();
  if(!entries.is_array())continue;
  for(const auto& entry:entries){
   if(!entry.is_array()||entry.size()<2||!entry[1].is_string())continue;
   const std::string action=entry[1].get<std::string>();if(action.empty()||!seen.insert(action).second)continue;
   Json command={{"label",entry[0]},{"action",action},{"keywords",""}};
   if(menu.contains("title"))command["group"]=menu["title"];
   result.push_back(command);
  }
 }
 for(const auto& extra:EXTRA_WORKSPACE_COMMANDS)if(!seen.count(extra["action"].get<std::string>()))result.push_back(extra);
 return result;
}
Json searchWorkspaceCommands(const Json& commands,const Json& query,double maxResults){
 Json out=Json::array();if(!commands.is_array())return out;
 std::string text=lower(queryString(query));
 while(!text.empty()&&whitespace(text.front()))text.erase(text.begin());
 while(!text.empty()&&whitespace(text.back()))text.pop_back();
 std::vector<std::string> terms;std::string word;
 for(unsigned char ch:text){if(whitespace(ch)){if(!word.empty()){terms.push_back(word);word.clear();}}else word+=char(ch);}
 if(!word.empty())terms.push_back(word);
 struct Match {Json value;size_t pos;int score;};
 std::vector<Match> matches;
 for(size_t i=0;i<commands.size();++i){
  const auto& c=commands[i];if(!c.is_object()||!c.contains("label")||!c["label"].is_string()||!c.contains("group")||!c["group"].is_string())continue;
  std::string label=lower(c["label"].get<std::string>()), searchable=label+" "+lower(c["group"].get<std::string>())+" ";
  if(c.contains("keywords")&&!c["keywords"].is_null())searchable+=jsString(c["keywords"]);
  int score=0;bool ok=true;
  for(const auto& term:terms){if(searchable.find(term)==std::string::npos){ok=false;break;}score+=label.rfind(term,0)==0?10:label.find(term)!=std::string::npos?5:1;}
  if(!ok)continue;
  Json value=c;value["position"]=i;value["relevance"]=score;matches.push_back({std::move(value),i,score});
 }
 std::stable_sort(matches.begin(),matches.end(),[](const Match& a,const Match& b){return a.score>b.score;});
 // JS Array#slice(0, n) uses a negative end index relative to the array length.
 int count=std::isfinite(maxResults)?int(std::trunc(maxResults)):maxResults>0?int(matches.size()):0;
 if(count<0)count=std::max(0,int(matches.size())+count);
 count=std::min(count,int(matches.size()));
 for(int i=0;i<count;i++)out.push_back(matches[i].value);
 return out;
}
}
