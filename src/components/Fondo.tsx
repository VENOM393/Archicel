'use client';

/**
 * El fondo: la fotografía de la casa, viva.
 *
 * Cuatro pasadas de WebGL — escena, extracción de brillos, desenfoque separable y
 * composición— sobre `public/fondo.webp`. Si el navegador no da WebGL, queda la misma
 * imagen como fondo CSS con un velo: la página nunca se queda sin fondo.
 *
 * La interfaz solo le pide dos cosas: el ambiente (día/noche) y si está en modo edición.
 */

import { useEffect, useRef } from 'react';

const VERT =
  'attribute vec2 aPos;varying vec2 vUv;void main(){vUv=aPos*0.5+0.5;gl_Position=vec4(aPos,0.,1.);}';

const F_SCENE = [
  'precision highp float;',
  'varying vec2 vUv;',
  'uniform sampler2D uTex;uniform vec2 uRes;uniform float uTexAspect;uniform vec2 uTexel;',
  'uniform float uTime;uniform vec2 uPointer;uniform float uDay;uniform vec3 uRipple;',
  'void main(){',
  '  vec2 uv=vUv; uv.y=1.0-uv.y;',
  '  float ca=uRes.x/max(uRes.y,1.0);',
  '  vec2 s = ca>uTexAspect ? vec2(1.0,uTexAspect/ca) : vec2(ca/uTexAspect,1.0);',
  '  uv=(uv-0.5)/s+0.5;',
  '  float breathe=1.008+0.010*sin(uTime*0.07);',
  '  uv=(uv-0.5)/breathe+0.5;',
  '  uv+=uPointer*vec2(0.008,0.005);',
  '  float rt=uTime-uRipple.z;',
  '  if(rt>0.0&&rt<2.6){',
  '    vec2 d=vUv-uRipple.xy; d.x*=ca;',
  '    float dist=length(d);',
  '    float wave=sin(dist*26.0-rt*6.0)*exp(-dist*3.4)*exp(-rt*1.5);',
  '    uv+=normalize(d+vec2(1e-5))*wave*0.016;',
  '  }',
  '  float wet=smoothstep(0.62,0.99,uv.y);',
  '  uv.x+=sin(uv.y*54.0+uTime*0.55)*0.0026*wet;',
  '  uv.y+=sin(uv.x*26.0-uTime*0.38)*0.0018*wet;',
  '  vec2 suv=clamp(uv,0.002,0.998);',
  '  vec3 col=texture2D(uTex,suv,-0.4).rgb;',
  '  vec3 blr=(texture2D(uTex,suv+vec2(uTexel.x,0.0)).rgb+texture2D(uTex,suv-vec2(uTexel.x,0.0)).rgb',
  '           +texture2D(uTex,suv+vec2(0.0,uTexel.y)).rgb+texture2D(uTex,suv-vec2(0.0,uTexel.y)).rgb)*0.25;',
  '  col+=(col-blr)*0.55;',
  '  float warm=clamp((col.r-col.b)*2.6,0.0,1.0);',
  '  float flicker=0.05*sin(uTime*0.9+uv.x*5.0)+0.028*sin(uTime*2.3+uv.y*9.0);',
  '  col+=warm*(0.12+flicker)*vec3(1.0,0.66,0.30);',
  '  col+=wet*warm*0.18*vec3(1.0,0.60,0.26);',
  '  vec3 night=mix(col*vec3(0.82,0.94,1.0),vec3(0.035,0.068,0.082),0.42);',
  '  vec3 day  =mix(col*vec3(1.02,1.0,0.99),vec3(0.792,0.855,0.878),0.44);',
  '  col=mix(night,day,uDay);',
  '  gl_FragColor=vec4(col,1.0);',
  '}',
].join('\n');

