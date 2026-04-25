(() => {
  const canvas = document.getElementById('hero-bg');

  if (!canvas) {
    return;
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  if (reduceMotion || !finePointer) {
    return;
  }

  const header = canvas.parentElement;
  if (!header) {
    return;
  }

  const gl = canvas.getContext('webgl2', {
    antialias: false,
    alpha: true,
    premultipliedAlpha: true,
  });

  if (!gl) {
    return;
  }

  const vertexShaderSource = `#version 300 es
in vec2 p;
void main(){
  gl_Position=vec4(p,0.,1.);
}`;

  const fragmentShaderSource = `#version 300 es
precision highp float;
out vec4 outC;
uniform vec2 uRes;
uniform vec3 uMouse;
uniform float uT;

const vec3 cO=vec3(.984,.471,.125);
const vec3 cY=vec3(.996,.776,.180);
const vec3 cG=vec3(.459,.847,.420);
const vec3 cB=vec3(.369,.706,.843);

vec3 stripe(float x){
  vec3 c=mix(cO,cY,smoothstep(.20,.30,x));
  c=mix(c,cG,smoothstep(.45,.55,x));
  return mix(c,cB,smoothstep(.70,.80,x));
}

float h2(vec2 p){
  return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);
}

float n2(vec2 p){
  vec2 i=floor(p),f=fract(p);
  float a=h2(i),b=h2(i+vec2(1,0)),c=h2(i+vec2(0,1)),d=h2(i+vec2(1,1));
  vec2 u=f*f*(3.-2.*f);
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}

void main(){
  vec2 uv=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y)/uRes;
  vec2 m=uMouse.xy/uRes;
  float pres=clamp(uMouse.z,0.,1.);
  vec3 col=stripe(clamp(m.x,0.,1.));

  float wobble=(n2(vec2(uv.y*4.,uT*0.3))-0.5)*0.015;
  float dxPx=abs((uv.x-m.x)+wobble)*uRes.x;
  float hMask=exp(-dxPx*dxPx/(180.*180.));

  float reachEnd=clamp(m.y+0.08,0.,1.);
  float vTop=smoothstep(reachEnd,0.,uv.y);
  float topSqz=mix(0.65,1.,smoothstep(0.,0.4,uv.y));
  float mask=vTop*pow(hMask,topSqz);

  float flick=0.92+0.08*n2(vec2(uv.x*3.+uT*0.4,uv.y*3.));
  float intensity=0.20*mask*pres*flick;

  outC=vec4(mix(vec3(1.),col,intensity),1.);
}`;

  const compileShader = (shaderType, source) => {
    const shader = gl.createShader(shaderType);
    if (!shader) {
      return null;
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  };

  const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

  if (!vertexShader || !fragmentShader) {
    return;
  }

  const program = gl.createProgram();
  if (!program) {
    return;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.bindAttribLocation(program, 0, 'p');
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    return;
  }

  gl.useProgram(program);

  const buffer = gl.createBuffer();
  if (!buffer) {
    return;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(program, 'uRes');
  const uMouse = gl.getUniformLocation(program, 'uMouse');
  const uT = gl.getUniformLocation(program, 'uT');

  if (!uRes || !uMouse || !uT) {
    return;
  }

  const target = { x: 0.5, y: 0.5, p: 0 };
  const eased = { x: 0.5, y: 0.5, p: 0 };
  const maxBelow = 600;

  const onPointerMove = (event) => {
    const bounds = header.getBoundingClientRect();

    if (bounds.width <= 0 || bounds.height <= 0) {
      return;
    }

    const relativeX = Math.min(Math.max(event.clientX - bounds.left, 0), bounds.width) / bounds.width;
    const relativeY = (event.clientY - bounds.top) / bounds.height;
    const pressure = 1 - Math.min(1, Math.max(0, event.clientY - (bounds.top + bounds.height)) / maxBelow);

    target.x = relativeX;
    target.y = relativeY;
    target.p = pressure;
  };

  const onPointerOut = (event) => {
    if (!event.relatedTarget) {
      target.p = 0;
    }
  };

  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(1, (bounds.width * ratio) | 0);
    const height = Math.max(1, (bounds.height * ratio) | 0);

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  };

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('mouseout', onPointerOut, { passive: true });
  window.addEventListener('resize', resize);
  resize();

  const start = window.performance.now();
  let frameHandle = 0;

  const frame = (now) => {
    resize();

    eased.x += (target.x - eased.x) * 0.12;
    eased.y += (target.y - eased.y) * 0.12;
    eased.p += (target.p - eased.p) * (target.p > eased.p ? 0.1 : 0.04);

    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform3f(uMouse, eased.x * canvas.width, eased.y * canvas.height, eased.p);
    gl.uniform1f(uT, (now - start) / 1000);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    frameHandle = window.requestAnimationFrame(frame);
  };

  frameHandle = window.requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      window.cancelAnimationFrame(frameHandle);
      return;
    }

    frameHandle = window.requestAnimationFrame(frame);
  });
})();
