// Supabase owns credentials, email confirmation, token refresh and revocation.
(() => {
    'use strict';
    const login = document.getElementById('loginForm');
    const register = document.getElementById('registerForm');
    const profile = document.getElementById('accountProfile');
    const editor = document.getElementById('profileForm');
    let verifiedUser;
    let hasProfile = false;
    const message = document.querySelector('.auth-form .form-message') || document.getElementById('accountMessage');
    const say = (text) => { if (message) message.textContent = text; };
    if (message) { message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite'); }
    // Prevent native submission even when SDK initialization fails.
    for (const form of [login, register, editor].filter(Boolean)) {
        form.addEventListener('submit', (event) => event.preventDefault());
    }
    const config = window.GUBITER_SUPABASE;
    if (!config || !window.supabase) {
        say('Account services could not load. Please refresh the page.');
        return;
    }
    let client;
    let recovery = false;
    let remember = false;
    try {
        remember = localStorage.getItem('gubiter-remember') === 'true';
        // Session-only unless the user explicitly selects Remember me.
        const storage = {
            getItem: (key) => localStorage.getItem(key) || sessionStorage.getItem(key),
            setItem: (key, value) => {
                (remember ? localStorage : sessionStorage).setItem(key, value);
                (remember ? sessionStorage : localStorage).removeItem(key);
            },
            removeItem: (key) => { localStorage.removeItem(key); sessionStorage.removeItem(key); }
        };
        client = window.supabase.createClient(config.url, config.publishableKey, {
            auth: { storage, storageKey: 'gubiter-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
    } catch {
        say('Please allow browser storage to use your account.');
        return;
    }
    const callback = `${location.origin}/login.html`;
    const clearPasswords = (form) => form.querySelectorAll('input[type="password"]').forEach((input) => { input.value = ''; });
    const run = async (form, action) => {
        const button = form.querySelector('button[type="submit"]');
        if (button.disabled) return;
        button.disabled = true;
        form.setAttribute('aria-busy', 'true');
        say('Please wait…');
        try { await action(); }
        catch (error) { say(error.message || 'Unable to reach account services. Please try again.'); }
        finally { button.disabled = false; form.removeAttribute('aria-busy'); clearPasswords(form); }
    };

    register?.addEventListener('submit', () => run(register, async () => {
        const username = register.elements.username.value.trim().toLowerCase();
        if (!/^[a-z0-9_]{3,30}$/.test(username)) throw new Error('Use 3–30 lowercase letters, numbers or underscores for your username.');
        const password = register.elements.password.value;
        if (password !== register.elements.confirmPassword.value) throw new Error('Your passwords do not match.');
        if (!document.getElementById('terms').checked) throw new Error('Please accept the terms to continue.');
        const { data, error } = await client.auth.signUp({
            email: register.elements.email.value.trim(), password,
            options: {
                emailRedirectTo: callback,
                // Preferences only. Never authorize roles using editable user metadata.
                data: { username, account_type: register.elements.accountType.value }
            }
        });
        if (error) throw error;
        if (data.session) { location.assign('/profile.html'); return; }
        say('Check your email for a confirmation link. After confirming, sign in with your email and password. If you already have an account, sign in instead.');
    }));

    login?.addEventListener('submit', () => run(login, async () => {
        if (recovery) {
            if (login.elements.loginPassword.value !== login.elements.recoveryConfirm.value) throw new Error('Your passwords do not match.');
            const { error } = await client.auth.updateUser({ password: login.elements.loginPassword.value });
            if (error) throw error;
            location.assign('/profile.html');
            return;
        }
        remember = login.elements.rememberMe.checked;
        localStorage.setItem('gubiter-remember', String(remember));
        const { error } = await client.auth.signInWithPassword({
            email: login.elements.loginIdentifier.value.trim(), password: login.elements.loginPassword.value
        });
        if (error) throw error;
        location.assign('/profile.html');
    }));

    document.querySelector('.forgot-link')?.addEventListener('click', (event) => {
        event.preventDefault();
        const email = login.elements.loginIdentifier;
        if (!email.value || !email.reportValidity()) { say('Enter your email address above first.'); email.focus(); return; }
        return run(login, async () => {
            const { error } = await client.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: callback });
            if (error) throw error;
            say('If that address has an account, check its inbox for a password reset link.');
        });
    });

    client.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY' && login) {
            recovery = true;
            document.querySelector('.auth-header h1').textContent = 'Choose a new password';
            login.elements.loginIdentifier.required = false;
            login.elements.loginIdentifier.closest('.form-group').hidden = true;
            login.querySelector('.login-options').hidden = true;
            login.elements.loginPassword.autocomplete = 'new-password';
            login.elements.loginPassword.minLength = 8;
            login.elements.recoveryConfirm.required = true;
            document.getElementById('recoveryConfirmGroup').hidden = false;
            login.querySelector('button[type="submit"]').textContent = 'Save password';
            say('Enter and confirm your new password.');
        }
        if (event === 'SIGNED_OUT' && profile) location.replace('/login.html');
    });

    const logout = document.getElementById('logoutButton');
    const showProfile = (row) => {
        document.getElementById('accountName').textContent = row.display_name || row.username;
        document.getElementById('accountHandle').textContent = '@' + row.username;
        document.getElementById('accountBio').textContent = row.bio || 'Tell the community a little about yourself.';
    };
    editor?.addEventListener('submit', () => run(editor, async () => {
        if (!verifiedUser) throw new Error('Please sign in again before saving.');
        const username = editor.elements.username.value.trim().toLowerCase();
        const display_name = editor.elements.displayName.value.trim();
        const bio = editor.elements.bio.value.trim();
        if (!/^[a-z0-9_]{3,30}$/.test(username)) throw new Error('Use 3-30 lowercase letters, numbers or underscores for your username.');
        if (display_name.length > 80 || bio.length > 500) throw new Error('Keep your name under 81 characters and your bio under 501 characters.');
        const changes = { username, display_name, bio };
        const query = hasProfile
            ? client.from('profiles').update(changes).eq('id', verifiedUser.id)
            : client.from('profiles').insert({ id: verifiedUser.id, ...changes });
        const { data, error } = await query.select('username, display_name, bio').single();
        if (error) {
            if (error.code === '23505') throw new Error('That username is already taken. Please choose another.');
            throw new Error('Your profile could not be saved. Please try again.');
        }
        showProfile(data);
        hasProfile = true;
        say('Profile saved.');
    }));
    logout?.addEventListener('click', async () => {
        logout.disabled = true;
        try {
            const { error } = await client.auth.signOut({ scope: 'local' });
            if (error) throw error;
            localStorage.removeItem('gubiter-remember');
            location.replace('/login.html');
        } catch (error) { say(error.message || 'Could not sign out. Please try again.'); logout.disabled = false; }
    });
    if (profile) {
        (async () => {
            try {
                const { data: sessionData, error: sessionError } = await client.auth.getSession();
                if (sessionError) throw sessionError;
                if (!sessionData.session) { location.replace('/login.html'); return; }
                // Fetch the user from Supabase; do not trust stored user data.
                const { data, error } = await client.auth.getUser();
                if (error) throw error;
                document.getElementById('accountName').textContent = data.user.user_metadata?.username || 'Gubiter member';
                document.getElementById('accountEmail').textContent = data.user.email || '';
                profile.hidden = false;
                say('You are signed in.');
                if (editor) {
                    verifiedUser = data.user;
                    const { data: row, error: profileError } = await client.from('profiles')
                        .select('username, display_name, bio').eq('id', verifiedUser.id).maybeSingle();
                    if (profileError) { say('Your profile could not load. Reload to try again.'); return; }
                    hasProfile = Boolean(row);
                    editor.elements.username.value = row?.username || verifiedUser.user_metadata?.username || '';
                    editor.elements.displayName.value = row?.display_name || '';
                    editor.elements.bio.value = row?.bio || '';
                    if (row) showProfile(row);
                    editor.hidden = false;
                    say(row ? 'Your profile is up to date.' : 'Choose a unique username and save your profile to get started.');
                }
            } catch { say('Your account could not be verified. Check your connection and reload, or sign out.'); }
        })();
    }
})();