const F_BRIGHT = [
  'precision highp float;',
  'varying vec2 vUv;uniform sampler2D uScene;uniform float uDay;',
  'void main(){',
  '  vec3 c=texture2D(uScene,vUv).rgb;',
  '  float lum=dot(c,vec3(0.2126,0.7152,0.0722));',
  '  float warm=clamp((c.r-c.b)*2.2,0.0,1.0);',
  '  float umbral=mix(0.42,0.66,uDay);',
  '  float k=smoothstep(umbral,umbral+0.28,lum)*(0.45+0.55*warm);',
  '  gl_FragColor=vec4(c*k,1.0);',
  '}',
].join('\n');

const F_BLUR = [
  'precision highp float;',
  'varying vec2 vUv;uniform sampler2D uTex;uniform vec2 uRes;uniform vec2 uDir;',
  'void main(){',
  '  vec2 px=uDir/uRes;',
  '  vec3 c=texture2D(uTex,vUv).rgb*0.2270270270;',
  '  c+=texture2D(uTex,vUv+px*1.3846153846).rgb*0.3162162162;',
  '  c+=texture2D(uTex,vUv-px*1.3846153846).rgb*0.3162162162;',
  '  c+=texture2D(uTex,vUv+px*3.2307692308).rgb*0.0702702703;',
  '  c+=texture2D(uTex,vUv-px*3.2307692308).rgb*0.0702702703;',
  '  gl_FragColor=vec4(c,1.0);',
  '}',
].join('\n');

const F_COMP = [
  'precision highp float;',
  'varying vec2 vUv;',
  'uniform sampler2D uScene;uniform sampler2D uBloom;',
  'uniform float uTime;uniform float uEdit;uniform float uIntro;uniform float uDay;',
  'float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}',
  'void main(){',
  '  vec3 col=texture2D(uScene,vUv).rgb;',
  '  col+=texture2D(uBloom,vUv).rgb*mix(0.62,0.34,uDay);',
  '  col*=1.0+0.022*sin(uTime*0.13);',
  '  float d=length(vUv-0.5); col*=1.0-0.52*d*d;',
  '  col*=mix(1.0,0.5,uEdit);',
  '  col*=mix(0.55,1.0,uIntro);',
  '  col+=(hash(gl_FragCoord.xy+fract(uTime)*91.7)-0.5)*0.010;',
  '  col+=(hash(gl_FragCoord.xy*1.7)-0.5)/255.0;',
  '  gl_FragColor=vec4(col,1.0);',
  '}',
].join('\n');

interface Destino {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  w: number;
  h: number;
}

export interface MandoFondo {
  /** Lanza la onda desde un punto de la ventana. */
  onda(x: number, y: number): void;
}

