//! Standalone numerical contract: rustc --edition=2021 --test <this file> -o /tmp/hessian-contract && /tmp/hessian-contract --nocapture
//! Synthetic local quadratic energies only; no solver, hardware, or external crates.
type M = [[f64; 3]; 3];
type V = [f64; 3];
fn dot(a: V, b: V) -> f64 { (0..3).map(|i| a[i]*b[i]).sum() }
fn mv(a: M, v: V) -> V { std::array::from_fn(|i| dot(a[i],v)) }
fn det(a: M) -> f64 { a[0][0]*(a[1][1]*a[2][2]-a[1][2]*a[2][1])-a[0][1]*(a[1][0]*a[2][2]-a[1][2]*a[2][0])+a[0][2]*(a[1][0]*a[2][1]-a[1][1]*a[2][0]) }
fn solve(a: M, g: V) -> V {
    let d=det(a);
    assert!(d.is_finite() && d.abs()>1e-32);
    let mut result=[0.;3];
    for col in 0..3 { let mut replaced=a; for row in 0..3 { replaced[row][col]=-g[row]; } result[col]=det(replaced)/d; }
    result
}
fn shift(mut h:M,inertia:f64)->(M,f64) {
    let lower=(0..3).map(|i|h[i][i]-(0..3).filter(|&j|j!=i).map(|j|h[i][j].abs()).sum::<f64>()).fold(f64::INFINITY,f64::min);
    let amount=if lower<1e-8 {1e-8-lower+0.01*inertia} else {0.};
    for i in 0..3 {h[i][i]+=amount;} (h,amount)
}
fn energy(h:M,g:V,p:V)->f64 {dot(g,p)+0.5*dot(p,mv(h,p))}
fn search(h:M,g:V,delta:V,attempts:i32)->Option<(i32,f64)> {
    (0..attempts).find_map(|i|{let a=0.5_f64.powi(i);let e=energy(h,g,delta.map(|x|x*a));(e<=1e-14 && e.is_finite()).then_some((i,e))})
}
fn f32pack(h:M)->M {h.map(|row|row.map(|x|(x as f32) as f64))}
fn gpu_skips(h:M)->bool { // WGSL checks det<=1e-20, including all negative determinants.
    det(f32pack(h))<=1e-20
}
#[test]
fn near_singular_positive_matrix_skipped_by_gpu_but_regularized_step_descends() {
    let h=[[2e-8,0.,0.],[0.,2e-8,0.],[0.,0.,1e-10]];
    let g=[1e-6,-2e-6,0.5e-6];
    assert!(det(h)>0. && det(h)<1e-20 && gpu_skips(h));
    let (regularized,added)=shift(h,0.);
    assert!(added>0.);
    let direction=solve(regularized,g);
    assert!(dot(g,direction)<0. && dot(direction,mv(regularized,direction))>0.);
    let accepted=search(h,g,direction,10).expect("descent of unmodified objective");
    println!("small SPD det(f64)={:.8e} det(f32packed)={:.8e} shift={added:.8e} grad_dot_step={:.8e} accepted_attempt={} delta_E={:.8e}",det(h),det(f32pack(h)),dot(g,direction),accepted.0,accepted.1);
}
#[test]
fn indefinite_local_hessian_requires_positive_shift() {
    let h=[[1e-5,2e-5,0.],[2e-5,1e-5,0.],[0.,0.,1e-5]];
    let g=[1e-5,-1e-5,2e-6];
    assert!(det(h)<0. && gpu_skips(h));
    let (reg,amount)=shift(h,0.);
    let p=solve(reg,g);
    assert!(dot(g,p)<0. && dot(p,mv(reg,p))>0.);
    let accepted=search(h,g,p,10).expect("accepted on original indefinite objective");
    println!("indefinite det={:.8e} shift={amount:.8e} grad_dot_step={:.8e} accepted_attempt={} delta_E={:.8e}",det(h),dot(g,p),accepted.0,accepted.1);
}
#[test]
fn f32_packing_can_erase_small_positive_eigenvalue() {
    let h=[[1.,1.,0.],[1.,1.+1e-8,0.],[0.,0.,1e-8]];
    assert!(det(h)>0.);
    assert_eq!(det(f32pack(h)),0.);
    let (reg,_)=shift(h,1e-6);
    let g=[1e-4,-1e-4,2e-5];
    let p=solve(reg,g);
    assert!(dot(g,p)<0. && dot(p,mv(reg,p))>0.);
    let accepted=search(h,g,p,10).unwrap();
    println!("packing det(f64)={:.8e} det(f32packed)={:.8e} accepted_attempt={} delta_E={:.8e}",det(h),det(f32pack(h)),accepted.0,accepted.1);
}
#[test]
fn ten_vs_eight_is_a_policy_difference_without_claiming_specific_solver_failure() {
    // A bounded trial step may need alpha=1/256 (attempt 8), beyond GPU's eight trials.
    let h=[[1.,0.,0.],[0.,1.,0.],[0.,0.,1.]];
    let g=[-1.,0.,0.]; let oversized=[300.,0.,0.];
    assert!(search(h,g,oversized,8).is_none());
    assert_eq!(search(h,g,oversized,10).unwrap().0,8);
}
