export const lp = `
lp(x0, freq[1..1000]=100.0, Q[0.001..3]=1.0)=(
  {x1,x2,y1,y2};

  w = (pi2 * freq) / sr;
  sin_w = sin(w);
  cos_w = cos(w);
  a = sin_w / (2.0 * Q);

  b0 = (1.0 - cos_w) / 2.0;
  b1 =  1.0 - cos_w;
  b2 = b0;
  a0 =  1.0 + a;
  a1 = -2.0 * cos_w;
  a2 =  1.0 - a;

  g = 1.0 / a0;

  (b0,b1,b2,a1,a2) *= g;

  y0 = b0*x0 + b1*x1 + b2*x2 - a1*y1 - a2*y2;

  {y1,y2} = (y0,y1);
  {x1,x2} = (x0,x1);

  y0
)
`

export const modwrap = `
modwrap(x,N)=(x%N+N)%N
`

export const denan = `
denan(x=0f)=x-x!=0f?0f:x
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