export function Fondo({
  editando,
  dia,
  mandoRef,
}: {
  editando: boolean;
  dia: boolean;
  mandoRef?: React.MutableRefObject<MandoFondo | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const estado = useRef({ edit: 0, objetivo: 0, dia: 0, ripple: [0.5, 0.5, -99] as number[] });

  estado.current.objetivo = editando ? 1 : 0;
  estado.current.dia = dia ? 1 : 0;

  useEffect(() => {
    if (mandoRef) {
      mandoRef.current = {
        onda(x, y) {
          estado.current.ripple = [x / window.innerWidth, 1 - y / window.innerHeight, ahora()];
        },
      };
    }
    let t0 = performance.now();
    const ahora = () => (performance.now() - t0) / 1000;

    const cv = canvasRef.current;
    if (!cv) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let gl: WebGLRenderingContext | null = null;
    let es3 = false;
    try {
      gl = cv.getContext('webgl2', { antialias: false, alpha: false }) as WebGLRenderingContext | null;
      es3 = Boolean(gl);
      if (!gl) gl = cv.getContext('webgl', { antialias: false, alpha: false });
    } catch {
      gl = null;
    }
    if (!gl) return;
    const g = gl;

    const compilar = (tipo: number, src: string) => {
      const sh = g.createShader(tipo)!;
      g.shaderSource(sh, src);
      g.compileShader(sh);
      if (!g.getShaderParameter(sh, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(sh) ?? 'shader');
      return sh;
    };
    const programa = (frag: string) => {
      const p = g.createProgram()!;
      g.attachShader(p, compilar(g.VERTEX_SHADER, VERT));
      g.attachShader(p, compilar(g.FRAGMENT_SHADER, frag));
      g.linkProgram(p);
      if (!g.getProgramParameter(p, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(p) ?? 'programa');
      return p;
    };
    const destino = (w: number, h: number): Destino => {
      const t = g.createTexture()!;
      g.bindTexture(g.TEXTURE_2D, t);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, w, h, 0, g.RGBA, g.UNSIGNED_BYTE, null);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
      const f = g.createFramebuffer()!;
      g.bindFramebuffer(g.FRAMEBUFFER, f);
      g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, t, 0);
      g.bindFramebuffer(g.FRAMEBUFFER, null);
      return { tex: t, fbo: f, w, h };
    };

    let vivo = true;
    let raf = 0;
    try {
      const pScene = programa(F_SCENE);
      const pBright = programa(F_BRIGHT);
      const pBlur = programa(F_BLUR);
      const pComp = programa(F_COMP);

      const buf = g.createBuffer();
      g.bindBuffer(g.ARRAY_BUFFER, buf);
      g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
      [pScene, pBright, pBlur, pComp].forEach((p) => {
        g.useProgram(p);
        const a = g.getAttribLocation(p, 'aPos');
        g.enableVertexAttribArray(a);
        g.vertexAttribPointer(a, 2, g.FLOAT, false, 0, 0);
      });
      const U = (p: WebGLProgram, n: string) => g.getUniformLocation(p, n);

      const tex = g.createTexture()!;
      g.bindTexture(g.TEXTURE_2D, tex);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGB, 1, 1, 0, g.RGB, g.UNSIGNED_BYTE, new Uint8Array([16, 28, 33]));
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);

      let aspect = 16 / 9;
      let texel: [number, number] = [1 / 4000, 1 / 2250];
      const img = new Image();
      img.onload = () => {
        aspect = img.width / img.height;
        texel = [1 / img.width, 1 / img.height];
        g.bindTexture(g.TEXTURE_2D, tex);
        g.texImage2D(g.TEXTURE_2D, 0, g.RGB, g.RGB, g.UNSIGNED_BYTE, img);
        if (es3) {
          g.generateMipmap(g.TEXTURE_2D);
          g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR_MIPMAP_LINEAR);
          const aniso = g.getExtension('EXT_texture_filter_anisotropic');
          if (aniso) {
            const max = g.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number;
            g.texParameterf(g.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, max));
          }
        }
        cv.parentElement?.classList.add('gl');
      };
      img.src = '/fondo.webp';

      const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
      const alMover = (e: PointerEvent) => {
        ptr.tx = e.clientX / window.innerWidth - 0.5;
        ptr.ty = e.clientY / window.innerHeight - 0.5;
      };
      if (!reduce) window.addEventListener('pointermove', alMover, { passive: true });

      let escena: Destino | null = null;
      let brillo: Destino | null = null;
      let blurA: Destino | null = null;
      let blurB: Destino | null = null;
      let W = 0;
      let H = 0;

      const medir = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        const w = Math.round(cv.clientWidth * dpr);
        const h = Math.round(cv.clientHeight * dpr);
        if (w === W && h === H) return;
        W = cv.width = w;
        H = cv.height = h;
        const hw = Math.max(2, w >> 1);
        const hh = Math.max(2, h >> 1);
        escena = destino(w, h);
        brillo = destino(hw, hh);
        blurA = destino(hw, hh);
        blurB = destino(hw, hh);
      };

      const pasada = (prog: WebGLProgram, target: Destino | null) => {
        g.useProgram(prog);
        g.bindFramebuffer(g.FRAMEBUFFER, target ? target.fbo : null);
        g.viewport(0, 0, target ? target.w : W, target ? target.h : H);
        g.drawArrays(g.TRIANGLES, 0, 3);
      };

      const frame = (now: number) => {
        if (!vivo) return;
        medir();
        if (!escena || !brillo || !blurA || !blurB) {
          raf = requestAnimationFrame(frame);
          return;
        }
        const t = (now - t0) / 1000;
        ptr.x += (ptr.tx - ptr.x) * 0.045;
        ptr.y += (ptr.ty - ptr.y) * 0.045;
        const e = estado.current;
        e.edit += (e.objetivo - e.edit) * 0.08;

        g.useProgram(pScene);
        g.activeTexture(g.TEXTURE0);
        g.bindTexture(g.TEXTURE_2D, tex);
        g.uniform1i(U(pScene, 'uTex'), 0);
        g.uniform2f(U(pScene, 'uRes'), W, H);
        g.uniform1f(U(pScene, 'uTexAspect'), aspect);
        g.uniform2f(U(pScene, 'uTexel'), texel[0], texel[1]);
        g.uniform1f(U(pScene, 'uTime'), reduce ? 0 : t);
        g.uniform2f(U(pScene, 'uPointer'), ptr.x, ptr.y);
        g.uniform1f(U(pScene, 'uDay'), e.dia);
        g.uniform3f(U(pScene, 'uRipple'), e.ripple[0], e.ripple[1], e.ripple[2]);
        pasada(pScene, escena);

        g.useProgram(pBright);
        g.activeTexture(g.TEXTURE0);
        g.bindTexture(g.TEXTURE_2D, escena.tex);
        g.uniform1i(U(pBright, 'uScene'), 0);
        g.uniform1f(U(pBright, 'uDay'), e.dia);
        pasada(pBright, brillo);

        let origen = brillo;
        for (let i = 0; i < 2; i++) {
          g.useProgram(pBlur);
          g.activeTexture(g.TEXTURE0);
          g.bindTexture(g.TEXTURE_2D, origen.tex);
          g.uniform1i(U(pBlur, 'uTex'), 0);
          g.uniform2f(U(pBlur, 'uRes'), blurA.w, blurA.h);
          g.uniform2f(U(pBlur, 'uDir'), 1 + i, 0);
          pasada(pBlur, blurA);

          g.activeTexture(g.TEXTURE0);
          g.bindTexture(g.TEXTURE_2D, blurA.tex);
          g.uniform2f(U(pBlur, 'uRes'), blurB.w, blurB.h);
          g.uniform2f(U(pBlur, 'uDir'), 0, 1 + i);
          pasada(pBlur, blurB);
          origen = blurB;
        }

        g.useProgram(pComp);
        g.activeTexture(g.TEXTURE0);
        g.bindTexture(g.TEXTURE_2D, escena.tex);
        g.uniform1i(U(pComp, 'uScene'), 0);
        g.activeTexture(g.TEXTURE1);
        g.bindTexture(g.TEXTURE_2D, blurB.tex);
        g.uniform1i(U(pComp, 'uBloom'), 1);
        g.uniform1f(U(pComp, 'uTime'), reduce ? 0 : t);
        g.uniform1f(U(pComp, 'uEdit'), e.edit);
        g.uniform1f(U(pComp, 'uIntro'), Math.min(t / 1.6, 1));
        g.uniform1f(U(pComp, 'uDay'), e.dia);
        pasada(pComp, null);

        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);

      return () => {
        vivo = false;
        cancelAnimationFrame(raf);
        window.removeEventListener('pointermove', alMover);
      };
    } catch {
      /* sin shader queda el fondo CSS */
    }
  }, [mandoRef]);

  return (
    <div className="bg" id="bg" aria-hidden="true" style={{ ['--photo' as string]: 'url(/fondo.webp)' }}>
      <canvas ref={canvasRef} />
      <span className="still" />
      <span className="tint" />
    </div>
  );
}
