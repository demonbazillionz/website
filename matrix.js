// Ultra-smooth Matrix-rain background - optimized for 60fps fluid motion
(function(){
  const canvas = document.getElementById('matrix-canvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true });

  let width, height, columns, drops, opacityCache = new Map();
  let frameCount = 0;

  const chars = 'アァカサタナハマヤャラワン0123456789ABCDEF@#$%&*-:;",.()+={}[]<>/\\|─—';
  const charLen = chars.length;
  const FONT_HEIGHT = 25;
  const COLUMN_WIDTH = 25; // Optimal column spacing
  const BASE_SPEED = 1.2; // Smooth base speed (pixels per frame)

  function getRandomChar(){
    return chars[Math.floor(Math.random() * charLen)];
  }

  function createDrop(){
    return {
      y: Math.random() * -height, // Start above screen for staggered effect
      char: getRandomChar(),
      baseSpeed: Math.random() * 0.35 + 0.65, // More natural speed variation
      speedVariance: Math.sin(Math.random() * Math.PI) * 0.3, // Smooth acceleration curve
      trailLength: Math.floor(Math.random() * 10) + 15 // Trail character count
    };
  }

  function resize(){
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    columns = Math.ceil(width / COLUMN_WIDTH);
    drops = new Array(columns).fill(1).map(() => createDrop());
    opacityCache.clear();
  }

  function getOpacitySmooth(yPos, trailLen){
    const screenHeightChars = height / FONT_HEIGHT;
    
    // Smooth fade in over first 8 chars
    const fadeInStart = 8;
    const fadeInAlpha = Math.min(1, Math.max(0, yPos / fadeInStart));
    
    // Smooth fade out over last 12 chars
    const fadeOutStart = screenHeightChars - 12;
    const fadeOutAlpha = Math.max(0, Math.min(1, (screenHeightChars - yPos) / 12));
    
    // Trail effect - brighter leading edge
    const trailFade = Math.max(0, 1 - (yPos % trailLen) / trailLen);
    
    return fadeInAlpha * fadeOutAlpha * (0.3 + trailFade * 0.7);
  }

  function draw(){
    frameCount++;
    
    // Ultra-smooth clear with minimal visual artifacts
    ctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
    ctx.fillRect(0, 0, width, height);
    
    ctx.font = 'bold 14px "JetBrains Mono", monospace';
    ctx.textBaseline = 'top';
    
    const screenHeightChars = height / FONT_HEIGHT;
    
    for(let i = 0; i < columns; i++){
      const drop = drops[i];
      
      // Smooth speed variation using sine wave for natural acceleration
      const speedModifier = 1 + Math.sin(frameCount * 0.01 + i) * 0.15;
      drop.y += BASE_SPEED * drop.baseSpeed * speedModifier;
      
      const x = i * COLUMN_WIDTH;
      const pixelY = drop.y * FONT_HEIGHT;
      
      // Skip if completely off screen
      if(pixelY > height || drop.y < -5) {
        // Reset when falling off screen to keep continuous flow
        if(drop.y > screenHeightChars + 5){
          drops[i] = createDrop();
        }
        continue;
      }
      
      // Render trail of characters for smooth streaming effect
      for(let t = 0; t < drop.trailLength; t++){
        const trailY = drop.y - (t * 0.8); // Trailing offset
        if(trailY < -1) continue;
        
        const trailPixelY = trailY * FONT_HEIGHT;
        if(trailPixelY > height) continue;
        
        const opacity = getOpacitySmooth(trailY, drop.trailLength);
        if(opacity < 0.02) continue;
        
        // Glow effect only on leading character (performance optimized)
        if(t === 0 && opacity > 0.6){
          ctx.shadowBlur = 10;
          ctx.shadowColor = `rgba(0, 255, 136, ${opacity * 0.6})`;
        } else {
          ctx.shadowBlur = 0;
        }
        
        ctx.fillStyle = `rgba(0, 255, 136, ${opacity})`;
        ctx.fillText(getRandomChar(), x, trailPixelY);
      }
      
      ctx.shadowBlur = 0;
      
      // Occasionally change leading character for authenticity
      if(frameCount % 25 === 0){
        drop.char = getRandomChar();
      }
    }
    
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  setTimeout(()=>{ resize(); draw(); }, 50);
})();
