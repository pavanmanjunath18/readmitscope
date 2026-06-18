import { useMemo, useRef, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const COUNT = 4200
const COLORS = ['#A78BFA', '#38BDF8', '#5EEAD4', '#22D3EE', '#C4B5FD'].map((c) => new THREE.Color(c))

/** A scroll value (0..1-ish) shared from the DOM scroll position. */
function useScrollRef() {
  const ref = useRef(0)
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      ref.current = max > 0 ? window.scrollY / max : 0
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return ref
}

function ParticleField({ scroll }: { scroll: React.MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null)
  const points = useRef<THREE.Points>(null)

  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3)
    const colors = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i++) {
      // Spherical shell with a little thickness.
      const r = 5.5 + Math.random() * 5
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)
      const col = COLORS[Math.floor(Math.random() * COLORS.length)]
      colors[i * 3] = col.r
      colors[i * 3 + 1] = col.g
      colors[i * 3 + 2] = col.b
    }
    return { positions, colors }
  }, [])

  useFrame((state, delta) => {
    if (!group.current) return
    // Gentle constant rotation + scroll-driven tilt.
    group.current.rotation.y += delta * 0.04
    const target = scroll.current * Math.PI * 0.8
    group.current.rotation.x += (target - group.current.rotation.x) * 0.05
    // Heartbeat-like breathing.
    const t = state.clock.elapsedTime
    const beat = 1 + Math.sin(t * 1.6) * 0.015 + Math.sin(t * 3.2) * 0.006
    group.current.scale.setScalar(beat)
    if (points.current) {
      (points.current.material as THREE.PointsMaterial).opacity =
        0.55 + Math.sin(t * 1.6) * 0.08
    }
  })

  return (
    <group ref={group}>
      <points ref={points}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.045}
          vertexColors
          transparent
          opacity={0.6}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {/* Faint central wireframe core — the "data nucleus". */}
      <mesh>
        <icosahedronGeometry args={[3, 1]} />
        <meshBasicMaterial color="#A78BFA" wireframe transparent opacity={0.10} />
      </mesh>
      <mesh rotation={[0.6, 0.3, 0]}>
        <icosahedronGeometry args={[4.2, 1]} />
        <meshBasicMaterial color="#5EEAD4" wireframe transparent opacity={0.05} />
      </mesh>
    </group>
  )
}

/** Hero-scoped 3D scene — fills its (relative) parent, sits behind the hero text. */
export default function HeroScene() {
  const scroll = useScrollRef()
  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 16], fov: 60 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
      >
        <ParticleField scroll={scroll} />
      </Canvas>
      {/* Fade the scene into the page below + keep hero text readable. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(110% 80% at 70% 30%, transparent 28%, rgba(7,7,14,0.7) 100%), linear-gradient(to bottom, transparent 58%, #07070E 100%)',
        }}
      />
    </div>
  )
}
