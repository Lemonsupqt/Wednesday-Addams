// Simple global auth functions - guaranteed to work with onclick handlers
function showLoginForm() {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginTab = document.getElementById('loginTab');
  const registerTab = document.getElementById('registerTab');
  
  if (loginForm) loginForm.style.display = 'flex';
  if (registerForm) registerForm.style.display = 'none';
  if (loginTab) loginTab.classList.add('active');
  if (registerTab) registerTab.classList.remove('active');
}

function showRegisterForm() {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginTab = document.getElementById('loginTab');
  const registerTab = document.getElementById('registerTab');
  
  if (loginForm) loginForm.style.display = 'none';
  if (registerForm) registerForm.style.display = 'flex';
  if (loginTab) loginTab.classList.remove('active');
  if (registerTab) registerTab.classList.add('active');
}

function handleLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  
  if (!username || !password) {
    alert('⚠️ Please enter username and password');
    return;
  }
  
  if (typeof socket !== 'undefined' && socket.connected) {
    socket.emit('login', { username, password });
  } else {
    alert('⚠️ Not connected to server. Please refresh the page.');
  }
}

function handleRegister() {
  const username = document.getElementById('registerUsername').value.trim();
  const password = document.getElementById('registerPassword').value;
  const displayName = document.getElementById('registerDisplayName').value.trim();
  
  if (!username || !password) {
    alert('⚠️ Please enter username and password');
    return;
  }
  
  if (username.length < 3) {
    alert('⚠️ Username must be at least 3 characters');
    return;
  }
  
  if (password.length < 4) {
    alert('⚠️ Password must be at least 4 characters');
    return;
  }
  
  if (typeof socket !== 'undefined' && socket.connected) {
    socket.emit('register', { username, password, displayName: displayName || username });
  } else {
    alert('⚠️ Not connected to server. Please refresh the page.');
  }
}

console.log('✅ Auth functions loaded');
