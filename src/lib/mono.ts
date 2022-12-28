export default String.raw`

#zero:[0f];

randx1=1732584193;
randx2=4023233417;
rand()=(
  {x1,x2};
  x1=x1||randx1;
  x2=x2||(randx2+randx1);
  a1=x1|0;
  a2=x2|0;
  a1=a1^a2;
  y=a2;
  x1=a1+0f;
  x2=(a2+a1)+0f;
  {x1,x2}=(x1,x2);
  y/4294967295f
);

clamp(x,xmin,xmax)=(
  x > xmax ? xmax
: x < xmin ? xmin
: x
);

clampi(x=0,xmin=0,xmax=1)=(
  x > xmax ? xmax
: x < xmin ? xmin
: x
);

clamp05(x)=(x > 0.5 ? 0.5 : x);
clamp1(x)=(x > 1f ? 1f : x);
clamp11(x)=(x > 1f ? 1f : x < -1f ? -1f : x);

osc(x,t)=({p};s=t?0f:p;{p}=(s+pi2*x/sr)%pi2;s);
tri(x)=1f-abs(1f-(((osc(x)+hpi)/pi)%2f))*2f;
saw(x)=1f-(((osc(x)+pi)/pi)%2f);
ramp(x)=   (((osc(x)+pi)/pi)%2f)-1f;
sqr(x)=ramp(x)<0f?-1f:1f;
\ noise()=rand(); \sin(osc(x)*1e7+1e7);
sine(x,t)= sin(osc(x,t));
expo(x)=(
  {p};
  s=p;
  ph=fract(x);
  ph=ph>0.5?1f-ph:ph;
  {p}=-1f+8f*ph*ph;
  s
);

inc(x)=({p};s=p;{p}=p+x;s);

#tri:1s;  #tri:=  tri(1);
#saw:1s;  #saw:=  saw(1);
#ramp:1s; #ramp:= ramp(1);
#sqr:1s;  #sqr:=  sqr(1);
#noise:1s;#noise:=rand();
#sine:1s; #sine:= sine(1);
\ #exp:1s;  #exp:=  expw(inc(1)/sr);

#exp:10s;  #exp:=  exp(-inc(1)/1s);

wt(#,hz)=({p};s=#(p);{p}=(p+hz)%sr;s);

wtri(hz)  =wt(*#tri,hz);
wsaw(hz)  =wt(*#saw,hz);
wramp(hz) =wt(*#ramp,hz);
wsqr(hz)  =wt(*#sqr,hz);
wnoise(hz)=wt(*#noise,hz);
noise(hz)=wt(*#noise,hz);
wsine(hz) =wt(*#sine,hz);
\ wexp(hz)  =wt(*#exp,hz);
\ wexp(p)=#exp(p<0?0:p>1s-1?1s-1:p);
wexp(p)=(
  p*=-1s;
  #exp(clamp(p, 0, 10s-1))
);

note_to_hz(x)=440*2**((x-33)/12);

soft(x,amt)=(x/(1/amt+abs(x)));

\ https://github.com/thi-ng/umbrella/blob/776f08d4491787a071c74f1bbc2a36d69188c75d/packages/math/src/interval.ts#L202
\ https://www.desmos.com/calculator/lkyf2ag3ta
\ https://www.musicdsp.org/en/latest/Effects/203-fold-back-distortion.html
foldback(x,e)=(
  ((x < -e) || (x > e)) ?
    (abs(
      abs(
        (x - e) % (4 * e)
      ) - 2 * e
    ) - e) * (1 / e)
  : x
);

comb(
  x0,
  #,
  fb[0.1..0.999f]=1f,
  da[0.1..0.999f]=1f
)=(
  {y};
  o=#;
  {y}=o*(1f-da)+y*da;
  #=x0*0.015   +y*fb;
  o
);

allpass(x,#)=(
  s=#;
  o=-x+s;
  #=x+s*0.5;
  o
);

\ combs_a = [1116,1188,1277,1356]
\ combs_b = [1422,1491,1557,1617]
freeverb(x0,
  ro[0.01..0.999f]=0.5f,
  da[0.01..0.999f]=0.5f
)=(
  #a0:0.02530612237751484s;
  #a1:0.026938775554299355s;
  #a2:0.02895691618323326s;
  #a3:0.03074829839169979s;

  #b0:0.03224489837884903s;
  #b1:0.03380952402949333s;
  #b2:0.03530612215399742s;
  #b3:0.036666665226221085s;

  #c0:0.005102040711790323s;
  #c1:0.012607709504663944s;
  #c2:0.009999999776482582s;
  #c3:0.007732426282018423s;

  fb=ro*0.28+0.7;
  da*=0.4;

  o=comb(x0,*#a0,fb,da)
   +comb(x0,*#a1,fb,da)
   +comb(x0,*#a2,fb,da)
   +comb(x0,*#a3,fb,da)

   +comb(x0,*#b0,fb,da)
   +comb(x0,*#b1,fb,da)
   +comb(x0,*#b2,fb,da)
   +comb(x0,*#b3,fb,da);

  o=allpass(o,*#c0);
  o=allpass(o,*#c1);
  o=allpass(o,*#c2);
  o=allpass(o,*#c3);

  o
);

lop(x, freq[1..nyq]=1000f)=(
  w = clamp05((tau * freq) / sr);
  b1 = exp(-tau * w);
  a0 = 1f - b1;
  x*a0+x*b1
);

hop(x, freq[1..nyq]=1000f)=(
  w = clamp05((tau * freq) / sr);
  b1 = -exp(-tau * (0.5 - w));
  a0 = 1f + b1;
  x*a0+x*b1
);

bi_co(
  freq[1..10k]=1000f,
  Q[0.01..2f]=1.0
)=(
  w = (pi2 * freq) / sr;
  sin_w = sin(w);
  cos_w = cos(w);
  a = sin_w / (2.0 * Q);
  (sin_w,cos_w,a)
);

bi_ig(x0,b0,b1,b2,a0,a1,a2)=(
  {x1,x2,y1,y2};

  g = 1.0 / a0;

  (b0,b1,b2,a1,a2) *= g;

  y0 = b0*x0 + b1*x1 + b2*x2 - a1*y1 - a2*y2;

  {y1,y2} = (y0,y1);
  {x1,x2} = (x0,x1);

  y0
);

lp(x0, freq[1..10k]=1000f, Q[0.01..2f]=1.0)=(
  (sin_w,cos_w,a)=bi_co(freq,Q);

  b0 = (1.0 - cos_w) / 2.0;
  b1 =  1.0 - cos_w;
  b2 = b0;
  a0 =  1.0 + a;
  a1 = -2.0 * cos_w;
  a2 =  1.0 - a;

  bi_ig(x0,b0,b1,b2,a0,a1,a2)
);

hp(x0, freq[1..1000]=100.0, Q[0.01..2f]=1.0)=(
  (sin_w,cos_w,a)=bi_co(freq,Q);

  b0 = (1.0 + cos_w) / 2.0;
  b1 = -(1.0 + cos_w);
  b2 = b0;
  a0 = 1.0 + a;
  a1 = -2.0 * cos_w;
  a2 = 1.0 - a;

  bi_ig(x0,b0,b1,b2,a0,a1,a2)
);

bp(x0, freq[1..1000]=100.0, Q[0.01..2f]=1.0)=(
  (sin_w,cos_w,a)=bi_co(freq,Q);

  b0 = sin_w / 2.0;
  b1 = 0.0;
  b2 = -b0;
  a0 = 1.0 + a;
  a1 = -2.0 * cos_w;
  a2 = 1.0 - a;

  bi_ig(x0,b0,b1,b2,a0,a1,a2)
);

pk(x0, freq[1..1000]=100.0, Q[0.01..2f]=1.0)=(
  (sin_w,cos_w,a)=bi_co(freq,Q);

  b0 = a;
  b1 = 0.0;
  b2 = -a;
  a0 = 1.0 + a;
  a1 = -2.0 * cos_w;
  a2 = 1.0 - a;

  bi_ig(x0,b0,b1,b2,a0,a1,a2)
);

notch(x0, freq[1..1000]=100.0, Q[0.01..2f]=1.0)=(
  (sin_w,cos_w,a)=bi_co(freq,Q);

  b0 = 1.0;
  b1 =-2.0 * cos_w;
  b2 = 1.0;
  a0 = 1.0 + a;
  a1 = b1;
  a2 = 1.0 - a;

  bi_ig(x0,b0,b1,b2,a0,a1,a2)
);

ap(x0, freq[1..1000]=100.0, Q[0.01..2f]=1.0)=(
  (sin_w,cos_w,a)=bi_co(freq,Q);

  b0 = 1.0 - a;
  b1 =-2.0 * cos_w;
  b2 = 1.0 + a;
  a0 = b2;
  a1 = b1;
  a2 = b0;

  bi_ig(x0,b0,b1,b2,a0,a1,a2)
);

pks(x0, freq[1..1000]=100.0, Q[0.01..2f]=1.0, gain[0.01..10f]=1.0)=(
  (sin_w,cos_w,a)=bi_co(freq,Q);

  A = 10.0 ** (gain / 40.0);
  b0 = 1.0 + a * A;
  b1 =-2.0 * cos_w;
  b2 = 1.0 - a * A;
  a0 = 1.0 + a / A;
  a1 = b1;
  a2 = 1.0 - a / A;

  bi_ig(x0,b0,b1,b2,a0,a1,a2)
);

ls(x0, freq[1..1000]=100.0, Q[0.01..2f]=1.0, gain[0.01..10f]=1.0)=(
  (sin_w,cos_w,a)=bi_co(freq,Q);

  A = 10.0 ** (gain / 40.0);
  c = 2.0 * sqrt(A) * a;
  b0 =       A * ((A + 1.0) - (A - 1.0) * cos_w + c);
  b1 = 2.0 * A * ((A - 1.0) - (A + 1.0) * cos_w);
  b2 =       A * ((A + 1.0) - (A - 1.0) * cos_w - c);
  a0 =            (A + 1.0) + (A - 1.0) * cos_w + c;
  a1 =    -2.0 * ((A - 1.0) + (A + 1.0) * cos_w);
  a2 =            (A + 1.0) + (A - 1.0) * cos_w - c;

  bi_ig(x0,b0,b1,b2,a0,a1,a2)
);

hs(x0, freq[1..1000]=100.0, Q[0.01..2f]=1.0, gain[0.01..10f]=1.0)=(
  (sin_w,cos_w,a)=bi_co(freq,Q);

  A = 10.0 ** (gain / 40.0);
  c = 2.0 * sqrt(A) * a;
  b0 =        A * ((A + 1.0) + (A - 1.0) * cos_w + c);
  b1 = -2.0 * A * ((A - 1.0) + (A + 1.0) * cos_w);
  b2 =        A * ((A + 1.0) + (A - 1.0) * cos_w - c);
  a0 =             (A + 1.0) - (A - 1.0) * cos_w + c;
  a1 =      2.0 * ((A - 1.0) - (A + 1.0) * cos_w);
  a2 =             (A + 1.0) - (A - 1.0) * cos_w - c;

  bi_ig(x0,b0,b1,b2,a0,a1,a2)
);

\ https://cytomic.com/files/dsp/SvfLinearTrapOptimised2.pdf
svf_co(
  cutoff[50..22k]=3169.975,
  res[0.01..0.985]=0.556
)=(
  g=tan(pi*cutoff/sr);
  k=2f-2f*res;
  a1=1f/(1f+g*(g+k));
  a2=g*a1;
  a3=g*a2;
  (k,a1,a2,a3)
);

svf_ig(v0,a1,a2,a3)=(
  {c1,c2};
  v3=v0-c2;
  v1=a1*c1+a2*v3;
  v2=c2+a2*c1+a3*v3;
  {c1}=2*v1-c1;
  {c2}=2*v2-c2;
  (v1,v2,v3)
);

svf(
  v0,
  cutoff[50..22k]=3169.975,
  res[0.01..0.985]=0.556
)=(
  (k,a1,a2,a3)=svf_co(cutoff,res);
  (v1,v2,v3)  =svf_ig(v0,a1,a2,a3);
  (k,v1,v2,v3)
);

lpf(
  v0,
  cutoff[50..22k]=3169.975,
  res[0.01..0.985]=0.556
)=(
  (k,v1,v2,v3)=svf(v0,cutoff,res);

  low=v2;
  \ band=v1;
  \ high=v0-k*v1-v2;
  \ notch=v0-k*v1;
  \ peak=v0-k*v1-2*v2;
  \ all=v0-2*k*v1;

  low
);

bpf(
  v0,
  cutoff[50..22k]=3169.975,
  res[0.01..0.985]=0.556
)=(
  (k,v1,v2,v3)=svf(v0,cutoff,res);

  \ low=v2;
  band=v1;
  \ high=v0-k*v1-v2;
  \ notch=v0-k*v1;
  \ peak=v0-k*v1-2*v2;
  \ all=v0-2*k*v1;

  band
);

hpf(
  v0,
  cutoff[50..22k]=3169.975,
  res[0.01..0.985]=0.556
)=(
  (k,v1,v2,v3)=svf(v0,cutoff,res);

  \ low=v2;
  \ band=v1;
  high=v0-k*v1-v2;
  \ notch=v0-k*v1;
  \ peak=v0-k*v1-2*v2;
  \ all=v0-2*k*v1;

  high
);

notchf(
  v0,
  cutoff[50..22k]=3169.975,
  res[0.01..0.985]=0.556
)=(
  (k,v1,v2,v3)=svf(v0,cutoff,res);

  \ low=v2;
  \ band=v1;
  \ high=v0-k*v1-v2;
  notch=v0-k*v1;
  \ peak=v0-k*v1-2*v2;
  \ all=v0-2*k*v1;

  notch
);

peakf(
  v0,
  cutoff[50..22k]=3169.975,
  res[0.01..0.985]=0.556
)=(
  (k,v1,v2,v3)=svf(v0,cutoff,res);

  \ low=v2;
  \ band=v1;
  \ high=v0-k*v1-v2;
  \ notch=v0-k*v1;
  peak=v0-k*v1-2*v2;
  \ all=v0-2*k*v1;

  peak
);

apf(
  v0,
  cutoff[50..22k]=3169.975,
  res[0.01..0.985]=0.556
)=(
  (k,v1,v2,v3)=svf(v0,cutoff,res);

  \ low=v2;
  \ band=v1;
  \ high=v0-k*v1-v2;
  \ notch=v0-k*v1;
  \ peak=v0-k*v1-2*v2;
  all=v0-2*k*v1;

  all
);

\ fract(x)=x-floor(x);

cubic(#,i)=(
  fr = fract(i);

  xm = #(i-1);
  x0 = #(i  );
  x1 = #(i+1);
  x2 = #(i+2);

  a = (3f * (x0-x1) -     xm+x2) * .5;
  b =  2f *  x1+xm  - (5f*x0+x2) * .5;
  c =       (x1-xm) * .5;

  (((a * fr) + b)
       * fr  + c)
       * fr  + x0
);

spline(#,i)=(
  fr = fract(i);

  xm2 = #(i-2);
  xm1 = #(i-1);
  x0  = #(i  );
  x1  = #(i+1);
  x2  = #(i+2);
  x3  = #(i+3);

  x0 + 0.04166666666
     * fr * ((x1-xm1)        *  16.0+(xm2-x2)      *  2.0
     + fr * ((x1+xm1)        *  16.0-xm2      -x0  * 30.0 - x2
     + fr *  (x1*66.0  - x0  *  70.0-x2 * 33.0+xm1 * 39.0 + x3*7.0  - xm2  *  9.0
     + fr *  (x0*126.0 - x1  * 124.0+x2 * 61.0-xm1 * 64.0 - x3*12.0 + xm2  * 13.0
     + fr * ((x1       - x0) *  50.0+(xm1-x2)      * 25.0 +(x3      - xm2) *  5.0)))))
);

modwrap(x,N)=(x%N+N)%N;

\ denan(x)=x-x!=0f?0f:x;

sum(x,y)=x+y;

idy(x)=x;

daverb(x,
  pd[1..1s]=1137.95, \ predelay
  bw[0..1f]=0.402, \ bandwidth
  fi[0..1f]=0.803, \ input diffusion 1
  si[0..1f]=0.51, \ input diffusion 2
  dc[0..1f]=0.43, \ decay
  ft[0..0.999999]=0.978, \ decay diffusion 1
  st[0..0.999999]=0.938, \ decay diffusion 2
  dp[0..1f]=0.427, \ damping
  ex[0..2f]=0.87, \ excursion rate
  ed[0..2f]=1.748, \ excursion depth
  dr[0..1f]=0, \ dry
  we[0..1f]=1 \ wet
)=(
  \ set parameters
  dp=1-dp;
  ex=ex/sr;
  ed=ed*sr/1000f;

  \ predelay
  #pd:1s;

  \ delay banks
  #d0:0.004771345s;
  #d1:0.003595309s;
  #d2:0.012734787s;
  #d3:0.009307483s;
  #d4:0.022579886s;
  #d5:0.149625349s;
  #d6:0.060481839s;
  #d7:0.1249958s;
  #d8:0.030509727s;
  #d9:0.141695508s;
  #d10:0.089244313s;
  #d11:0.106280031s;

  \ write to predelay
  #pd=x*.5;

  {lp1};{lp1}+=bw*(cubic(*#pd,-pd) -lp1);

  \ pre-tank
  #d0=( lp1-fi*#d0(-1));
  #d1=(fi*(#d0-#d1(-1))  +#d0(-1));
  #d2=(fi* #d1+#d1(-1)-si*#d2(-1));
  #d3=(si*(#d2-#d3(-1))  +#d2(-1));

  split=si*#d3+#d3(-1);

  \ excursions
  {exc_phase};
  exc  = ed*(1f+cos(exc_phase*6.2800));
  exc2 = ed*(1f+sin(exc_phase*6.2847));

  \ left loop
  #d4=split+dc*#d11(-1)+ft*cubic(*#d4,-exc); \ tank diffuse 1
  #d5=cubic(*#d4,-exc)-ft*#d4;               \ long delay 1

  {lp2};{lp2}+=dp*(#d5(-1)-lp2); \ damp 1

  #d6=dc*lp2-st*#d6(-1); \ tank diffuse 2
  #d7=#d6(-1)+st*#d6;    \ long delay 2

  \ right loop
  #d8=split+dc*#d7(-1)+ft*cubic(*#d8,-exc2); \ tank diffuse 3
  #d9=cubic(*#d8,-exc2)-ft*#d8;              \ long delay 3

  {lp3};{lp3}+=dp*#d9(-1)-lp3; \ damp 2

  #d10=dc*lp3-st*#d10(-1); \ tank diffuse 4
  #d11=#d10(-1)+st*#d10;   \ long delay 4

  lo=
    #d9(0.008937872s)
  + #d9(0.099929438s)
  - #d10(0.064278754s)
  + #d11(0.067067639s)
  - #d5(0.066866033s)
  - #d6(0.006283391s)
  - #d7(0.035818689s)
  ;

  ro=
    #d5(0.011861161s)
  + #d5(0.121870905s)
  - #d6(0.041262054s)
  + #d7(0.08981553s)
  - #d9(0.070931756s)
  - #d10(0.011256342s)
  - #d11(0.004065724s)
  ;

  {exc_phase}+=ex;

  \ todo: stereo
    ((x*dr+lo*we)
  +  (x*dr+ro*we))
);

diode(
  x0,
  freq[50f..2k]=280.036,
  Q[0.01f..1f]=1,
  hpf[1f..1k]=348.209,
  sat[0.01f..1.5f]=0.189
)=(
  {z0,z1,z2,z3,z4};

  fc = freq / sr;
  hfc = hpf / sr;
  a = pi * fc;
  K = pi * hfc;
  k = 20.0 * Q;
  A = 1.0 + 0.5 * k;
  ah = (K - 2.0) / (K + 2.0);
  bh = 2.0 / (K + 2.0);
  \ a = 2 * Math.tan(0.5*a) // dewarping, not required with 2x oversampling

  ainv = 1.0 / a;
  a2 = a * a;
  b = 2.0 * a + 1.0;
  b2 = b * b;
  c = 1.0 / (2.0 * a2 * a2 - 4.0 * a2 * b2 + b2 * b2);
  g0 = 2.0 * a2 * a2 * c;
  g = g0 * bh;

  \ current state
  s0 =
    (a2 * a * z0 +
      a2 * b * z1 +
      z2 * (b2 - 2.0 * a2) * a +
      z3 * (b2 - 3.0 * a2) * b) *
    c;

  s = bh * s0 - z4;

  \ solve feedback loop (linear)
  y5 = (g * x0 + s) / (1.0 + g * k);

  \ input clipping
  y0 = soft((x0 - k * y5),sat);
  y5 = g * y0 + s;

  \ compute integrator outputs
  y4 = g0 * y0 + s0;
  y3 = (b * y4 - z3) * ainv;
  y2 = (b * y3 - a * y4 - z2) * ainv;
  y1 = (b * y2 - a * y3 - z1) * ainv;

  \ update filter state
  {z0} += 4.0 * a * (y0 - y1 + y2);
  {z1} += 2.0 * a * (y1 - 2.0 * y2 + y3);
  {z2} += 2.0 * a * (y2 - 2.0 * y3 + y4);
  {z3} += 2.0 * a * (y3 - 2.0 * y4);
  {z4} = bh * y4 + ah * y5;

  A * y4
);

env(
  note_on_time,
  a[0.1..100]=15, \ attack
  r[0.1..100]=15  \ release
)=(
  dt=t-note_on_time; \ time since note_on_time
  A=1-wexp(-dt*a); \ attack curve
  R=wexp(-dt*r);   \ release curve
  A*R
);

tb303(
  x,
  freq[50f..2k]=280.036,
  Q[0.01f..1f]=1,
  hpf[1f..1k]=348.209,
  sat[0.01f..1.5f]=0.189,
  pre[0.1f..2f]=0.624,
  dist[1f..80f]=80
)=atan(diode(x*pre, freq, Q, hpf, sat)*dist);

distort(#x,#y,#k,bias=0f,post=0f,x)=(
  xmax=#x:::max;
  xmin=#x:::min;

  x+=bias;

  x=clamp(x,
    xmin+0.001,
    xmax-0.001);

  i=1;(while #x(i)<x i++);

  z = (x - #x(i-1)) / (#x(i) - #x(i-1));

  a = #k(i-1) * (#x(i) - #x(i-1)) - (#y(i) - #y(i-1));
  b =  -#k(i) * (#x(i) - #x(i-1)) + (#y(i) - #y(i-1));

  q = (1-z) * #y(i-1)
        +z  * #y(i)
        +z  * (1-z)
        *(a * (1-z)
        + b * z);

  q+post
);

#jfetl_x:[
  -2.4999032020568848, -1.7674853801727295,
  -1.6253507137298584, -1.5339927673339844,
  -1.4729481935501099,  -1.412233829498291,
  -1.3487496376037598, -0.9000921845436096,
   0.1996227502822876,  0.3705906569957733,
   0.4163645803928375, 0.46580982208251953,
   0.5479905605316162,  0.7514151930809021,
   1.5497076511383057,  1.7004239559173584
];
#jfetl_y:[
  19.672000885009766, 19.672000885009766,
  19.669902801513672, 19.652894973754883,
   19.53590965270996,  19.29184913635254,
  18.891223907470703,   15.0526704788208,
   4.147157192230225,  2.421009063720703,
  2.0919277667999268, 1.8554054498672485,
  1.7178535461425781, 1.6377859115600586,
  1.5540000200271606, 1.5540000200271606
];
#jfetl_k:[
    -9.691473007202148,   -9.32113265991211,
    -8.838568687438965,  -6.721536159515381,
    -6.113120079040527,  -5.439774036407471,
   -3.5792548656463623,  -2.998894691467285,
   -0.6902798414230347, -0.5636267066001892,
  -0.06262518465518951,                   0,
                     0,                   0,
                     0,                   0
];
distort_jfetl(x)=distort(
  *#jfetl_x,
  *#jfetl_y,
  *#jfetl_k,
  0, -5, x);
`

