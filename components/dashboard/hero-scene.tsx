"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

export function HeroScene() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000)
    camera.position.set(0, 0, 28)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)

    const accentColor = new THREE.Color(0x14b8a6)
    const secondaryColor = new THREE.Color(0x22d3ee)

    // === CENTRAL GLOBE (positioned at center of viewport) ===
    const globeGeometry = new THREE.IcosahedronGeometry(9, 3)
    const globeMaterial = new THREE.MeshBasicMaterial({
      color: accentColor,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
    })
    const globe = new THREE.Mesh(globeGeometry, globeMaterial)
    globe.position.set(0, 0, -5)
    scene.add(globe)

    // Inner globe
    const innerGlobeGeometry = new THREE.IcosahedronGeometry(7, 2)
    const innerGlobeMaterial = new THREE.MeshBasicMaterial({
      color: secondaryColor,
      wireframe: true,
      transparent: true,
      opacity: 0.08,
    })
    const innerGlobe = new THREE.Mesh(innerGlobeGeometry, innerGlobeMaterial)
    innerGlobe.position.set(0, 0, -5)
    scene.add(innerGlobe)

    // Core glow sphere
    const coreGeometry = new THREE.SphereGeometry(3, 32, 32)
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: accentColor,
      transparent: true,
      opacity: 0.04,
    })
    const core = new THREE.Mesh(coreGeometry, coreMaterial)
    core.position.set(0, 0, -5)
    scene.add(core)

    // Orbital rings
    for (let i = 0; i < 3; i++) {
      const ringGeometry = new THREE.TorusGeometry(10 + i * 2, 0.04, 16, 120)
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: i === 0 ? accentColor : secondaryColor,
        transparent: true,
        opacity: 0.12 - i * 0.03,
      })
      const ring = new THREE.Mesh(ringGeometry, ringMaterial)
      ring.position.set(0, 0, -5)
      ring.rotation.x = Math.PI * (0.2 + i * 0.25)
      ring.rotation.y = i * 0.5
      ring.userData = { speed: 0.06 + i * 0.02, axis: i }
      scene.add(ring)
    }

    // === PARTICLES ===
    const particleCount = 200
    const particlesGeometry = new THREE.BufferGeometry()
    const positions = new Float32Array(particleCount * 3)
    const colors = new Float32Array(particleCount * 3)

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 70
      positions[i * 3 + 1] = (Math.random() - 0.5) * 50
      positions[i * 3 + 2] = (Math.random() - 0.5) * 40 - 5

      const color = Math.random() > 0.6 ? accentColor : secondaryColor
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }

    particlesGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    particlesGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3))

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
    })
    const particles = new THREE.Points(particlesGeometry, particleMaterial)
    scene.add(particles)

    // === CONNECTION LINES ===
    const linesMaterial = new THREE.LineBasicMaterial({
      color: accentColor,
      transparent: true,
      opacity: 0.05,
    })
    const linesGroup = new THREE.Group()
    scene.add(linesGroup)

    // Build initial connections
    function buildConnections() {
      while (linesGroup.children.length > 0) {
        const child = linesGroup.children[0]
        linesGroup.remove(child)
        if (child instanceof THREE.Line) child.geometry.dispose()
      }
      const posArray = particlesGeometry.attributes.position.array as Float32Array
      for (let i = 0; i < 60; i++) {
        for (let j = i + 1; j < 60; j++) {
          const dx = posArray[i * 3] - posArray[j * 3]
          const dy = posArray[i * 3 + 1] - posArray[j * 3 + 1]
          const dz = posArray[i * 3 + 2] - posArray[j * 3 + 2]
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
          if (dist < 10) {
            const lineGeometry = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(posArray[i * 3], posArray[i * 3 + 1], posArray[i * 3 + 2]),
              new THREE.Vector3(posArray[j * 3], posArray[j * 3 + 1], posArray[j * 3 + 2]),
            ])
            linesGroup.add(new THREE.Line(lineGeometry, linesMaterial))
          }
        }
      }
    }
    buildConnections()

    // === ORBITING DOTS on globe surface ===
    const orbitDots: THREE.Mesh[] = []
    for (let i = 0; i < 8; i++) {
      const dotGeometry = new THREE.SphereGeometry(0.15, 8, 8)
      const dotMaterial = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? accentColor : secondaryColor,
        transparent: true,
        opacity: 0.8,
      })
      const dot = new THREE.Mesh(dotGeometry, dotMaterial)
      dot.userData = {
        theta: Math.random() * Math.PI * 2,
        phi: Math.random() * Math.PI,
        speed: 0.2 + Math.random() * 0.3,
        radius: 9.2,
      }
      scene.add(dot)
      orbitDots.push(dot)
    }

    // Mouse interaction
    let mouseX = 0
    let mouseY = 0
    function onMouseMove(event: MouseEvent) {
      mouseX = (event.clientX / window.innerWidth - 0.5) * 2
      mouseY = (event.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener("mousemove", onMouseMove)

    // Animation
    const clock = new THREE.Clock()
    let animationId: number

    function animate() {
      animationId = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()

      // Rotate globe
      globe.rotation.y = t * 0.08
      globe.rotation.x = Math.sin(t * 0.03) * 0.1
      innerGlobe.rotation.y = -t * 0.12
      innerGlobe.rotation.x = Math.cos(t * 0.04) * 0.15

      // Pulse core
      const pulse = 1 + Math.sin(t * 1.5) * 0.1
      core.scale.set(pulse, pulse, pulse)

      // Rotate rings
      scene.children.forEach((child) => {
        if (child.userData.speed) {
          child.rotation.z += child.userData.speed * 0.01
        }
      })

      // Orbit dots
      orbitDots.forEach((dot) => {
        const d = dot.userData
        d.theta += d.speed * 0.01
        dot.position.x = Math.sin(d.phi) * Math.cos(d.theta) * d.radius
        dot.position.y = Math.cos(d.phi) * d.radius
        dot.position.z = Math.sin(d.phi) * Math.sin(d.theta) * d.radius - 5
      })

      // Particles drift
      particles.rotation.y = t * 0.015
      particles.rotation.x = t * 0.005

      // Camera follows mouse
      camera.position.x += (mouseX * 4 - camera.position.x) * 0.015
      camera.position.y += (-mouseY * 3 - camera.position.y) * 0.015
      camera.lookAt(0, 0, -5)

      renderer.render(scene, camera)
    }
    animate()

    function onResize() {
      if (!container) return
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    }
    window.addEventListener("resize", onResize)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("resize", onResize)
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ pointerEvents: "none" }}
    />
  )
}
