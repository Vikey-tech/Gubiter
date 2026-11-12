const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup(page, overrides = {}) {
    const nodes = new Map();
    function element() {
        return {
            value: '', checked: false, disabled: false, hidden: false, textContent: '',
            handlers: {}, attributes: {},
            addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); },
            setAttribute(key, value) { this.attributes[key] = value; },
            removeAttribute(key) { delete this.attributes[key]; },
            closest() { return this.group ||= element(); },
            reportValidity() { return true; }, focus() {}
        };
    }
    const message = element();
    const button = element();
    const passwords = [];
    const form = page === 'profile' ? null : element();
    if (form) {
        form.elements = {};
        for (const name of ['username', 'email', 'password', 'confirmPassword', 'accountType', 'loginIdentifier', 'loginPassword', 'recoveryConfirm', 'rememberMe']) {
            const field = element(); form.elements[name] = field;
            if (/password|confirm/i.test(name)) passwords.push(field);
        }
        form.elements.username.value = 'test_member';
        form.elements.email.value = form.elements.loginIdentifier.value = 'member@example.com';
        form.elements.password.value = form.elements.confirmPassword.value = form.elements.loginPassword.value = 'example-password';
        form.elements.accountType.value = 'creator';
        form.querySelector = () => button;
        form.querySelectorAll = () => passwords;
        nodes.set(page === 'login' ? 'loginForm' : 'registerForm', form);
    }
    const profile = element(); profile.hidden = true;
    if (page === 'profile') {
        nodes.set('accountProfile', profile);
        nodes.set('accountMessage', message);
        for (const id of ['accountName', 'accountEmail', 'logoutButton']) nodes.set(id, element());
        if (overrides.withEditor) {
            const editor = element(); editor.hidden = true;
            editor.elements = { username: element(), displayName: element(), bio: element() };
            editor.querySelector = () => button;
            editor.querySelectorAll = () => [];
            nodes.set('profileForm', editor);
            nodes.set('accountHandle', element());
            nodes.set('accountBio', element());
        }
    }
    const terms = element(); terms.checked = true; nodes.set('terms', terms);
    nodes.set('recoveryConfirmGroup', element());
    const forgot = element();
    const local = new Map(); const session = new Map();
    const storage = (map) => ({ getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) });
    const calls = [];
    let authChange;
    const auth = { onAuthStateChange(fn) { authChange = fn; } };
    for (const method of ['signUp', 'signInWithPassword', 'resetPasswordForEmail', 'updateUser', 'signOut', 'getSession', 'getUser']) {
        auth[method] = async (...args) => {
            calls.push({ method, args: args[0], options: args[1] });
            if (overrides[method]) return overrides[method](...args);
            if (method === 'getSession') return { data: { session: null }, error: null };
            return { data: {}, error: null };
        };
    }
    const redirects = [];
    const writes = [];
    const database = {
        select() { return this; }, eq() { return this; },
        async maybeSingle() { return { data: overrides.row || null, error: overrides.loadError || null }; },
        insert(row) { writes.push({ operation: 'insert', row }); return this; },
        update(row) { writes.push({ operation: 'update', row }); return this; },
        async single() { return { data: writes.at(-1).row, error: overrides.saveError || null }; }
    };
    let clientOptions;
    const context = {
        document: {
            getElementById: id => nodes.get(id) || null,
            querySelector: selector => selector === '.forgot-link' ? (page === 'login' ? forgot : null) : selector === '.auth-header h1' ? element() : form ? message : null
        },
        window: { GUBITER_SUPABASE: { url: 'https://example.supabase.co', publishableKey: 'public-key' }, supabase: { createClient(url, key, options) { clientOptions = options; return { auth, from: () => database }; } } },
        location: { origin: 'http://127.0.0.1:8080', assign: url => redirects.push(url), replace: url => redirects.push(url) },
        localStorage: storage(local), sessionStorage: storage(session)
    };
    vm.runInNewContext(fs.readFileSync('web/static/js/auth.js', 'utf8'), context);
    async function fire(node, type) {
        for (const fn of node.handlers[type] || []) await fn({ preventDefault() {} });
    }
    return { form, message, button, nodes, profile, calls, redirects, forgot, local, session, fire, writes, options: clientOptions, change: event => authChange(event) };
}

test('signup sends only preferences as metadata and waits for email confirmation', async () => {
    const app = setup('register');
    await app.fire(app.form, 'submit');
    assert.equal(app.calls[0].method, 'signUp');
    assert.equal(app.calls[0].args.options.data.username, 'test_member');
    assert.equal(app.calls[0].args.options.data.role, undefined);
    assert.match(app.message.textContent, /Check your email/);
    assert.deepEqual(app.redirects, []);
    assert.equal(app.form.elements.password.value, '');
    assert.equal(app.button.disabled, false);
});

