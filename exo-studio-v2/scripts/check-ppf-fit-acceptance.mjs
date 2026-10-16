import assert from 'node:assert/strict'
import { evaluatePpfFitAcceptance } from '../ppf_backend/fitAcceptance.mjs'

const contact = {
  frames: 10, allFramesAvatarIntersectionFree: true,
  allFramesSelfIntersectionFree: true, allFramesWithinStrainLimit: true,
  perFrame: Array.from({length:10},(_,frame)=>({frame,
    avatarTriangleIntersectionPairs:0,clothSelfIntersectionPairs:0,
    maxPrincipalStretch:1.03,strainLimitViolatingFaces:0})),
}
const sewing = { finalMeanGapCm: 0.10, finalMaxGapCm: 0.35,
  stitchedPairs:98,framesAnalyzed:10,
  samples:Array.from({length:10},(_,frame)=>({frame,meanCm:.1,maxCm:.35})) }
const ipcCcd = { framesAudited: 10, allTestedStepsCollisionFree: true,
  steps: Array.from({ length: 9 }, (_,fromFrame) => ({ fromFrame,toFrame:fromFrame+1,collisionFree: true })) }

assert.equal(evaluatePpfFitAcceptance({ contact, sewing, requiresIpcCcd: true, ipcCcd }).accepted, true)
const clearance = {framesMeasured: 10, final: {frame:9, shoulder: {meanCm: 1.2, p90Cm: 2.5}, torso:{meanCm: 1.8}}}
assert.equal(evaluatePpfFitAcceptance({contact, sewing, requiresIpcCcd: true, ipcCcd, requiresShoulderFit: true}).accepted, false, 'Thomas shoulder clearance is required')
assert.equal(evaluatePpfFitAcceptance({contact, sewing, requiresIpcCcd: true, ipcCcd, requiresShoulderFit: true, clearance}).accepted, true)
assert.equal(evaluatePpfFitAcceptance({contact:{...contact,perFrame:contact.perFrame.map((row,i)=>i===4?{...row,avatarTriangleIntersectionPairs:2}:row)},sewing,requiresIpcCcd:true,ipcCcd}).accepted,false,
  'Real per-frame body crossings must override an incorrect allFramesIntersectionFree summary')
assert.equal(evaluatePpfFitAcceptance({contact:{...contact,perFrame:contact.perFrame.map((row,i)=>i===4?{...row,strainLimitViolatingFaces:1}:row)},sewing,requiresIpcCcd:true,ipcCcd}).accepted,false,
  'Real per-frame fabric stretch violations must override a summary flag')
assert.equal(evaluatePpfFitAcceptance({contact,sewing:{...sewing,finalMeanGapCm:.12},requiresIpcCcd:true,ipcCcd}).accepted,false,
  'A stale final seam summary must agree with the actual last PC2 sample')
assert.equal(evaluatePpfFitAcceptance({contact,sewing,requiresIpcCcd:true,ipcCcd,requiresShoulderFit:true,clearance:{...clearance,final:{...clearance.final,frame:3}}}).accepted,false,
  'Shoulder clearance must be measured on the final solver frame')
assert.equal(evaluatePpfFitAcceptance({ contact: {...contact,perFrame:contact.perFrame.slice(1)}, sewing, requiresIpcCcd: true, ipcCcd }).accepted, false,
  'Missing first contact frame must never count as accepted')
assert.equal(evaluatePpfFitAcceptance({ contact, sewing:{...sewing,samples:sewing.samples.slice(1)}, requiresIpcCcd: true, ipcCcd }).accepted, false,
  'Incomplete sewing trajectory must never count as accepted')
assert.equal(evaluatePpfFitAcceptance({ contact, sewing, requiresIpcCcd: true,
  ipcCcd:{...ipcCcd,steps:ipcCcd.steps.map((step,index)=>index===4?{...step,collisionFree:false}:step)} }).accepted, false,
  'Failed swept collision frame cannot be hidden by a true summary flag')
assert.equal(evaluatePpfFitAcceptance({ contact, sewing, requiresIpcCcd: true,
  ipcCcd:{...ipcCcd,steps:ipcCcd.steps.map((step,index)=>index===4?{...step,toFrame:9}:step)} }).accepted, false,
  'Skipped or duplicated IPC time intervals cannot be accepted')
assert.equal(evaluatePpfFitAcceptance({contact, sewing, requiresIpcCcd: true, ipcCcd, requiresShoulderFit: true, clearance: {...clearance, final: {...clearance.final, shoulder:{meanCm:3,p90Cm:6}}}}).accepted, false, 'Floating shoulders must reject a supposedly stable drape')
assert.equal(evaluatePpfFitAcceptance({ contact, sewing, requiresIpcCcd: true }).accepted, false, 'Thomas cannot pass without IPC')
assert.equal(evaluatePpfFitAcceptance({ contact, sewing, requiresIpcCcd: true, ipcCcd: { ...ipcCcd, allTestedStepsCollisionFree: false } }).accepted, false)
assert.equal(evaluatePpfFitAcceptance({ contact, sewing, requiresIpcCcd: true, ipcCcd: { ...ipcCcd, framesAudited: 4 } }).accepted, false)
assert.equal(evaluatePpfFitAcceptance({ contact: { ...contact, allFramesSelfIntersectionFree: false }, sewing, requiresIpcCcd: true, ipcCcd }).accepted, false)
assert.equal(evaluatePpfFitAcceptance({ contact: { ...contact, allFramesWithinStrainLimit: false }, sewing, requiresIpcCcd: true, ipcCcd }).accepted, false)
assert.equal(evaluatePpfFitAcceptance({ contact, sewing: { ...sewing, finalMeanGapCm: .4 }, requiresIpcCcd: true, ipcCcd }).accepted, false)
console.log(JSON.stringify({ pass: true, validated: 'all-frame IPC body CCD + static contact + strain + seam convergence' }))
