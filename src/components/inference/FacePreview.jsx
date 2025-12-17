import React, { useEffect, useRef } from 'react';
import { detectFace, drawFaceLandmarks } from '../../services/ml/faceLandmarkService.js';

export function FacePreview({ videoRef, isActive, onBlendshapes, isMirrored }) {
  const canvasRef = useRef(null);
  const loopRef = useRef(null);

  useEffect(() => {
    if (!isActive) {
      if (loopRef.current) {
        cancelAnimationFrame(loopRef.current);
        loopRef.current = null;
      }
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      onBlendshapes?.([]);
      return;
    }

    let cancelled = false;
    const loop = async () => {
      if (!isActive || cancelled) return;
      if (!videoRef.current || !canvasRef.current) {
        loopRef.current = requestAnimationFrame(loop);
        return;
      }
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (video.readyState >= 2) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        const result = await detectFace(video, Date.now());
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (result) {
          drawFaceLandmarks(ctx, result);
          const categories = result.faceBlendshapes?.[0]?.categories;
          if (Array.isArray(categories)) {
            onBlendshapes?.(categories);
          } else {
            onBlendshapes?.([]);
          }
        } else {
          onBlendshapes?.([]);
        }
      }
      
      loopRef.current = requestAnimationFrame(loop);
    };
    
    loopRef.current = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      if (loopRef.current) {
        cancelAnimationFrame(loopRef.current);
        loopRef.current = null;
      }
    };
  }, [videoRef, isActive, onBlendshapes]);

  return (
    <canvas 
      ref={canvasRef} 
      className={`face-overlay ${isMirrored ? 'is-mirrored' : ''}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        objectFit: 'cover'
      }}
    />
  );
}