test('password mismatch prevents signup', async () => {
    const app = setup('register');
    app.form.elements.confirmPassword.value = 'different';
    await app.fire(app.form, 'submit');
    assert.equal(app.calls.length, 0);
    assert.match(app.message.textContent, /do not match/);
});

test('Supabase errors are shown without redirecting', async () => {
    const app = setup('login', { signInWithPassword: async () => ({ error: { message: 'Email not confirmed' } }) });
    await app.fire(app.form, 'submit');
    assert.match(app.message.textContent, /Email not confirmed/);
    assert.deepEqual(app.redirects, []);
    assert.equal(app.button.disabled, false);
});

test('email login redirects after success and Remember me controls storage', async () => {
    for (const remember of [false, true]) {
        const app = setup('login');
        app.form.elements.rememberMe.checked = remember;
        await app.fire(app.form, 'submit');
        assert.equal(app.calls[0].args.email, 'member@example.com');
        assert.deepEqual(app.redirects, ['/profile.html']);
        app.options.auth.storage.setItem('session-key', 'session-value');
        assert.equal((remember ? app.local : app.session).get('session-key'), 'session-value');
        assert.equal((remember ? app.session : app.local).has('session-key'), false);
    }
});

test('reset emails return to the login callback and recovery updates the password', async () => {
    const app = setup('login');
    await app.fire(app.forgot, 'click');
    assert.equal(app.calls[0].method, 'resetPasswordForEmail');
    assert.equal(app.calls[0].args, 'member@example.com');
    assert.equal(app.calls[0].options.redirectTo, 'http://127.0.0.1:8080/login.html');
    app.change('PASSWORD_RECOVERY');
    app.form.elements.loginPassword.value = app.form.elements.recoveryConfirm.value = 'new-example-password';
    await app.fire(app.form, 'submit');
    assert.equal(app.calls[1].method, 'updateUser');
    assert.equal(app.calls[1].args.password, 'new-example-password');
    assert.deepEqual(app.redirects, ['/profile.html']);
});

test('signed-out profile redirects; unverified identity stays hidden', async () => {
    const signedOut = setup('profile');
    await new Promise(setImmediate);
    assert.deepEqual(signedOut.redirects, ['/login.html']);
    const failed = setup('profile', {
        getSession: async () => ({ data: { session: { access_token: 'test' } } }),
        getUser: async () => ({ error: new Error('Network unavailable') })
    });
    await new Promise(setImmediate);
    assert.equal(failed.profile.hidden, true);
    assert.match(failed.message.textContent, /could not be verified/);
});

test('profile uses verified account data as text and logout calls Supabase', async () => {
    const app = setup('profile', {
        getSession: async () => ({ data: { session: { access_token: 'test' } } }),
        getUser: async () => ({ data: { user: { email: 'member@example.com', user_metadata: { username: '<script>example</script>' } } } })
    });
    await new Promise(setImmediate);
    assert.equal(app.profile.hidden, false);
    assert.equal(app.nodes.get('accountName').textContent, '<script>example</script>');
    await app.fire(app.nodes.get('logoutButton'), 'click');
    assert.equal(app.calls.at(-1).method, 'signOut');
    assert.deepEqual(app.redirects, ['/login.html']);
});

const member = {
    withEditor: true,
    getSession: async () => ({ data: { session: {} } }),
    getUser: async () => ({ data: { user: { id: 'verified-id', email: 'member@example.com', user_metadata: { username: 'member' } } } })
};
test('profile creates with verified ID then updates; text remains inert', async () => {
    const app = setup('profile', member);
    await new Promise(setImmediate);
    const editor = app.nodes.get('profileForm');
    assert.equal(editor.hidden, false);
    editor.elements.displayName.value = '<img onerror=alert(1)>';
    editor.elements.bio.value = 'My bio';
    await app.fire(editor, 'submit');
    assert.equal(app.writes[0].row.id, 'verified-id');
    assert.equal(app.nodes.get('accountName').textContent, '<img onerror=alert(1)>');
    assert.equal(app.message.textContent, 'Profile saved.');
    await app.fire(editor, 'submit');
    assert.equal(app.writes[1].operation, 'update');
    assert.equal(app.writes[1].row.id, undefined);
});
test('duplicate usernames keep editor available and report a useful error', async () => {
    const app = setup('profile', { ...member, saveError: { code: '23505' } });
    await new Promise(setImmediate);
    await app.fire(app.nodes.get('profileForm'), 'submit');
    assert.match(app.message.textContent, /already taken/);
    assert.equal(app.button.disabled, false);
});
test('failed profile load keeps editor hidden to prevent overwriting data', async () => {
    const app = setup('profile', { ...member, loadError: { message: 'Offline' } });
    await new Promise(setImmediate);
    assert.equal(app.nodes.get('profileForm').hidden, true);
    assert.match(app.message.textContent, /could not load/);
    assert.equal(app.writes.length, 0);
});
