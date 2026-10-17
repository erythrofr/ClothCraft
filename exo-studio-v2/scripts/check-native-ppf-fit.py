"""Exercise compiled C++ acceptance using real saved Metal output reports."""
import json
from pathlib import Path
import subprocess
root=Path(__file__).resolve().parents[1]
folder=root/'blender_bridge/output/ppf-fit-tuning-20261013'
names={'contact':'contact-report.json','sewing':'sewing-report.json','ipcCcd':'ipc-ccd.json','clearance':'clearance-report.json'}
evidence={key:json.loads((folder/name).read_text()) for key,name in names.items()}
evidence['strainLimitRatio']=.05
project=json.loads((root/'native_cpp/examples/sample-tee.json').read_text())
request={'protocol':'garment-studio.native-cad.v1','document':project,'op':'ppf-fit-evidence','args':evidence}
proc=subprocess.run([str(root/'native_cpp/build-cmake/garment_cad_cli')],input=json.dumps(request)+'\n',text=True,capture_output=True,check=True)
result=json.loads(proc.stdout)
assert result['ok'],result
fit=result['fitAcceptance']
assert fit['accepted'] is False,fit
assert fit['frames']==20,fit
assert any('frame 3' in message for message in fit['errors']),fit
assert any('seam closure' in message for message in fit['errors']),fit
assert any('CCD' in message or 'swept collision' in message for message in fit['errors']),fit
assert any('shoulder/torso' in message for message in fit['errors']),fit
print(json.dumps({'test':'real-Metal-trajectory-native-acceptance','ok':True,'source':str(folder),'fitAcceptance':fit},indent=2))
