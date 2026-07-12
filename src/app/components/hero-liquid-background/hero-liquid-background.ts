import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';

const VERTEX_SHADER = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 v_uv;
  uniform vec2 u_resolution;
  uniform vec2 u_pointer;
  uniform vec2 u_ripple;
  uniform float u_time;
  uniform float u_energy;
  uniform float u_rippleAge;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    value += noise(p) * 0.55;
    value += noise(p * 2.03 + 11.7) * 0.28;
    value += noise(p * 4.07 + 27.2) * 0.17;
    return value;
  }

  void main() {
    vec2 uv = v_uv;
    float aspect = u_resolution.x / max(u_resolution.y, 1.0);
    vec2 delta = uv - u_pointer;
    delta.x *= aspect;
    float radius = length(delta);
    float influence = exp(-radius * radius * 8.0) * u_energy;
    vec2 tangent = normalize(vec2(-delta.y, delta.x) + 0.0001);
    uv += tangent * influence * (0.075 + 0.025 * sin(radius * 34.0 - u_time * 4.0));
    uv += normalize(delta + 0.0001) * influence * 0.035 * sin(radius * 25.0 - u_time * 3.0);

    vec2 rippleDelta = uv - u_ripple;
    rippleDelta.x *= aspect;
    float rippleRadius = length(rippleDelta);
    float rippleTravel = u_rippleAge * 0.42;
    float rippleFade = 1.0 - smoothstep(0.0, 1.65, u_rippleAge);
    float ripple = exp(-pow((rippleRadius - rippleTravel) * 23.0, 2.0)) * rippleFade;
    uv += normalize(rippleDelta + 0.0001) * ripple * 0.055;

    float t = u_time * 0.12;
    float n = fbm(uv * 3.0 + vec2(t, -t * 0.7));
    float flow = fbm(uv * 5.2 + vec2(-t * 0.8, t) + n * 1.4);
    float sweep = smoothstep(-0.2, 1.15, uv.x * 0.72 + uv.y * 0.4 + (n - 0.5) * 0.55);

    vec3 deep = vec3(0.192, 0.063, 0.357);
    vec3 purple = vec3(0.322, 0.110, 0.600);
    vec3 violet = vec3(0.541, 0.220, 0.961);
    vec3 blue = vec3(0.0, 0.600, 1.0);
    vec3 color = mix(deep, purple, smoothstep(0.05, 0.78, n + sweep * 0.25));
    color = mix(color, violet, smoothstep(0.58, 0.94, flow) * 0.72);
    color = mix(color, blue, smoothstep(0.82, 1.0, sweep + flow * 0.18) * 0.34);
    color += influence * vec3(0.08, 0.025, 0.15);
    color += ripple * vec3(0.13, 0.045, 0.22);
    gl_FragColor = vec4(color, 1.0);
  }
`;

@Component({
  selector: 'app-hero-liquid-background',
  standalone: true,
  templateUrl: './hero-liquid-background.html',
  styleUrl: './hero-liquid-background.css',
})
export class HeroLiquidBackground implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) private readonly canvasRef!: ElementRef<HTMLCanvasElement>;

  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private visibilityObserver: IntersectionObserver | null = null;
  private rafId = 0;
  private startTime = performance.now();
  private visible = true;
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private pointer = { x: 0.5, y: 0.5 };
  private pointerTarget = { x: 0.5, y: 0.5 };
  private energy = 0;
  private energyTarget = 0;
  private ripple = { x: 0.5, y: 0.5 };
  private rippleStartedAt = -10000;
  private lastTrailRipple = 0;
  private resolutionLocation: WebGLUniformLocation | null = null;
  private pointerLocation: WebGLUniformLocation | null = null;
  private rippleLocation: WebGLUniformLocation | null = null;
  private timeLocation: WebGLUniformLocation | null = null;
  private energyLocation: WebGLUniformLocation | null = null;
  private rippleAgeLocation: WebGLUniformLocation | null = null;

  ngAfterViewInit(): void {
    if (!this.initialize()) return;
    const canvas = this.canvasRef.nativeElement;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.visibilityObserver = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if (this.visible && !this.reducedMotion && !this.rafId) this.rafId = requestAnimationFrame(this.render);
    });
    this.visibilityObserver.observe(canvas);
    canvas.addEventListener('pointermove', this.onPointerMove, { passive: true });
    canvas.addEventListener('pointerdown', this.onPointerDown, { passive: true });
    canvas.addEventListener('pointerleave', this.onPointerLeave, { passive: true });
    this.resize();
    this.render(performance.now());
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
    this.resizeObserver?.disconnect();
    this.visibilityObserver?.disconnect();
    const canvas = this.canvasRef.nativeElement;
    canvas.removeEventListener('pointermove', this.onPointerMove);
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointerleave', this.onPointerLeave);
    if (this.gl && this.program) this.gl.deleteProgram(this.program);
  }

  private initialize(): boolean {
    const canvas = this.canvasRef.nativeElement;
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'high-performance' });
    if (!gl) return false;
    const vertex = this.compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = this.compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertex || !fragment) return false;
    const program = gl.createProgram();
    if (!program) return false;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    this.gl = gl;
    this.program = program;
    this.resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
    this.pointerLocation = gl.getUniformLocation(program, 'u_pointer');
    this.rippleLocation = gl.getUniformLocation(program, 'u_ripple');
    this.timeLocation = gl.getUniformLocation(program, 'u_time');
    this.energyLocation = gl.getUniformLocation(program, 'u_energy');
    this.rippleAgeLocation = gl.getUniformLocation(program, 'u_rippleAge');
    return true;
  }

  private compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  private resize(): void {
    if (!this.gl) return;
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      this.gl.viewport(0, 0, width, height);
    }
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    this.pointerTarget = { x: (event.clientX - rect.left) / rect.width, y: 1 - (event.clientY - rect.top) / rect.height };
    this.energyTarget = 1;
    const now = performance.now();
    if (now - this.lastTrailRipple > 240) {
      this.triggerRipple(this.pointerTarget.x, this.pointerTarget.y, now);
      this.lastTrailRipple = now;
    }
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    this.triggerRipple((event.clientX - rect.left) / rect.width, 1 - (event.clientY - rect.top) / rect.height, performance.now());
  };

  private triggerRipple(x: number, y: number, now: number): void {
    this.ripple = { x, y };
    this.rippleStartedAt = now;
  }

  private readonly onPointerLeave = (): void => { this.energyTarget = 0; };

  private readonly render = (now: number): void => {
    this.rafId = 0;
    if (!this.gl || !this.program) return;
    this.pointer.x += (this.pointerTarget.x - this.pointer.x) * 0.12;
    this.pointer.y += (this.pointerTarget.y - this.pointer.y) * 0.12;
    this.energy += (this.energyTarget - this.energy) * 0.08;
    this.energyTarget *= 0.985;
    const canvas = this.canvasRef.nativeElement;
    this.gl.uniform2f(this.resolutionLocation, canvas.width, canvas.height);
    this.gl.uniform2f(this.pointerLocation, this.pointer.x, this.pointer.y);
    this.gl.uniform2f(this.rippleLocation, this.ripple.x, this.ripple.y);
    this.gl.uniform1f(this.timeLocation, this.reducedMotion ? 0 : (now - this.startTime) / 1000);
    this.gl.uniform1f(this.energyLocation, this.reducedMotion ? 0 : this.energy);
    this.gl.uniform1f(this.rippleAgeLocation, this.reducedMotion ? 10 : (now - this.rippleStartedAt) / 1000);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    if (this.visible && !this.reducedMotion) this.rafId = requestAnimationFrame(this.render);
  };
}
