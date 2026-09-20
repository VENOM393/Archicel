'use client';

/**
 * El fondo: la fotografía de la casa, viva.
 *
 * Cuatro pasadas de WebGL — escena, extracción de brillos, desenfoque separable y
 * composición— sobre `public/fondo.webp`. Si el navegador no da WebGL, queda la misma
 * imagen como fondo CSS con un velo: la página nunca se queda sin fondo.
 *
 * La interfaz solo le pide una cosa: si está en modo edición.
 */

import { useEffect, useRef } from 'react';

const VERT =
  'attribute vec2 aPos;varying vec2 vUv;void main(){vUv=aPos*0.5+0.5;gl_Position=vec4(aPos,0.,1.);}';

const F_SCENE = [
  'precision highp float;',
  'varying vec2 vUv;',
  'uniform sampler2D uTex;uniform vec2 uRes;uniform float uTexAspect;uniform vec2 uTexel;',
  'uniform float uTime;uniform vec2 uPointer;uniform vec3 uRipple;',
  'void main(){',
  '  vec2 uv=vUv; uv.y=1.0-uv.y;',
  '  float ca=uRes.x/max(uRes.y,1.0);',
  /* "cover" de verdad: se recorta el eje que sobra, nunca se estira el que falta.
     Encoger el rango de coordenadas es lo que recorta; agrandarlo sacaba la lectura
     fuera de la textura y el clamp la embadurnaba contra el borde — muy visible en
     vertical, donde la pantalla es mucho más estrecha que la fotografía. */
  '  vec2 s=vec2(min(ca/uTexAspect,1.0),min(uTexAspect/ca,1.0));',
  '  uv=(uv-0.5)*s+0.5;',
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
  /* dos escalas de onda: la larga mece, la corta riza */
  '  uv.x+=sin(uv.y*54.0+uTime*0.55)*0.0026*wet;',
  '  uv.y+=sin(uv.x*26.0-uTime*0.38)*0.0018*wet;',
  '  uv.x+=sin(uv.y*131.0-uTime*1.07)*0.0009*wet;',
  '  vec2 suv=clamp(uv,0.002,0.998);',
  '  vec3 col=texture2D(uTex,suv,-0.4).rgb;',
  '  vec3 blr=(texture2D(uTex,suv+vec2(uTexel.x,0.0)).rgb+texture2D(uTex,suv-vec2(uTexel.x,0.0)).rgb',
  '           +texture2D(uTex,suv+vec2(0.0,uTexel.y)).rgb+texture2D(uTex,suv-vec2(0.0,uTexel.y)).rgb)*0.25;',
  '  col+=(col-blr)*0.55;',
  '  float warm=clamp((col.r-col.b)*2.6,0.0,1.0);',
  /* tres frecuencias inconmensurables: el latido de la luz nunca se repite a la vista */
  '  float flicker=0.026*sin(uTime*0.9+uv.x*5.0)+0.014*sin(uTime*2.3+uv.y*9.0)',
  '               +0.008*sin(uTime*5.77+uv.x*17.0+uv.y*11.0);',
  '  col+=warm*(0.07+flicker)*vec3(1.0,0.66,0.30);',
  /* la lámina de agua devuelve la ventana con su propio temblor, más lento */
  '  float espejo=0.12+0.035*sin(uTime*0.63+uv.x*8.0);',
  '  col+=wet*warm*espejo*vec3(1.0,0.60,0.26);',
  /* El tinte del ambiente es `--canvas-deep` traducido a lineal, y la escena pierde
     parte de su color para acompañarlo: sigue siendo una fotografía, no una radiografía.
     Si la paleta cambia y esto no, la imagen y la interfaz dejan de ser el mismo sitio. */
  '  col=mix(col*vec3(0.96,0.97,1.00),vec3(0.043,0.043,0.050),0.56);',
  '  float gris=dot(col,vec3(0.2126,0.7152,0.0722));',
  '  col=mix(col,vec3(gris),0.42);',
  '  gl_FragColor=vec4(col,1.0);',
  '}',
].join('\n');

