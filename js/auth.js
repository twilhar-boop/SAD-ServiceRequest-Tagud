// ---------------------------------------------------------------
// auth.js — login, logout, and session/route protection
// Implements BR-07: users must log in before managing requests.
// ---------------------------------------------------------------

/**
 * Returns the current logged-in user, or null.
 */
async function getCurrentUser() {
  const { data, error } = await supabaseClient.auth.getUser();
  if (error) return null;
  return data.user;
}

/**
 * Guard used at the top of index.html. If nobody is logged in,
 * bounce back to the login page immediately.
 */
async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = "login.html";
    return null;
  }
  return user;
}

/**
 * Guard used at the top of login.html. If someone is already
 * logged in, skip the form and go straight to the dashboard.
 */
async function redirectIfLoggedIn() {
  const user = await getCurrentUser();
  if (user) {
    window.location.href = "index.html";
  }
}

/**
 * Signs a user in with email + password.
 * Returns { user } on success or { error } on failure.
 */
async function loginWithPassword(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { error };
  return { user: data.user };
}

/**
 * Signs the current user out and returns to the login page.
 */
async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

// ---- login.html wiring -------------------------------------------------
// Only runs on pages that actually contain the login form.
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  if (!loginForm) return;

  redirectIfLoggedIn();

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const msgBox = document.getElementById("login-msg");
    const submitBtn = document.getElementById("login-submit");

    msgBox.className = "login-msg";
    msgBox.textContent = "";

    if (!email || !password) {
      msgBox.textContent = "Please enter both email and password.";
      msgBox.classList.add("show", "error");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Signing in...";

    const { error } = await loginWithPassword(email, password);

    submitBtn.disabled = false;
    submitBtn.textContent = "Log in";

    if (error) {
      msgBox.textContent = error.message || "Login failed. Check your credentials.";
      msgBox.classList.add("show", "error");
      return;
    }

    window.location.href = "index.html";
  });
});
