"use client";

import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

export interface PoseProps {
  headRotation: number;
  bodyTilt: number;
  leftArm: number;
  rightArm: number;
  leftLeg: number;
  rightLeg: number;
}

const C = {
  head:     "#f5c400",
  spine:    "#f0f0f0",
  shoulder: "#888888",
  leftArm:  "#f5c400",
  rightArm: "#f0f0f0",
  hip:      "#555555",
  leftLeg:  "#f5c400",
  rightLeg: "#f0f0f0",
  joint:    "#f5c400",
};

function Limb({
  from, to, radius = 0.045, color,
}: {
  from: [number, number, number];
  to:   [number, number, number];
  radius?: number;
  color: string;
}) {
  const dir    = new THREE.Vector3(...to).sub(new THREE.Vector3(...from));
  const length = dir.length();
  const mid    = new THREE.Vector3(...from)
    .add(new THREE.Vector3(...to))
    .multiplyScalar(0.5);
  const quat = new THREE.Quaternion();
  quat.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.clone().normalize()
  );

  return (
    <mesh position={[mid.x, mid.y, mid.z]} quaternion={quat}>
      <cylinderGeometry args={[radius, radius, length, 12]} />
      <meshStandardMaterial color={color} roughness={0.4} metalness={0.1} />
    </mesh>
  );
}

function Joint({
  pos, r = 0.07, color,
}: {
  pos: [number, number, number];
  r?: number;
  color: string;
}) {
  return (
    <mesh position={pos}>
      <sphereGeometry args={[r, 16, 16]} />
      <meshStandardMaterial
        color={color}
        roughness={0.3}
        emissive={color}
        emissiveIntensity={0.25}
      />
    </mesh>
  );
}

