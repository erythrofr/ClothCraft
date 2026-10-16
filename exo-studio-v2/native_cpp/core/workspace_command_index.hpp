#pragma once
#include <nlohmann/json.hpp>
#include <string>
namespace garment::workspace_command_index {
using Json=nlohmann::json;
extern const Json EXTRA_WORKSPACE_COMMANDS;
Json indexWorkspaceCommands(const Json& menus);
Json searchWorkspaceCommands(const Json& commands,const Json& query=Json(""),double maxResults=30);
}
