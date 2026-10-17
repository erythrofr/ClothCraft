#include "../core/factory_zip.hpp"
#include <cassert>
#include <iostream>
#include <iterator>
#include <stdexcept>
using garment::FactoryZipEntry;
int main(int argc,char** argv) {
  const auto sample=garment::buildStoredZip({{"one.txt","123456789"},{"two/a.xml","<a/>"}});
  assert(sample.size()>100);
  assert(sample.substr(0,4)==std::string("PK\003\004",4));
  auto bad=[](const std::string& path) {
    try {garment::buildStoredZip({{path,"x"}});return false;}
    catch(const std::invalid_argument&) {return true;}
  };
  assert(bad("../secret") && bad("/absolute") && bad("a/../b") && bad("a\\b") && bad("a//b"));
  bool duplicate=false;
  try {garment::buildStoredZip({{"same","1"},{"same","2"}});}
  catch(const std::invalid_argument&) {duplicate=true;}
  assert(duplicate);
  if(argc>1 && std::string(argv[1])=="--fixture") {
    std::cout.write(sample.data(),static_cast<std::streamsize>(sample.size()));
  } else if(argc>1 && std::string(argv[1])=="--project") {
    std::string text((std::istreambuf_iterator<char>(std::cin)),{});
    garment::Document project(garment::Json::parse(text));
    const auto archive=garment::buildNativeFactoryZip(project);
    std::cout.write(archive.data(),static_cast<std::streamsize>(archive.size()));
  } else std::cout<<"PASS ZIP store CRC, path rejection and duplicate rejection\n";
}
