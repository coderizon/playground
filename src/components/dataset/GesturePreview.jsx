import React, { useEffect, useRef } from 'react';
import { detectHands } from '../../services/ml/handPoseService.js';

export function GesturePreview({ videoRef }) {
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
      className="gesture-overlay"
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
  ctx.strokeStyle = '#00ff00';
  ctx.lineWidth = 3;
  ctx.fillStyle = '#ff0000';

  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
    [0, 5], [5, 6], [6, 7], [7, 8],       // Index
    [9, 10], [10, 11], [11, 12],          // Middle (start from 9?)
    [13, 14], [14, 15], [15, 16],         // Ring
    [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
    [5, 9], [9, 13], [13, 17] // Palm base
  ];
  
  // Note: Palm connections might vary. Simple iteration is usually safer.
  // Standard MP Hand connections:
  const fingerChains = [
    [0, 1, 2, 3, 4],
    [0, 5, 6, 7, 8],
    [5, 9, 10, 11, 12], // 5-9 is partial palm
    [9, 13, 14, 15, 16],
    [13, 17, 18, 19, 20],
    [0, 17] // Close loop?
  ];
  
  // Let's use simple logic: draw lines between consecutive points for fingers, and base
  const fingers = [
    [0, 1, 2, 3, 4],
    [0, 5, 6, 7, 8],
    [9, 10, 11, 12],
    [13, 14, 15, 16],
    [17, 18, 19, 20],
  ];
  
  // Palm
  ctx.beginPath();
  ctx.moveTo(keypoints[0].x, keypoints[0].y);
  ctx.lineTo(keypoints[5].x, keypoints[5].y);
  ctx.lineTo(keypoints[9].x, keypoints[9].y);
  ctx.lineTo(keypoints[13].x, keypoints[13].y);
  ctx.lineTo(keypoints[17].x, keypoints[17].y);
  ctx.lineTo(keypoints[0].x, keypoints[0].y);
  ctx.stroke();

  fingers.forEach(chain => {
    ctx.beginPath();
    chain.forEach((idx, i) => {
      if (i === 0 && idx !== 0) ctx.moveTo(keypoints[idx].x, keypoints[idx].y); // Start of finger (if not wrist)
      else if (i === 0) ctx.moveTo(keypoints[idx].x, keypoints[idx].y);
      else ctx.lineTo(keypoints[idx].x, keypoints[idx].y);
    });
    ctx.stroke();
  });

  keypoints.forEach(kp => {
    ctx.beginPath();
    ctx.arc(kp.x, kp.y, 4, 0, 2 * Math.PI);
    ctx.fill();
  });
}
