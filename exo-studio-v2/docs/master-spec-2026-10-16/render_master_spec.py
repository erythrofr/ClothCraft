#!/usr/bin/env python3
"""Rebuild, paginate, bookmark, and validate EXO's long-form master spec."""
from pathlib import Path
import json
import os
import re
import statistics
import subprocess
import sys
import fitz

HERE=Path(__file__).resolve().parent
QA=HERE/'qa'
QA.mkdir(exist_ok=True)
PREFIX='EXO_CLO_REBUILD_COMPLETION_MASTER_SPEC_2026-10-16'
HTML=HERE/(PREFIX+'.html')
PDF=HERE/(PREFIX+'.pdf')
DOCX=HERE/(PREFIX+'.docx')
ANNEXES=[
 'GARMENT_STUDIO_COMPLETE_CLO3D_PARITY_MASTER_PLAN_2026-10-13.md',
 'EXO_MASTER_ROADMAP.md',
 'CLO3D_NON_SIMULATION_FULL_BUILD_AUDIT_2026-10-13.md',
 'CLO3D_PROPERTY_EDITOR_DEEP_AUDIT_20261016.md',
 'CLO7_LIVE_PROPERTY_EDITOR_AUDIT_20261016.md',
 'EXO_400_FABRIC_LIBRARY_AND_WASH_SYSTEM.md',
 'FABRIC_PHYSICS_AND_CLO_RESEARCH_2026-10-16.md',
 'EXO_PPF_MATERIALS_IMMERSIVE_STUDIOS_FUTURE_ARCHITECTURE_2026-10-16.md',
 'EXO_ECOSYSTEM_MASTER_IMPLEMENTATION_PROGRAM_2026-10-16.md',
 'EXO_INTERACTIVE_WEB_TECHPACK_PLANNING_2026-10-16.md',
 'EXO_COMMUNITY_MARKETPLACE_SOCIAL_COLLABORATION_ARCHITECTURE_2026-10-16.md',
]

def run(args,timeout):
    result=subprocess.run(args,capture_output=True,text=True,timeout=timeout)
    if result.returncode:
        raise RuntimeError(f'{args[0]} failed ({result.returncode}): {result.stderr[-1200:]}')

run([sys.executable,str(HERE/'build_master_spec.py')],45)
CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
run([CHROME,'--headless=new','--disable-gpu','--no-first-run','--no-pdf-header-footer',f'--print-to-pdf={PDF}',HTML.as_uri()],240)
run(['textutil','-convert','docx','-output',str(DOCX),str(HTML)],180)
manifest=json.loads((HERE/'manifest.json').read_text())
with fitz.open(PDF) as doc:
    headers=[re.sub(r'\s+','',page.get_text()[:1300]).upper() for page in doc]
    toc=[[1,'EXO complete engineering specification',1]]
    unmatched=[]
    for code,title in manifest['specifications']:
        pages=[i+1 for i,header in enumerate(headers) if code.upper() in header]
        if pages:toc.append([2,code+' '+title,pages[0]])
        else:unmatched.append(code)
    for i,name in enumerate(ANNEXES,1):
        needle=re.sub(r'\s+','',f'SOURCE ANNEX {i:02}').upper()
        pages=[j+1 for j,header in enumerate(headers) if needle in header]
        if pages:toc.append([1,f'Annex {i:02}: '+name,pages[0]])
    doc.set_toc(toc)
    tmp=HERE/'_bookmarked.pdf'
    doc.save(tmp,garbage=3,deflate=True)
os.replace(tmp,PDF)
with fitz.open(PDF) as doc:
    words=[len(page.get_text().split()) for page in doc]
    first_last=['THE REMAINING','revisions','Manufacturing']
    assert len(doc)>=150,'PDF page count below user requested 150-page target'
    assert len(unmatched)==0,f'Missing specification bookmarks: {unmatched}'
    assert len(doc.get_toc())>=len(manifest['specifications'])
    assert DOCX.exists() and DOCX.stat().st_size>200000
    for n in [1,2,10,80,155,200,len(doc)]:
        if n<=len(doc):doc[n-1].get_pixmap(matrix=fitz.Matrix(1.15,1.15),alpha=False).save(QA/f'final-qa-{n}.png')
    validation={
        'pdfPages':len(doc),
        'pdfTotalWords':sum(words),
        'pdfMedianWordsPerPage':int(statistics.median(words)),
        'pagesUnder100Words':[(i+1,n) for i,n in enumerate(words) if n<100],
        'specificationsIndexed':len(manifest['specifications']),
        'bookmarkCount':len(doc.get_toc()),
        'missingSpecificationIDs':unmatched,
        'pdfBytes':PDF.stat().st_size,
        'docxBytes':DOCX.stat().st_size,
    }
(HERE/'render-validation.json').write_text(json.dumps(validation,indent=2)+'\n')
print(json.dumps(validation,indent=2))