// export const dly = `
// dly(x, len[1..44100]=500.0, fb[0..1]=0.2)=(
//   ##44100;    // 1s buffer
//   {n};        // needle
//   y=#(n-len); // read from buffer needle minus the delay length
//   #n=x+y*fb;  // write sample to buffer at current needle position
//   {n}=n+1;    // write new needle in memory
//   y           // return the sample
// )
// `

// note_to_hz(x)=440*2^((x-33)/12);

// dly(
//   x,               // input
//   len[1..sr]=sr/2, // length, default 0.5s
//   fb[0..1]=0.2     // feedback
// )=(
//   #:sr;       // 1s buffer
//   y=#(-len);  // read from buffer needle minus the delay length
//   #=x+y*fb;   // write sample to buffer at current needle position
//   y           // return the sample
// )

// #voices:4,2; // voices (time,hz)

// note_on(x)=(
//   hz=note_to_hz(x);
//   #voices=t,hz;
//   0.0
// );

// play_voice(
//   vt,                 // voice time
//   hz,                 // voice hz
//   .d[0.01..20]=10,    // decay
//   .c[100..1000]=500,  // lp cutoff
//   .Q[0.1..4.0]=3.0,   // lp Q
//   .dl[1..sr]=sr/2,    // delay length
//   .fb[0..1]=0.1       // delay feedback
//   .dc[100..2000]=1000 // delay lp cutoff
//   .dQ[0.1..4.0]=1.5   // delay lp Q
// )=(
//   e=exp(-(t-vt)*d); // envelope
//   s=lp(
//       sin(pi2*hz*t),
//       c+1000*e,
//       Q
//     )*e;
//   s+lp(dly(s*0.5,dl,fb),dc,dQ)
// )

// f()=#voices::play_voice