const F_BRIGHT = [
  'precision highp float;',
  'varying vec2 vUv;uniform sampler2D uScene;',
  'void main(){',
  '  vec3 c=texture2D(uScene,vUv).rgb;',
  '  float lum=dot(c,vec3(0.2126,0.7152,0.0722));',
  '  float warm=clamp((c.r-c.b)*2.2,0.0,1.0);',
  '  float umbral=0.56;',
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

/**
 * La composición final es donde la fotografía se vuelve cine: lente antes que píxel.
 *
 * Por orden — aberración cromática de lente, haces volumétricos desde la ventana,
 * halación cálida (el halo rojizo que deja la película alrededor de una luz), viñeta y
 * grano que vive en las sombras, como el negativo real. Nada de esto sube el brillo
 * medio: reparte el que ya hay para que la imagen tenga profundidad sin comerse la
 * interfaz que va encima.
 */
const F_COMP = [
  'precision highp float;',
  'varying vec2 vUv;',
  'uniform sampler2D uScene;uniform sampler2D uBloom;',
  'uniform float uTime;uniform float uEdit;uniform float uIntro;',
  'float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}',
  'void main(){',
  '  vec2 c=vUv-0.5;',
  '  float d=length(c);',
  '  vec2 dir=c/max(d,1e-5);',
  /* la lente no enfoca los tres canales en el mismo sitio; en el borde se nota */
  '  float ab=0.0020*d*d;',
  '  vec3 col;',
  '  col.r=texture2D(uScene,vUv+dir*ab).r;',
  '  col.g=texture2D(uScene,vUv).g;',
  '  col.b=texture2D(uScene,vUv-dir*ab).b;',
  /* haces volumétricos: el brillo se arrastra hacia fuera desde la casa */
  '  vec2 origen=vec2(0.5,0.54);',
  '  vec2 paso=(vUv-origen)*(0.34/10.0);',
  '  vec2 p=vUv;',
  '  vec3 rayos=vec3(0.0);',
  '  float peso=1.0;',
  '  for(int i=0;i<10;i++){p-=paso;rayos+=texture2D(uBloom,p).rgb*peso;peso*=0.855;}',
  '  rayos*=0.1;',
  '  col+=rayos*0.46*vec3(1.0,0.80,0.56)*smoothstep(0.06,0.52,d);',
  /* halación: el halo de la película tira a ámbar, nunca a blanco */
  '  vec3 halo=texture2D(uBloom,vUv).rgb;',
  '  float calido=clamp((halo.r-halo.b)*2.0,0.0,1.0);',
  '  col+=halo*0.26*mix(vec3(1.0),vec3(1.10,0.74,0.52),calido);',
  '  col*=1.0+0.012*sin(uTime*0.13);',
  '  col*=1.0-0.66*d*d;',
  '  col*=mix(1.0,0.5,uEdit);',
  '  col*=mix(0.55,1.0,uIntro);',
  /* el grano del negativo vive en las sombras y desaparece en las luces */
  '  float lum=dot(col,vec3(0.2126,0.7152,0.0722));',
  '  float g=hash(gl_FragCoord.xy+fract(uTime)*91.7)-0.5;',
  '  col+=g*0.026*(1.0-smoothstep(0.0,0.62,lum));',
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
  mandoRef,
}: {
  editando: boolean;
  mandoRef?: React.MutableRefObject<MandoFondo | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const estado = useRef({ edit: 0, objetivo: 0, ripple: [0.5, 0.5, -99] as number[] });

  estado.current.objetivo = editando ? 1 : 0;

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
      /**
       * Las posiciones de los uniformes se piden **una vez**, no en cada fotograma.
       *
       * `getUniformLocation` es una consulta al controlador gráfico y obliga a esperar
       * su respuesta. Había quince por fotograma: a 60 por segundo, novecientas paradas
       * por segundo para preguntar algo que nunca cambia. Era una de las dos razones de
       * los tirones al cambiar de página, cuando el hilo principal ya va justo montando
       * la vista nueva.
       */
      const uni = <K extends string>(p: WebGLProgram, nombres: readonly K[]) =>
        Object.fromEntries(nombres.map((n) => [n, g.getUniformLocation(p, n)])) as Record<
          K,
          WebGLUniformLocation | null
        >;

      const uScene = uni(pScene, ['uTex', 'uRes', 'uTexAspect', 'uTexel', 'uTime', 'uPointer', 'uRipple'] as const);
      const uBright = uni(pBright, ['uScene'] as const);
      const uBlur = uni(pBlur, ['uTex', 'uRes', 'uDir'] as const);
      const uComp = uni(pComp, ['uScene', 'uBloom', 'uTime', 'uEdit', 'uIntro'] as const);

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

      /** Devuelve al controlador gráfico lo que ya no se va a usar. */
      const liberar = (d: Destino | null) => {
        if (!d) return;
        g.deleteTexture(d.tex);
        g.deleteFramebuffer(d.fbo);
      };

      /* El tamaño al que se quiere llegar y desde cuándo se quiere. */
      let pedido: [number, number] = [0, 0];
      let pedidoDesde = 0;

      /**
       * Reconstruir los cuatro destinos cuesta, y hay que hacerlo lo menos posible.
       *
       * Al pasar de una vista que desplaza a otra que no, la barra de desplazamiento
       * entra o sale y el ancho de la ventana cambia unos quince píxeles. Eso obligaba a
       * reservar cuatro texturas a resolución completa **en cada cambio de página**, con
       * el hilo principal ya ocupado montando la vista nueva: ahí estaban los tirones.
       *
       * Ahora el cambio de tamaño espera a asentarse. Durante esa décima de segundo el
       * navegador estira el lienzo anterior, que sobre una fotografía desenfocada no se
       * distingue. El primer tamaño, en cambio, no espera nada.
       */
      const medir = (now: number) => {
        /* Dos es suficiente: por encima se multiplican los píxeles a procesar sin que la
           fotografía gane un detalle que se vea. En una pantalla 4K, tres era pedirle al
           equipo cuatro veces el trabajo para nada. */
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.round(cv.clientWidth * dpr);
        const h = Math.round(cv.clientHeight * dpr);
        if (w < 2 || h < 2) return;
        if (w === W && h === H) return;

        if (pedido[0] !== w || pedido[1] !== h) {
          pedido = [w, h];
          pedidoDesde = now;
        }
        if (escena && now - pedidoDesde < 180) return;

        W = cv.width = w;
        H = cv.height = h;
        const hw = Math.max(2, w >> 1);
        const hh = Math.max(2, h >> 1);
        /* Sin esto, cada cambio de tamaño dejaba cuatro texturas huérfanas en la memoria
           de la tarjeta. Al cabo de unas cuantas navegaciones el navegador tiraba el
           contexto y la fotografía se quedaba sin filtros. */
        liberar(escena);
        liberar(brillo);
        liberar(blurA);
        liberar(blurB);
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
        medir(now);
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
        g.uniform1i(uScene.uTex, 0);
        g.uniform2f(uScene.uRes, W, H);
        g.uniform1f(uScene.uTexAspect, aspect);
        g.uniform2f(uScene.uTexel, texel[0], texel[1]);
        g.uniform1f(uScene.uTime, reduce ? 0 : t);
        g.uniform2f(uScene.uPointer, ptr.x, ptr.y);
        g.uniform3f(uScene.uRipple, e.ripple[0], e.ripple[1], e.ripple[2]);
        pasada(pScene, escena);

        g.useProgram(pBright);
        g.activeTexture(g.TEXTURE0);
        g.bindTexture(g.TEXTURE_2D, escena.tex);
        g.uniform1i(uBright.uScene, 0);
        pasada(pBright, brillo);

        let origen = brillo;
        for (let i = 0; i < 2; i++) {
          g.useProgram(pBlur);
          g.activeTexture(g.TEXTURE0);
          g.bindTexture(g.TEXTURE_2D, origen.tex);
          g.uniform1i(uBlur.uTex, 0);
          g.uniform2f(uBlur.uRes, blurA.w, blurA.h);
          g.uniform2f(uBlur.uDir, 1 + i, 0);
          pasada(pBlur, blurA);

          g.activeTexture(g.TEXTURE0);
          g.bindTexture(g.TEXTURE_2D, blurA.tex);
          g.uniform2f(uBlur.uRes, blurB.w, blurB.h);
          g.uniform2f(uBlur.uDir, 0, 1 + i);
          pasada(pBlur, blurB);
          origen = blurB;
        }

        g.useProgram(pComp);
        g.activeTexture(g.TEXTURE0);
        g.bindTexture(g.TEXTURE_2D, escena.tex);
        g.uniform1i(uComp.uScene, 0);
        g.activeTexture(g.TEXTURE1);
        g.bindTexture(g.TEXTURE_2D, blurB.tex);
        g.uniform1i(uComp.uBloom, 1);
        g.uniform1f(uComp.uTime, reduce ? 0 : t);
        g.uniform1f(uComp.uEdit, e.edit);
        g.uniform1f(uComp.uIntro, Math.min(t / 1.6, 1));
        pasada(pComp, null);

        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);

      /**
       * Con la pestaña oculta no se dibuja.
       *
       * El navegador ya frena los fotogramas, pero no siempre a cero, y volver a una
       * pestaña que lleva media hora acumulando trabajo se nota. Al reanudar se corrige
       * `t0` para que el tiempo del shader continúe donde estaba: si diera el salto
       * entero, el oleaje y el parpadeo de la luz pegarían un tirón a la vista.
       */
      let pausadoEn = 0;
      const alCambiarVisibilidad = () => {
        if (document.hidden) {
          if (raf) cancelAnimationFrame(raf);
          raf = 0;
          pausadoEn = performance.now();
        } else if (vivo && !raf) {
          t0 += performance.now() - pausadoEn;
          raf = requestAnimationFrame(frame);
        }
      };
      document.addEventListener('visibilitychange', alCambiarVisibilidad);

      /**
       * Si el sistema se lleva el contexto, se vuelve al fondo de CSS.
       *
       * Pasa de verdad: al suspender el equipo, al cambiar de tarjeta gráfica o cuando el
       * navegador decide que hay demasiados lienzos. Sin esto, el canvas se quedaba en
       * negro y la aplicación entera parecía rota. Ahora reaparece la misma fotografía,
       * ya entonada por CSS, y no se distingue salvo porque deja de moverse.
       */
      const alPerderContexto = (e: Event) => {
        e.preventDefault();
        vivo = false;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        cv.parentElement?.classList.remove('gl');
      };
      cv.addEventListener('webglcontextlost', alPerderContexto);

      return () => {
        vivo = false;
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener('pointermove', alMover);
        document.removeEventListener('visibilitychange', alCambiarVisibilidad);
        cv.removeEventListener('webglcontextlost', alPerderContexto);
        /* Se devuelve todo: programas, texturas y destinos. Un contexto que se va sin
           soltar su memoria es lo que acaba tumbando al siguiente. */
        liberar(escena);
        liberar(brillo);
        liberar(blurA);
        liberar(blurB);
        g.deleteTexture(tex);
        g.deleteBuffer(buf);
        [pScene, pBright, pBlur, pComp].forEach((p) => g.deleteProgram(p));
        g.getExtension('WEBGL_lose_context')?.loseContext();
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
