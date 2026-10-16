// One authoritative working-action menu index shared between the React
// menubar, native AppKit dispatch, and the command finder/Node regression.
// An unsupported operation has a null action and is never searchable.
export const CLO_MENUS = [
  { title: 'File', commands: [['New garment', 'file.new'], ['Open garment…', 'file.open'], ['Save project', 'file.save'], ['Export garment…', 'file.export']] },
  { title: 'Edit', commands: [['Undo', 'edit.undo'], ['Redo', 'edit.redo'], ['Delete selected pattern', 'edit.delete']] },
  { title: '3D Garment', commands: [['Simulate / Pause', '3d.simulate'], ['Reset simulation', '3d.reset'], ['Select / Orbit', '3d.orbit'], ['Combined fabric transform gizmo', '3d.transform'], ['Move garment', '3d.move'], ['Rotate selected pattern', '3d.rotate'], ['Fabric hand', '3d.hand'], ['Fit 3D camera', '3d.camera'], ['Fit map', '3d.fit'], ['Show sewing lines', '3d.seams']] },
  { title: '2D Pattern', commands: [['Transform pattern', '2d.select'], ['Edit pattern points', '2d.points'], ['Split line', '2d.split'], ['Edit curve', '2d.curve'], ['Internal line / dart', '2d.internal'], ['Add notch', '2d.notch'], ['Manual cloth pin', '2d.pin'], ['Tape measure / ruler', '2d.measure'], ['Create mirrored pattern copy', '2d.mirror'], ['Add pattern', '2d.add']] },
  { title: 'Sewing', commands: [['Segment / free sewing', 'sewing.sew'], ['Inspect sewing', 'sewing.inspect'], ['Create fastener', 'sewing.fastener'], ['Show sewing lines', '3d.seams']] },
  { title: 'Materials', commands: [['Fabric browser', 'materials.fabric'], ['Edit fabric', 'materials.edit'], ['Add fabric', 'materials.add'], ['Graphic / texture', 'materials.graphic']] },
  { title: 'Editor', commands: [['Pattern editor', '2d.select'], ['Fabric editor', 'materials.fabric'], ['Production', 'workspace.production'], ['Scene hierarchy', 'object.scene'], ['Button browser', 'object.buttons'], ['Buttonhole browser', 'object.buttonholes'], ['Topstitch browser', 'object.topstitch'], ['Trims and zipper browser', 'object.trim'], ['Grading browser', 'object.grading'], ['Points of Measure browser', 'object.pom']] },
  { title: 'Avatar', commands: [['Avatar library', 'avatar.library'], ['Avatar properties', 'avatar.properties'], ['Import avatar…', 'avatar.import']] },
  { title: 'Animation', commands: [['Animation workspace · planned', null]] },
  { title: 'Render', commands: [['Render workspace', 'render.workspace'], ['Capture still', 'render.capture']] },
  { title: 'Display', commands: [['3D surface view', 'display.surface'], ['Wireframe', 'display.wireframe'], ['Stress / strain', 'display.strain'], ['2D grid', 'display.grid'], ['Sewing display', '3d.seams']] },
  { title: 'Preferences', commands: [['Workspace settings', 'settings.workspace'], ['Show / hide workspace tabs', 'settings.top-tabs'], ['Show both 3D and 2D windows', 'workspace.view.split'], ['Show 3D above 2D windows', 'workspace.view.stack'], ['Maximize 3D garment window', 'workspace.view.3d'], ['Maximize 2D pattern window', 'workspace.view.2d'], ['Reset 3D and 2D divider', 'workspace.view.reset'], ['Drafting layout', 'workspace.profile.drafting'], ['Sewing layout', 'workspace.profile.sewing'], ['Materials layout', 'workspace.profile.materials'], ['Rendering layout', 'workspace.profile.render'], ['Save custom layout', 'workspace.profile.save'], ['Restore custom layout', 'workspace.profile.restore'], ['Edit shortcuts · planned', null]] },
  { title: 'Settings', commands: [['Simulation quality', 'settings.simulation'], ['Fabric defaults', 'materials.fabric']] },
  { title: 'Help', commands: [['CLO-style control reference', 'help.reference'], ['Keyboard guide', 'help.shortcuts']] },
]
