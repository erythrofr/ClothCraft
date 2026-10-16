import React, { useState } from 'react'
import { ChevronDown, ChevronRight, ListTree } from 'lucide-react'
import CadToolIcon from './CadToolIcon.jsx'
import './PropertyCategoryNavigator.css'

const GROUPS = [
  { title: '2D Pattern', icon: 'pattern-properties', children: [['Pattern Pieces','Pattern','Scene'], ['Grading / Measurement','Production','Grading']] },
  { title: 'Sewing', icon: 'sew', children: [['Sewing & Seams','Sewing','Scene'], ['Button / Hardware','Sewing','Button'], ['Buttonhole','Sewing','Buttonhole'], ['Topstitch / Trims','Sewing','Topstitch']] },
  { title: '3D Form', icon: 'select-3d', children: [['3D Arrangement','Pattern','Scene'], ['Avatar','Avatar','Scene'], ['Drape / Fitting','Fit','Scene']] },
  { title: 'Material', icon: 'fabric', children: [['Fabric Editor','Fabric','Fabric'], ['Graphics & Texture','Fabric','Graphic'], ['Trims','Sewing','Trim']] },
  { title: 'Environment', icon: 'render', children: [['Stage / Lighting','Render','Scene'], ['Render Settings','Render','Scene']] },
]

export default function PropertyCategoryNavigator({ activeSection, setActiveSection, setObjectTab, onRevealBrowser }) {
  const [expanded, setExpanded] = useState('2D Pattern')
  const [visible, setVisible] = useState(true)
  const select = (section, tab) => {
    setActiveSection(section)
    if (tab) { setObjectTab(tab); onRevealBrowser?.() }
  }
  return <nav className="clo-property-category-nav" aria-label="CLO-style property categories">
    <button className="clo-property-category-list-toggle" type="button" aria-expanded={visible} title="Show / hide property categories" onClick={() => setVisible(value => !value)}>
      <ListTree size={17}/><span>PROPERTY CATEGORIES</span>{visible ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
    </button>
    {visible && <div className="clo-property-category-groups">
      {GROUPS.map(group => <div className="clo-property-category-group" key={group.title}>
        <button type="button" className={`clo-property-category-group-trigger ${expanded === group.title ? 'expanded' : ''}`} aria-expanded={expanded === group.title} onClick={() => setExpanded(expanded === group.title ? '' : group.title)}>
          {expanded === group.title ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
          <CadToolIcon id={group.icon} size={17}/>
          <span>{group.title}</span>
        </button>
        {expanded === group.title && <div className="clo-property-category-options">
          {group.children.map(([label, section, tab]) => <button type="button" key={label} className={section === activeSection ? 'active' : ''} onClick={() => select(section, tab)}>{label}</button>)}
        </div>}
      </div>)}
    </div>}
  </nav>
}
