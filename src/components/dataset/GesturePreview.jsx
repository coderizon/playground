import React, { useEffect, useRef } from 'react';
import { detectHands } from '../../services/ml/handPoseService.js';

export function GesturePreview({ videoRef, isMirrored }) {
  const canvasRef = useRef(null);
  const loopRef = useRef(null);

  useEffect(() => {
    const loop = async () => {
      if (!videoRef.current || !canvasRef.current) {
        loopRef.current = requestAnimationFrame(loop);
        return;
      }
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (video.readyState >= 2) {
        // Sync canvas internal resolution to video source resolution
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        const hands = await detectHands(video);
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw hands
        hands.forEach(hand => {
          if (hand.keypoints) {
            drawHand(ctx, hand.keypoints);
          }
        });
      }
      
      loopRef.current = requestAnimationFrame(loop);
    };
    
    loopRef.current = requestAnimationFrame(loop);
    return () => {
      if (loopRef.current) cancelAnimationFrame(loopRef.current);
    };
  }, [videoRef]);

  return (
    <canvas 
      ref={canvasRef} 
      className={`gesture-overlay ${isMirrored ? 'is-mirrored' : ''}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        objectFit: 'cover' // Matches .dataset-preview video
      }}
    />
  );
}

function drawHand(ctx, keypoints) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const x = (pt) => (pt.x || 0) * w;
  const y = (pt) => (pt.y || 0) * h;

  ctx.strokeStyle = '#00ff00';
  ctx.lineWidth = 3;
  ctx.fillStyle = '#ff0000';

  const fingers = [
    [0, 1, 2, 3, 4],
    [0, 5, 6, 7, 8],
    [9, 10, 11, 12],
    [13, 14, 15, 16],
    [17, 18, 19, 20],
  ];
  
  // Palm
  ctx.beginPath();
  ctx.moveTo(x(keypoints[0]), y(keypoints[0]));
  ctx.lineTo(x(keypoints[5]), y(keypoints[5]));
  ctx.lineTo(x(keypoints[9]), y(keypoints[9]));
  ctx.lineTo(x(keypoints[13]), y(keypoints[13]));
  ctx.lineTo(x(keypoints[17]), y(keypoints[17]));
  ctx.lineTo(x(keypoints[0]), y(keypoints[0]));
  ctx.stroke();

  fingers.forEach(chain => {
    ctx.beginPath();
    chain.forEach((idx, i) => {
      if (i === 0 && idx !== 0) ctx.moveTo(x(keypoints[idx]), y(keypoints[idx]));
      else if (i === 0) ctx.moveTo(x(keypoints[idx]), y(keypoints[idx]));
      else ctx.lineTo(x(keypoints[idx]), y(keypoints[idx]));
    });
    ctx.stroke();
  });

  keypoints.forEach(kp => {
    ctx.beginPath();
    ctx.arc(x(kp), y(kp), 4, 0, 2 * Math.PI);
    ctx.fill();
  });
}
