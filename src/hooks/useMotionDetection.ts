import { useEffect, useRef, useState } from 'react';

const SAMPLE_INTERVAL_MS = 400;
const MOTION_THRESHOLD = 18; // average per-pixel brightness delta to count as motion
const IDLE_AFTER_MS = 8000; // return to screensaver this long after motion stops

/**
 * Real device would use a proper motion sensor or the camera driver's own
 * motion events. This is a lightweight software approximation: sample the
 * camera at low resolution, diff consecutive frames, and treat a big enough
 * average change as motion. Good enough for a web prototype; the real
 * Android panel should use its motion sensor instead.
 */
export function useMotionDetection(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [hasMotion, setHasMotion] = useState(false);
  const lastMotionAt = useRef(0);
  const canvasRef = useRef(document.createElement('canvas'));
  const prevFrame = useRef<Uint8ClampedArray | null>(null);

  useEffect(() => {
    let interval: number;

    function sample() {
      const video = videoRef.current;
      if (!video || video.readyState < video.HAVE_CURRENT_DATA) return;

      const canvas = canvasRef.current;
      canvas.width = 48;
      canvas.height = 36;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

      if (prevFrame.current) {
        let diffSum = 0;
        for (let i = 0; i < frame.length; i += 4) {
          diffSum += Math.abs(frame[i] - prevFrame.current[i]);
        }
        const avgDiff = diffSum / (frame.length / 4);
        if (avgDiff > MOTION_THRESHOLD) {
          lastMotionAt.current = Date.now();
          setHasMotion(true);
        } else if (Date.now() - lastMotionAt.current > IDLE_AFTER_MS) {
          setHasMotion(false);
        }
      }
      prevFrame.current = frame;
    }

    interval = window.setInterval(sample, SAMPLE_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [videoRef]);

  return hasMotion;
}