function StickmanModel({ pose }: { pose: PoseProps }) {
  const torsoRef = useRef<THREE.Group>(null);
  const lArmRef  = useRef<THREE.Group>(null);
  const rArmRef  = useRef<THREE.Group>(null);
  const lLegRef  = useRef<THREE.Group>(null);
  const rLegRef  = useRef<THREE.Group>(null);
  const headRef  = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const lerp = (
      ref: React.RefObject<THREE.Group | THREE.Mesh | null>,
      axis: "x" | "y" | "z",
      target: number
    ) => {
      if (!ref.current) return;
      ref.current.rotation[axis] = THREE.MathUtils.lerp(
        ref.current.rotation[axis],
        (target * Math.PI) / 180,
        0.12
      );
    };
    lerp(torsoRef, "z", pose.bodyTilt);
    lerp(headRef,  "y", pose.headRotation);
    lerp(lArmRef,  "z", pose.leftArm);
    lerp(rArmRef,  "z", pose.rightArm);
    lerp(lLegRef,  "z", pose.leftLeg);
    lerp(rLegRef,  "z", pose.rightLeg);
  });

  const hip:  [number, number, number] = [0,     0.6,  0];
  const waist:[number, number, number] = [0,     1.2,  0];
  const chest:[number, number, number] = [0,     1.8,  0];
  const neck: [number, number, number] = [0,     2.0,  0];
  const lSh:  [number, number, number] = [-0.42, 1.78, 0];
  const rSh:  [number, number, number] = [ 0.42, 1.78, 0];
  const lHip: [number, number, number] = [-0.22, 0.6,  0];
  const rHip: [number, number, number] = [ 0.22, 0.6,  0];

  return (
    <group position={[0, -1.0, 0]}>
      {/* Torso group */}
      <group ref={torsoRef}>
        <Limb from={hip}   to={waist} color={C.spine}    radius={0.05} />
        <Limb from={waist} to={chest} color={C.spine}    radius={0.05} />
        <Limb from={chest} to={neck}  color={C.spine}    radius={0.04} />
        <Limb from={lSh}   to={rSh}   color={C.shoulder} radius={0.035} />

        {/* Head */}
        <mesh ref={headRef} position={[0, 2.22, 0]}>
          <sphereGeometry args={[0.22, 28, 28]} />
          <meshStandardMaterial
            color={C.head}
            roughness={0.3}
            emissive={C.head}
            emissiveIntensity={0.2}
          />
        </mesh>

        {/* Left arm */}
        <group ref={lArmRef} position={lSh}>
          <Limb from={[0,0,0]}    to={[0,-0.85,0]} color={C.leftArm} />
          <Joint pos={[0,-0.85,0]} color={C.joint} r={0.06} />
          <Limb from={[0,-0.85,0]} to={[0,-1.55,0]} color={C.leftArm} radius={0.038} />
          <Joint pos={[0,-1.55,0]} color={C.joint} r={0.05} />
        </group>

        {/* Right arm */}
        <group ref={rArmRef} position={rSh}>
          <Limb from={[0,0,0]}    to={[0,-0.85,0]} color={C.rightArm} />
          <Joint pos={[0,-0.85,0]} color={C.joint} r={0.06} />
          <Limb from={[0,-0.85,0]} to={[0,-1.55,0]} color={C.rightArm} radius={0.038} />
          <Joint pos={[0,-1.55,0]} color={C.joint} r={0.05} />
        </group>

        <Joint pos={lSh} color={C.joint} />
        <Joint pos={rSh} color={C.joint} />
        <Joint pos={hip} color={C.joint} r={0.06} />
      </group>

      {/* Hip bar */}
      <Limb from={lHip} to={rHip} color={C.hip} radius={0.04} />
      <Joint pos={lHip} color={C.joint} r={0.05} />
      <Joint pos={rHip} color={C.joint} r={0.05} />

      {/* Left leg */}
      <group ref={lLegRef} position={lHip}>
        <Limb from={[0,0,0]}    to={[0,-1.0,0]}  color={C.leftLeg} />
        <Joint pos={[0,-1.0,0]} color={C.joint} r={0.06} />
        <Limb from={[0,-1.0,0]} to={[0,-1.9,0]}  color={C.leftLeg} radius={0.038} />
        <Joint pos={[0,-1.9,0]} color={C.joint} r={0.05} />
        <Limb from={[0,-1.9,0]} to={[-0.12,-1.9,0.22]} color={C.leftLeg} radius={0.032} />
      </group>

      {/* Right leg */}
      <group ref={rLegRef} position={rHip}>
        <Limb from={[0,0,0]}    to={[0,-1.0,0]}  color={C.rightLeg} />
        <Joint pos={[0,-1.0,0]} color={C.joint} r={0.06} />
        <Limb from={[0,-1.0,0]} to={[0,-1.9,0]}  color={C.rightLeg} radius={0.038} />
        <Joint pos={[0,-1.9,0]} color={C.joint} r={0.05} />
        <Limb from={[0,-1.9,0]} to={[0.12,-1.9,0.22]} color={C.rightLeg} radius={0.032} />
      </group>
    </group>
  );
}

export default function Stickman({ pose }: { pose: PoseProps }) {
  const controlsRef = useRef<any>(null);

  return (
    <div className="relative w-full h-72 rounded-xl overflow-hidden bg-black border border-line">
      {/* Corner brackets */}
      <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-yellow/50 pointer-events-none z-10" />
      <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-yellow/50 pointer-events-none z-10" />
      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-yellow/50 pointer-events-none z-10" />
      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-yellow/50 pointer-events-none z-10" />

      <Canvas
        camera={{ position: [0, 1, 5], fov: 48 }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[4, 8, 4]}   intensity={1.6} color="#ffffff" />
        <directionalLight position={[-4, 2, -4]}  intensity={0.4} color="#f5c400" />
        <pointLight       position={[0, 3, 2]}    intensity={0.8} color="#f5c400" />

        <StickmanModel pose={pose} />

        <gridHelper
          args={[10, 20, "#2a2a2a", "#1a1a1a"]}
          position={[0, -2.0, 0]}
        />

        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          enableZoom={true}
          minDistance={3}
          maxDistance={9}
          target={[0, 0, 0]}
        />
      </Canvas>

      <button
        onClick={() => controlsRef.current?.reset()}
        className="absolute bottom-2.5 right-2.5 font-mono text-xs text-grey2 bg-card border border-line px-2 py-1 rounded hover:text-yellow hover:border-yellow/40 transition-colors z-10"
      >
        RESET
      </button>
      <div className="absolute bottom-2.5 left-2.5 font-mono text-xs text-grey2 pointer-events-none z-10">
        DRAG TO ROTATE
      </div>
    </div>
  );
}