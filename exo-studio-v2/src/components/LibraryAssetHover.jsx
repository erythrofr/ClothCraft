import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './LibraryAssetHover.css'

/**
 * One lazy, non-intercepting preview per hovered Library item. Existing tile
 * remains the interactive control; the visual portal never owns clicks.
 * Geometry/WebGL previews are mounted only after the user's hover delay.
 */
export default function LibraryAssetHover({category,id,title,description='',details=[],source='',preview,children}) {
  const garmentDisplay = category === 'Garment' || category === 'Patterns'
  const fabricDisplay = category === 'Fabric'
  const [open,setOpen]=useState(false)
  const [position,setPosition]=useState({left:12,top:12})
  const popupRef=useRef(null)
  const tileRef=useRef(null)
  const suppressFocus=useRef(false)
  const timer=useRef(null)
  const close=(delay=0)=>{
    clearTimeout(timer.current);timer.current=null
    if(delay)timer.current=window.setTimeout(()=>{
      if(!popupRef.current?.contains(document.activeElement))setOpen(false)
    },delay)
    else setOpen(false)
  }
  const visibleViewport=()=>{
    const viewport=window.visualViewport
    return {
      left:viewport?.offsetLeft ?? 0,
      top:viewport?.offsetTop ?? 0,
      width:viewport?.width ?? window.innerWidth,
      height:viewport?.height ?? window.innerHeight,
    }
  }
  const show=(target,delay=480)=>{
    clearTimeout(timer.current)
    tileRef.current=target
    const rect=target.getBoundingClientRect()
    const viewport=visibleViewport()
    const width=Math.min(garmentDisplay ? 760 : fabricDisplay ? 740 : 400,viewport.width-24)
    const beside=rect.right+14+width<viewport.left+viewport.width-12
    setPosition({
      left:beside?rect.right+14:Math.max(viewport.left+12,rect.left-width-14),
      top:Math.max(viewport.top+12,Math.min(rect.top,viewport.top+viewport.height-(garmentDisplay ? 625 : fabricDisplay ? 690 : 490))),
    })
    timer.current=window.setTimeout(()=>setOpen(true),delay)
  }
  useEffect(()=>()=>clearTimeout(timer.current),[])
  useEffect(()=>{
    const dismiss=event=>{
      // Scrolling inside the card's details should not dismiss it.
      if(popupRef.current?.contains(event?.target))return
      close()
    }
    window.addEventListener('scroll',dismiss,true)
    window.addEventListener('resize',dismiss)
    const escape=event=>{
      if(event.key!=='Escape'||!popupRef.current?.contains(document.activeElement))return
      event.preventDefault()
      close()
      suppressFocus.current=true
      tileRef.current?.focus({preventScroll:true})
    }
    document.addEventListener('keydown',escape)
    return()=>{window.removeEventListener('scroll',dismiss,true);window.removeEventListener('resize',dismiss);document.removeEventListener('keydown',escape)}
  },[])
  useEffect(()=>{
    if(!open)return
    let handle
    const fit=()=>{
      const bounds=popupRef.current?.getBoundingClientRect()
      if(!bounds)return
      const viewport=visibleViewport()
      setPosition(value=>({
        left:Math.max(viewport.left+12,Math.min(value.left,viewport.left+viewport.width-bounds.width-12)),
        top:Math.max(viewport.top+12,Math.min(value.top,viewport.top+viewport.height-bounds.height-12)),
      }))
    }
    handle=requestAnimationFrame(fit)
    // An image, font or delayed WebGL asset can change preview height after it
    // opens. Keep the enlarged card entirely on screen as its media settles.
    const observer=typeof ResizeObserver!=='undefined' ? new ResizeObserver(fit) : null
    if(popupRef.current)observer?.observe(popupRef.current)
    window.visualViewport?.addEventListener('resize',fit)
    window.visualViewport?.addEventListener('scroll',fit)
    return()=>{
      cancelAnimationFrame(handle)
      observer?.disconnect()
      window.visualViewport?.removeEventListener('resize',fit)
      window.visualViewport?.removeEventListener('scroll',fit)
    }
  },[open])
  const child=React.Children.only(children)
  const tile=React.cloneElement(child,{
    'data-library-hover-id':`${category}:${id}`,
    'aria-description':garmentDisplay
      ? 'Tap the preview label to inspect without applying. Activate the rest of the tile to load the garment.'
      : child.props['aria-description'],
    onPointerEnter:e=>{child.props.onPointerEnter?.(e);if(e.pointerType==='mouse'||e.pointerType==='pen')show(e.currentTarget)},
    onPointerLeave:e=>{child.props.onPointerLeave?.(e);close(170)},
    onFocus:e=>{
      child.props.onFocus?.(e)
      if(suppressFocus.current){suppressFocus.current=false;return}
      if(garmentDisplay||e.currentTarget.matches(':focus-visible'))show(e.currentTarget,0)
    },
    onBlur:e=>{
      child.props.onBlur?.(e)
      if(!popupRef.current?.contains(e.relatedTarget))close()
    },
    onKeyDown:e=>{
      child.props.onKeyDown?.(e)
      if(e.defaultPrevented)return
      if(e.key==='Escape'&&open){e.preventDefault();close();return}
      if(e.key==='Tab'&&!e.shiftKey&&open&&garmentDisplay){
        const control=popupRef.current?.querySelector('button:not([disabled])')
        if(control){e.preventDefault();control.focus()}
      }
    },
    onClick:e=>{
      if(garmentDisplay&&e.target?.closest?.('[data-library-preview-touch]')){
        e.preventDefault()
        e.stopPropagation()
        show(e.currentTarget,0)
        return
      }
      close()
      child.props.onClick?.(e)
    },
    ...(garmentDisplay?{
      children:<>{child.props.children}<span className="exo-library-preview-touch-hint" data-library-preview-touch aria-hidden="true">PREVIEW 3D ↗</span></>,
    }:{}),
  })
  return <>
    {tile}
    {open && createPortal(<aside ref={popupRef} onPointerEnter={()=>clearTimeout(timer.current)}
      onPointerLeave={()=>{if(!popupRef.current?.contains(document.activeElement))close(170)}}
      onBlurCapture={event=>{
        if(!event.currentTarget.contains(event.relatedTarget) && event.relatedTarget!==tileRef.current)close()
      }}
      onKeyDown={event=>{
        if(event.key==='Tab'&&event.shiftKey&&event.target===popupRef.current?.querySelector('button:not([disabled])')){
          event.preventDefault()
          tileRef.current?.focus({preventScroll:true})
        }
      }} role="dialog" aria-modal="false" className={`exo-library-asset-hover ${garmentDisplay ? 'exo-library-asset-hover--garment' : fabricDisplay ? 'exo-library-asset-hover--fabric' : ''}`} data-library-preview={`${category}:${id}`} aria-label={`${title} enlarged preview`} style={position}>
      <div className="exo-library-asset-hover-media">{preview || <div className="exo-library-asset-hover-unavailable">No preview available</div>}</div>
      <div className="exo-library-asset-hover-information">
        <span className="exo-library-asset-hover-eyebrow">{category.toUpperCase()} · LIBRARY PREVIEW</span>
        <strong>{title}</strong>
        {description && <p>{description}</p>}
        {details.length>0 && <dl>{details.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{String(value??'—')}</dd></div>)}</dl>}
        {source&&<small>{source}</small>}
      </div>
    </aside>,document.body)}
  </>
}
