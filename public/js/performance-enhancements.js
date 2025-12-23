// ============================================
// 🚀 PERFORMANCE & STABILITY ENHANCEMENTS
// Prevents lag, memory leaks, and improves UX
// v2.1.0 - Nevermore Games
// ============================================

(function() {
  'use strict';
  
  // ============================================
  // PERFORMANCE MONITORING
  // ============================================
  
  const performanceMonitor = {
    frameCount: 0,
    lastTime: performance.now(),
    fps: 60,
    lowFpsWarningShown: false,
    
    // Track FPS
    tick: function() {
      this.frameCount++;
      const now = performance.now();
      const delta = now - this.lastTime;
      
      if (delta >= 1000) {
        this.fps = Math.round((this.frameCount * 1000) / delta);
        this.frameCount = 0;
        this.lastTime = now;
        
        // Warn if FPS drops too low
        if (this.fps < 30 && !this.lowFpsWarningShown) {
          console.warn('⚠️ Low FPS detected:', this.fps);
          this.lowFpsWarningShown = true;
          // Reduce particle count for better performance
          reduceParticles();
        }
      }
      
      requestAnimationFrame(() => this.tick());
    },
    
    start: function() {
      requestAnimationFrame(() => this.tick());
    }
  };
  
  // ============================================
  // PARTICLE OPTIMIZATION
  // ============================================
  
  function reduceParticles() {
    const particles = document.querySelectorAll('.particle');
    // Keep only half the particles on low-end devices
    particles.forEach((particle, index) => {
      if (index % 2 === 0) {
        particle.style.display = 'none';
      }
    });
    console.log('🎨 Reduced particles for better performance');
  }
  
  // Check if device is low-end
  function isLowEndDevice() {
    // Check for low memory (if available)
    if (navigator.deviceMemory && navigator.deviceMemory < 4) {
      return true;
    }
    // Check for slow connection
    if (navigator.connection) {
      const conn = navigator.connection;
      if (conn.saveData || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') {
        return true;
      }
    }
    // Check for reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return true;
    }
    return false;
  }
  
  // ============================================
  // MEMORY LEAK PREVENTION
  // ============================================
  
  // Track active intervals and timeouts
  const activeTimers = {
    intervals: new Set(),
    timeouts: new Set()
  };
  
  // Wrap setInterval to track
  const originalSetInterval = window.setInterval;
  window.setInterval = function(callback, delay, ...args) {
    const id = originalSetInterval(callback, delay, ...args);
    activeTimers.intervals.add(id);
    return id;
  };
  
  // Wrap clearInterval to track
  const originalClearInterval = window.clearInterval;
  window.clearInterval = function(id) {
    activeTimers.intervals.delete(id);
    return originalClearInterval(id);
  };
  
  // Wrap setTimeout to track
  const originalSetTimeout = window.setTimeout;
  window.setTimeout = function(callback, delay, ...args) {
    const id = originalSetTimeout(() => {
      activeTimers.timeouts.delete(id);
      callback(...args);
    }, delay);
    activeTimers.timeouts.add(id);
    return id;
  };
  
  // Clear all timers (useful when leaving game)
  window.clearAllTimers = function() {
    activeTimers.intervals.forEach(id => originalClearInterval(id));
    activeTimers.timeouts.forEach(id => clearTimeout(id));
    activeTimers.intervals.clear();
    activeTimers.timeouts.clear();
    console.log('🧹 Cleared all timers');
  };
  
  // ============================================
  // ERROR BOUNDARY
  // ============================================
  
  // Track if page has fully loaded
  let pageFullyLoaded = false;
  window.addEventListener('load', () => {
    // Wait a bit after load to avoid catching initialization errors
    setTimeout(() => {
      pageFullyLoaded = true;
    }, 2000);
  });
  
  window.onerror = function(message, source, lineno, colno, error) {
    // Only log errors, don't show toast during page load
    console.warn('🚨 Global error caught:', { message, source, lineno, colno, error });
    
    // Don't show error toast for minor issues or during page load
    const ignoredErrors = [
      'ResizeObserver loop',
      'Script error',
      'Loading chunk',
      'Network Error',
      'undefined',
      'null',
      'Cannot read',
      'is not defined',
      'socket',
      'Socket',
      'fetch',
      'Failed to fetch',
      'AbortError',
      'timeout',
      'cross-origin'
    ];
    
    // Always suppress during initial load
    if (!pageFullyLoaded) {
      return true;
    }
    
    if (message && ignoredErrors.some(ignored => String(message).toLowerCase().includes(ignored.toLowerCase()))) {
      return true; // Suppress
    }
    
    // Don't show toast - just log to console
    // The app has its own error handling for user-facing errors
    // if (typeof showError === 'function') {
    //   showError('Something went wrong. Please refresh if issues persist.');
    // }
    
    return false;
  };
  
  window.onunhandledrejection = function(event) {
    // Just log, don't show any toast - the app handles its own errors
    console.warn('🚨 Unhandled promise rejection:', event.reason);
    // Suppress all - let the app's own error handling deal with user-facing errors
    event.preventDefault();
    return true;
  };
  
  // ============================================
  // TOUCH EVENT IMPROVEMENTS
  // ============================================
  
  // Debounce function for performance
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  
  // Throttle function for scroll/resize events
  function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
  
  // Export utilities
  window.debounce = debounce;
  window.throttle = throttle;
  
  // ============================================
  // VISIBILITY CHANGE HANDLER
  // ============================================
  
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Page is hidden - reduce activity
      console.log('📴 Page hidden - reducing activity');
      // Pause non-essential animations
      document.querySelectorAll('.particle').forEach(p => {
        p.style.animationPlayState = 'paused';
      });
    } else {
      // Page is visible again
      console.log('📱 Page visible - resuming activity');
      document.querySelectorAll('.particle').forEach(p => {
        p.style.animationPlayState = 'running';
      });
    }
  });
  
  // ============================================
  // SCROLL PERFORMANCE
  // ============================================
  
  // Use passive event listeners for scroll
  document.addEventListener('scroll', throttle(() => {
    // Handle scroll events
  }, 100), { passive: true });
  
  document.addEventListener('touchstart', () => {}, { passive: true });
  document.addEventListener('touchmove', () => {}, { passive: true });
  
  // ============================================
  // IMAGE LAZY LOADING
  // ============================================
  
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            observer.unobserve(img);
          }
        }
      });
    });
    
    // Observe images with data-src attribute
    document.querySelectorAll('img[data-src]').forEach(img => {
      imageObserver.observe(img);
    });
  }
  
  // ============================================
  // NETWORK STATUS
  // ============================================
  
  window.addEventListener('online', () => {
    console.log('🌐 Back online');
    if (typeof showNotification === 'function') {
      showNotification('Back online!', 'success');
    }
    // Attempt to reconnect socket
    if (typeof socket !== 'undefined' && !socket.connected) {
      socket.connect();
    }
  });
  
  window.addEventListener('offline', () => {
    console.log('📴 Gone offline');
    if (typeof showNotification === 'function') {
      showNotification('You are offline. Some features may not work.', 'warning');
    }
  });
  
  // ============================================
  // PREVENT ZOOM ON DOUBLE TAP (iOS)
  // ============================================
  
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      // Check if it's an input field - allow zoom there
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
      }
    }
    lastTouchEnd = now;
  }, { passive: false });
  
  // ============================================
  // HAPTIC FEEDBACK (if supported)
  // ============================================
  
  window.hapticFeedback = function(type = 'light') {
    if ('vibrate' in navigator) {
      switch(type) {
        case 'light':
          navigator.vibrate(10);
          break;
        case 'medium':
          navigator.vibrate(25);
          break;
        case 'heavy':
          navigator.vibrate(50);
          break;
        case 'success':
          navigator.vibrate([10, 50, 10]);
          break;
        case 'error':
          navigator.vibrate([50, 30, 50]);
          break;
      }
    }
  };
  
  // Add haptic feedback to buttons
  document.addEventListener('click', (e) => {
    if (e.target.matches('.btn, .game-card, button')) {
      hapticFeedback('light');
    }
  });
  
  // ============================================
  // INITIALIZATION
  // ============================================
  
  document.addEventListener('DOMContentLoaded', () => {
    // Start performance monitoring
    performanceMonitor.start();
    
    // Reduce particles on low-end devices
    if (isLowEndDevice()) {
      reduceParticles();
      console.log('📱 Low-end device detected - optimizations applied');
    }
    
    console.log('🚀 Performance enhancements loaded');
  });
  
})();
