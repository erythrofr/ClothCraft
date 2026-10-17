// Maximum principal engineering extension from the actual triangle deformation
// gradient (metre rest UV -> metre world positions). Not stress or pressure.
export function triangleExtension(uv,world) {
 const [a,b,c]=uv,[x,y,z]=world
 if(!a||!b||!c||!x||!y||!z)return 0
 const u=b[0]-a[0],v=b[1]-a[1],s=c[0]-a[0],t=c[1]-a[1],det=u*t-s*v
 if(Math.abs(det)<1e-14)return 0
 const f=x.map((_,i)=>((y[i]-x[i])*t-(z[i]-x[i])*v)/det)
 const g=x.map((_,i)=>(-(y[i]-x[i])*s+(z[i]-x[i])*u)/det)
 const dot=(p,q)=>p.reduce((sum,n,i)=>sum+n*q[i],0)
 const aa=dot(f,f),bb=dot(g,g),ab=dot(f,g)
 return Math.sqrt(Math.max(0,(aa+bb+Math.hypot(aa-bb,2*ab))/2))-1
}
export function vertexExtensions(snapshot) {
 const sums=new Float64Array(snapshot.positions.length),counts=new Uint32Array(sums.length)
 for(const tri of snapshot.triangles){
  const value=triangleExtension(tri.map(i=>snapshot.uv[i]),tri.map(i=>snapshot.positions[i]))
  for(const i of tri){sums[i]+=value;counts[i]++}
 }
 return Array.from(sums,(sum,i)=>counts[i]?sum/counts[i]:0)
}
