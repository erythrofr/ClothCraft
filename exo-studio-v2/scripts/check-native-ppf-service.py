"""Read-only integration test against the actual local PPF service."""
import json
from pathlib import Path
import subprocess
root=Path(__file__).resolve().parents[1]
project=json.loads((root/'native_cpp/examples/sample-tee.json').read_text())
requests=[{'protocol':'garment-studio.native-cad.v1','document':project,'op':'ppf-health'},
          {'protocol':'garment-studio.native-cad.v1','document':project,'op':'ppf-job','args':{'id':'../health'}}]
proc=subprocess.run([str(root/'native_cpp/build-cmake/garment_cad_cli')],input=''.join(json.dumps(r)+'\n' for r in requests),text=True,capture_output=True,check=True)
health,bad=map(json.loads,proc.stdout.splitlines())
assert health['ok'],health
assert health['service']['backendId']=='ppf-metal-final',health
assert isinstance(health['service']['ready'],bool),health
assert isinstance(health['service']['busy'],bool),health
assert bad['ok'] is False and 'Invalid PPF job ID' in bad['error'],bad
request={'protocol':'garment-studio.native-cad.v1','document':project,'op':'ppf-jobs'}
proc=subprocess.run([str(root/'native_cpp/build-cmake/garment_cad_cli')],input=json.dumps(request)+'\n',text=True,capture_output=True,check=True)
listed=json.loads(proc.stdout)
assert listed['ok'],listed
failed=next((j for j in listed['jobs']['jobs'] if j['status']=='error'),None)
preview_rejected=None
if failed:
    request.update(op='ppf-preview',args={'id':failed['id']})
    proc=subprocess.run([str(root/'native_cpp/build-cmake/garment_cad_cli')],input=json.dumps(request)+'\n',text=True,capture_output=True,check=True)
    preview=json.loads(proc.stdout)
    assert preview['ok'] is False and '409' in preview['error'],preview
    preview_rejected=True
print(json.dumps({'ok':True,'nativeCppToRealPpfService':True,'health':health['service'],
                  'invalidJobIdRejected':True,'failedJobPreviewRejected':preview_rejected,'jobSubmitted':False,'physicalFitVerified':False},indent=2))
